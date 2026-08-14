#!/usr/bin/env python3
"""Verify — and repair — every number this repository's docs assert.

WHY THIS EXISTS

A prose document has no mechanism that makes a stale number *fail*. Glyph's
README carries somewhere north of a hundred figures: kernel counts, a 14-row
benchmark table, a coverage table, dependency pins, an accuracy to two decimal
places. Every one of them was true when it was typed. Nothing keeps them true.

This is not hypothetical here. `README.md` claims "Four artifact-backed
readings of this kernel span 3.504x to 3.570x", while
`docs/benchmarks/ENVIRONMENT.md` — one directory away, about the same kernel —
says "Three artifact-backed measurements" and then explains at length why the
fourth reading was *withdrawn*: no JSON for it was ever committed. Three
committed run-pairs exist on disk. The README borrowed the word "four" from a
sentence in ENVIRONMENT.md that was counting something else, and the two files
have disagreed ever since. Nobody was careless. There was simply no check.

So the numbers stop being prose and become assertions.

THE DESIGN, AND WHY IT IS NOT MARKERS

The obvious approach is to fence each number in an HTML comment and regenerate
it. That fails here: many of the counts live inside a mermaid diagram, where an
HTML comment is a syntax error, and markers would make the README unreadable at
the density it uses numbers.

Instead each fact declares the SITES where it is asserted, as regexes that
capture the digits. The checker recomputes the fact and compares.

The load-bearing rule is this:

    A SITE REGEX THAT MATCHES ZERO TIMES IS A FAILURE.

Not a skip. A failure. If a claim is reworded so its regex no longer matches,
the fact has escaped its check and the file has silently stopped being
verified — which is the exact condition that let "Four artifact-backed
readings" survive. A checker that quietly passes when it can no longer find
what it was checking is not a checker.

CLASSES OF FACT

  static   — recomputable cheaply, offline, with no build. Two sub-kinds, and
             the distinction matters less than it looks:

             * from source — `#if defined(__AVX2__)` chains, TEST_CASE macros,
               package.json pins, the size of model.weights on disk.

             * from a COMMITTED RUN ARTIFACT — benchmarks/mnist_eval.json and
               docs/benchmarks/runs/*.json are records of runs that already
               happened, are in git, and are the files the README itself cites.
               Reading them costs a JSON parse. They are deliberately NOT
               copied into docs/readme-facts.json: duplicating a committed
               artifact into a second committed file just creates a second
               place for the same number to drift, which is the disease this
               script treats. A missing or malformed artifact is a hard
               failure, in the same spirit as the zero-match rule.

  recorded — require executing something that is not in git: the clang coverage
             pass (`tools/coverage.sh`), and the OpenSSF Scorecard, which a
             third party computes. Read from docs/readme-facts.json, which
             carries each value, the command behind it, the date it was taken
             and the machine. A checker that runs a coverage build becomes
             slow, then flaky, then disabled — and a disabled checker is how
             drift starts. The fast path never builds; `--record` does.

Scorecard deserves a note of its own. It is recomputed weekly by someone else
and it moves. `--check` therefore NEVER fetches it: a checker that goes red
because a third party re-scored the repository is a checker that trains you to
ignore it. The score is a recorded fact with a read date attached, and the
README's stated read date is verified against the artifact so a number can
never be refreshed while its date stays put.

WHY PYTHON

Neither this repo nor its CI has a Node toolchain on the critical path — the
C++ core is CMake and the existing automation is already Python (`tools/run.py`,
`tools/run_benchmarks.py`, `tools/prepare_mnist.py`). python3 ships on
ubuntu-latest, macos-latest and windows-latest runners. Stdlib only: no pip
install, so the CI job is a checkout and one command.

USAGE
  python3 tools/readme_facts.py            # --check: verify, exit 1 on drift
  python3 tools/readme_facts.py --write    # rewrite the numbers in place
  python3 tools/readme_facts.py --record   # run coverage + read Scorecard,
                                           #   refresh docs/readme-facts.json
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import urllib.request
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACT = os.path.join(REPO, "docs", "readme-facts.json")
ARTIFACT_REL = "docs/readme-facts.json"

README = "README.md"
BENCHMARKS_MD = "BENCHMARKS.md"
ENVIRONMENT_MD = "docs/benchmarks/ENVIRONMENT.md"
WASM_MD = "docs/WASM.md"

RUNS = "docs/benchmarks/runs"


# ── helpers ──────────────────────────────────────────────────────────────


def read(rel: str) -> str:
    with open(os.path.join(REPO, rel), encoding="utf-8") as fh:
        return fh.read()


def read_json(rel: str):
    try:
        with open(os.path.join(REPO, rel), encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        die(f"{rel} is missing. It is a committed artifact that the README cites directly.")
    except json.JSONDecodeError as exc:
        die(f"{rel} is not valid JSON ({exc}).")


def die(msg: str) -> None:
    sys.stderr.write(f"\n  x {msg}\n\n")
    sys.exit(1)


def count_in(rel: str, pattern: str) -> int:
    return len(re.findall(pattern, read(rel), re.MULTILINE))


def grep1(rel: str, pattern: str) -> str:
    """The single capture of `pattern` in `rel`, or a loud failure.

    Every ground-truth lookup goes through here rather than through a bare
    `re.search(...).group(1)`. A renamed constant should say which constant and
    in which file, not raise AttributeError on None from inside a lambda.
    """
    m = re.search(pattern, read(rel), re.MULTILINE)
    if not m:
        die(f"{rel}: /{pattern}/ matched nothing.\n"
            f"      This is the SOURCE of a README claim, not a site. The constant it\n"
            f"      reads was renamed or moved, so the claim now has no ground truth.")
    return m.group(1)


CARDINALS = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
]
# "carries a fourth kernel" is an ORDINAL, not a cardinal. Conflating the two
# is how a word-form site silently stops comparing anything.
ORDINALS = [
    "zeroth", "first", "second", "third", "fourth", "fifth", "sixth",
    "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
]


def to_word(n, ordinal=False):
    table = ORDINALS if ordinal else CARDINALS
    i = int(round(float(n)))
    return table[i] if 0 <= i < len(table) else str(n)


def round_half_up(value, decimals):
    """Round the way a person writing a README rounds.

    Python's round() is banker's rounding and float formatting inherits the
    binary representation: f"{86.05:.1f}" is "86.0", because 86.05 as a double
    is 86.0499999999999971578. llvm-cov printed 86.05% and the README says
    86.1%. The README is right and the naive format is wrong, so every
    comparison goes through Decimal with ROUND_HALF_UP. Getting this backwards
    produces a checker that demands you make a correct document incorrect.
    """
    q = Decimal(1).scaleb(-decimals) if decimals else Decimal(1)
    return Decimal(str(float(value))).quantize(q, rounding=ROUND_HALF_UP)


def fmt(value, decimals=None, commas=False, word=False, ordinal=False):
    """Render a fact the way a site expects to see it.

    Comparison is always between FORMATTED STRINGS, never between floats.
    Every figure in this README has its own precision -- 97.01%, 0.9698,
    3.536x, 3.57x, 0.998x, 92.4% -- and float equality has nothing useful to
    say about any of them.
    """
    if word or ordinal:
        return to_word(value, ordinal=ordinal)
    if decimals is None:
        n = int(round_half_up(value, 0))
        return f"{n:,}" if commas else str(n)
    return f"{round_half_up(value, decimals):.{decimals}f}"


# ── site plumbing ────────────────────────────────────────────────────────


def site(pattern, file=README, decimals="inherit", word=False, ordinal=False,
         commas="auto"):
    """One place a fact is asserted.

    `pattern` MUST contain exactly one capture group, around the number. That
    is enforced at startup rather than trusted: a second group silently shifts
    which digits get compared.

    `decimals` defaults to the fact's own precision but can be overridden
    per-site, because the same measurement is quoted at different precisions in
    different sentences (2.80x in the table, 2.8x in the prose).
    """
    return {
        "pattern": pattern,
        "file": file,
        "decimals": decimals,
        "word": word,
        "ordinal": ordinal,
        "commas": commas,
    }


def fact(describe, kind, sites, compute=None, decimals=None):
    return {
        "describe": describe,
        "kind": kind,
        "sites": sites,
        "compute": compute,
        "decimals": decimals,
    }


# ── source-derived computations ──────────────────────────────────────────

ISA_GUARDS = r"defined\(__AVX512F__\)|defined\(__AVX2__\)|defined\(__ARM_NEON\b|defined\(__wasm_simd128__\)"


def isa_sets(rel: str) -> int:
    """Distinct SIMD instruction sets a translation unit compiles a kernel for.

    Counted from the `#if defined(...)/#elif defined(...)` selection chain
    itself, not from a comment and not from the includes -- an `#include
    <immintrin.h>` that no kernel is written against is not an instruction set.
    """
    text = read(rel)
    chain = re.findall(r"^\s*#\s*(?:el)?if\s+(.+)$", text, re.MULTILINE)
    found = set()
    for cond in chain:
        for guard, name in (
            (r"__AVX512F__", "avx512"),
            (r"__AVX2__", "avx2"),
            (r"__ARM_NEON", "neon"),
            (r"__wasm_simd128__", "wasm"),
        ):
            if re.search(guard, cond):
                found.add(name)
    if not found:
        die(f"{rel}: found no SIMD selection chain at all. The `#if defined(__AVX...)` "
            f"guards this fact counts have moved or been renamed.")
    return len(found)


def test_cases(rel: str) -> int:
    return count_in(rel, r"^TEST_CASE\s*\(")


def playwright_tests() -> int:
    total = 0
    for name in sorted(os.listdir(os.path.join(REPO, "web/tests/e2e"))):
        if name.endswith(".spec.ts"):
            total += count_in(f"web/tests/e2e/{name}", r"^\s*test\(")
    return total


def playwright_specs() -> int:
    return len([n for n in os.listdir(os.path.join(REPO, "web/tests/e2e"))
                if n.endswith(".spec.ts")])


def playwright_projects() -> int:
    """Entries in the `projects: [...]` array of playwright.config.ts.

    Scoped to the array rather than counting every `name:` in the file, so an
    unrelated `name:` key elsewhere in the config cannot inflate the count.
    """
    text = read("web/playwright.config.ts")
    start = text.find("projects:")
    if start == -1:
        die("web/playwright.config.ts: no `projects:` array found.")
    depth, i = 0, text.index("[", start)
    end = i
    for j in range(i, len(text)):
        if text[j] == "[":
            depth += 1
        elif text[j] == "]":
            depth -= 1
            if depth == 0:
                end = j
                break
    return len(re.findall(r"\bname:\s*'", text[i:end]))


def pkg_version(name: str) -> str:
    """major.minor of a web/package.json dependency, as the README quotes it."""
    pkg = read_json("web/package.json")
    for section in ("dependencies", "devDependencies"):
        spec = pkg.get(section, {}).get(name)
        if spec:
            m = re.search(r"(\d+)\.(\d+)", spec)
            return f"{m.group(1)}.{m.group(2)}"
    die(f"web/package.json declares no dependency named {name!r}.")


def cmake_tag(pattern: str) -> str:
    m = re.search(pattern, read("CMakeLists.txt"))
    if not m:
        die(f"CMakeLists.txt: {pattern} did not match. A pinned dependency moved.")
    return m.group(1)


# ── committed-artifact computations ──────────────────────────────────────


def eval_json():
    return read_json("benchmarks/mnist_eval.json")


def gbench_medians(rel: str):
    """Google Benchmark writes per-repetition rows PLUS aggregate rows.

    The README's tables were derived from the `median` aggregate, so that is
    what is read back -- recomputing a median here would be a second opinion,
    not a check, and would differ by a tick whenever the repetition count is
    even.
    """
    data = read_json(rel)
    out = {}
    for b in data.get("benchmarks", []):
        if b.get("aggregate_name") == "median":
            out[b["run_name"]] = b
    if not out:  # a 1-repetition run has no aggregates; fall back to the row
        for b in data.get("benchmarks", []):
            out.setdefault(b["run_name"], b)
    if not out:
        die(f"{rel}: no benchmark rows at all.")
    return out


def gbench_aggregate(rel: str, run_name: str, aggregate: str):
    for b in read_json(rel).get("benchmarks", []):
        if b.get("run_name") == run_name and b.get("aggregate_name") == aggregate:
            return b
    die(f"{rel}: no `{aggregate}` aggregate for {run_name}.")


AGG_BASE = f"{RUNS}/bench-20260802-aggregated-baseline.json"
AGG_OPT = f"{RUNS}/bench-20260802-aggregated-openmp-native.json"
D20_BASE = f"{RUNS}/bench-20260802-dot20x-baseline.json"
D20_OPT = f"{RUNS}/bench-20260802-dot20x-openmp-native.json"

# label -> (google-benchmark run_name, unit). `learn`/`classify` are
# items/second (higher is better); everything else is ns/op (lower is better).
BENCH_ROWS = [
    ("dot 32", "benchDot/32", "ns"),
    ("dot 64", "benchDot/64", "ns"),
    ("dot 128", "benchDot/128", "ns"),
    ("dot 256", "benchDot/256", "ns"),
    ("transpose 128", "benchTranspose/128", "ns"),
    ("transpose 256", "benchTranspose/256", "ns"),
    ("transpose 512", "benchTranspose/512", "ns"),
    ("transpose 1024", "benchTranspose/1024", "ns"),
    ("axpy 128", "benchAxpy/128", "ns"),
    ("axpy 256", "benchAxpy/256", "ns"),
    ("axpy 512", "benchAxpy/512", "ns"),
    ("axpy 1024", "benchAxpy/1024", "ns"),
    ("learn", "benchLearn", "ips"),
    ("classify", "benchClassify", "ips"),
]

_bench_cache = {}


def bench_cell(run_name: str, side: str, unit: str) -> float:
    key = (run_name, side, unit)
    if key not in _bench_cache:
        rel = AGG_BASE if side == "base" else AGG_OPT
        row = gbench_medians(rel)[run_name]
        _bench_cache[key] = row["real_time"] if unit == "ns" else row["items_per_second"]
    return _bench_cache[key]


def bench_ratio(run_name: str, unit: str) -> float:
    b = bench_cell(run_name, "base", unit)
    o = bench_cell(run_name, "opt", unit)
    # ns: lower is better, so the speedup is base/opt. items/s: the reverse.
    return b / o if unit == "ns" else o / b


def dot256_pairs():
    """Every committed (baseline, openmp+native) run-pair holding a dot 256 median.

    This is the fact the README gets wrong. There are three such pairs on
    disk -- December 2025 at 1 repetition, and the two August 2026 runs at 10
    and 20. A fourth reading (3.520x) was withdrawn in 2026-08-03 precisely
    because no JSON for it was ever committed, which is what "artifact-backed"
    means. Counting the artifacts is therefore the whole check.
    """
    names = sorted(os.listdir(os.path.join(REPO, RUNS)))
    pairs = []
    for base in names:
        if not base.endswith("-baseline.json"):
            continue
        opt = base.replace("-baseline.json", "-openmp-native.json")
        if opt not in names:
            continue
        b = gbench_medians(f"{RUNS}/{base}").get("benchDot/256")
        o = gbench_medians(f"{RUNS}/{opt}").get("benchDot/256")
        if b and o:
            pairs.append((base, b["real_time"] / o["real_time"]))
    if not pairs:
        die(f"{RUNS}: no committed baseline/openmp-native pair carries a dot 256 median.")
    return pairs


def dot256_ratios():
    return sorted(r for _, r in dot256_pairs())


def cov_pct(rel: str, run_name: str) -> float:
    stddev = gbench_aggregate(rel, run_name, "stddev")["real_time"]
    mean = gbench_aggregate(rel, run_name, "mean")["real_time"]
    return 100.0 * stddev / mean


def reps(rel: str, run_name: str) -> int:
    return sum(1 for b in read_json(rel).get("benchmarks", [])
               if b.get("run_name") == run_name and "aggregate_name" not in b)


def losing_matrix_cases() -> int:
    """Matrix-op rows whose printed speedup is below 1.00.

    Compared at the precision the table PRINTS (two decimals), because the
    README's sentence is about the bolded rows a reader sees, not about the
    raw double. `dot 32` is 0.9862 raw and prints 0.99 -- both below 1.00, but
    only one of those is what the claim is about.
    """
    return sum(1 for _, run, unit in BENCH_ROWS
               if unit == "ns" and float(f"{bench_ratio(run, unit):.2f}") < 1.00)


def env_field(pattern: str) -> str:
    m = re.search(pattern, read(ENVIRONMENT_MD))
    if not m:
        die(f"{ENVIRONMENT_MD}: {pattern} did not match. The reference-machine "
            f"table this fact reads from has changed shape.")
    return m.group(1)


# ── the facts ────────────────────────────────────────────────────────────

FACTS = {}


def add(fid, describe, kind, sites, compute=None, decimals=None):
    FACTS[fid] = fact(describe, kind, sites, compute, decimals)


# -- SIMD kernel counts ---------------------------------------------------

add("matrixIsaSets",
    "SIMD instruction sets selected in src/Matrix.cpp",
    "static",
    [site(r"\(`src/Matrix\.cpp` —\s+(\w+) instruction sets\)", word=True),
     site(r"written (\w+) times — AVX-512 and AVX2", word=True),
     site(r"kernel on top of those (\w+): WebAssembly simd128", word=True),
     site(r"`Matrix\.cpp`, which has (\w+)\.", word=True)],
    lambda: isa_sets("src/Matrix.cpp"))

add("dotKernelIsaSets",
    "SIMD instruction sets selected in the src/NeuralNet.cpp dot kernel",
    "static",
    [site(r"hot loop rewritten (\w+) times in AVX-512", word=True),
     site(r"carries a (\w+)\s+kernel on top of those three", ordinal=True),
     site(r'So "(\w+) instruction sets" is', word=True),
     site(r"adds a (\w+), wasm simd128", ordinal=True),
     site(r"so the (\w+)-instruction-set claim is about the dot kernels", word=True)],
    lambda: isa_sets("src/NeuralNet.cpp"))

# -- accuracy, from the committed evaluation record -----------------------

add("accuracyPct",
    "accuracy in benchmarks/mnist_eval.json",
    "static",
    [site(r"behind a ([\d.]+)% classifier"),
     site(r"\*\*([\d.]+)% on the [\d,]+-image MNIST test set\*\*"),
     site(r"([\d.]+)% is the classifier's accuracy on"),
     site(r"mnist_eval\.json\s+# ([\d.]+)% — pins the model"),
     site(r"bytes, the ([\d.]+)% model"),
     site(r"\| ([\d.]+)% accuracy \|")],
    lambda: eval_json()["overall"]["accuracy_pct"], decimals=2)

add("correct",
    "correctly classified test images in benchmarks/mnist_eval.json",
    "static",
    [site(r"— ([\d,]+) correct, macro-F1"),
     site(r"([\d,]+) / 10,000, with the model's SHA-256")],
    lambda: eval_json()["overall"]["correct"])

add("testSetImages",
    "images in the MNIST test set, per benchmarks/mnist_eval.json",
    "static",
    [site(r"the ([\d,]+)-image MNIST test set"),
     site(r"9,701 / ([\d,]+), with the model's SHA-256")],
    lambda: eval_json()["dataset"]["images"])

add("macroF1",
    "macro-averaged F1 in benchmarks/mnist_eval.json",
    "static",
    [site(r"macro-F1\s+([\d.]+),")],
    lambda: eval_json()["macro_avg"]["f1"], decimals=4)

add("modelWeightsBytes",
    "size of model.weights on disk",
    "static",
    [site(r"ASCII weights, ([\d,]+) bytes")],
    lambda: os.path.getsize(os.path.join(REPO, "model.weights")))

add("topologyHidden",
    "hidden units in the shipped model, per benchmarks/mnist_eval.json",
    "static",
    [site(r"multilayer perceptron, 784 → (\d+) → 10"),
     site(r"NeuralNet<br/>784 → (\d+) → 10"),
     site(r"a 784 × (\d+) × 10 network should classify")],
    lambda: eval_json()["model"]["layers"][1])

add("benchHidden",
    "hidden units in the benchmark harness network (benchmarks/bench_matrix.cpp)",
    "static",
    [site(r"784 → (\d+) → 10 network \(`benchmarks/bench_matrix\.cpp"),
     site(r"\(784→(\d+)→10, not the shipped net\)")],
    lambda: int(grep1("benchmarks/bench_matrix.cpp",
                      r"NeuralNet\s+\w+\(\{784,\s*(\d+),\s*10\}\)")))

# -- the benchmark table, one fact family per row -------------------------

for _label, _run, _unit in BENCH_ROWS:
    _key = _label.replace(" ", "")
    _u = "ns" if _unit == "ns" else r"img/s"
    _cell = r"\*{0,2}[\d,]+ " + _u + r"\*{0,2}"
    _head = r"\| \*{0,2}`" + re.escape(_label) + r"`\*{0,2} \| "
    _ratio_dp = 2 if _unit == "ns" else 3

    add(f"bench_{_key}_baseline",
        f"`{_label}` baseline median from {AGG_BASE}",
        "static",
        [site(_head + r"\*{0,2}([\d,]+) " + _u)],
        (lambda r=_run, u=_unit: bench_cell(r, "base", u)))

    add(f"bench_{_key}_optimized",
        f"`{_label}` openmp+native median from {AGG_OPT}",
        "static",
        [site(_head + _cell + r" \| \*{0,2}([\d,]+) " + _u)],
        (lambda r=_run, u=_unit: bench_cell(r, "opt", u)))

    add(f"bench_{_key}_speedup",
        f"`{_label}` openmp+native speedup over baseline",
        "static",
        [site(_head + _cell + r" \| " + _cell + r" \| \*{0,2}([\d.]+)×")],
        (lambda r=_run, u=_unit: bench_ratio(r, u)), decimals=_ratio_dp)

add("transpose128Regression",
    "how much slower openmp+native is on `transpose 128` (the inverse ratio)",
    "static",
    [site(r"`transpose 128` is a ([\d.]+)× regression")],
    lambda: 1.0 / bench_ratio("benchTranspose/128", "ns"), decimals=1)

add("losingMatrixCases",
    "matrix-op rows whose printed speedup is below 1.00",
    "static",
    [site(r"loses in (\d+) of the \d+\s+matrix-op cases"),
     site(r"(\d+) of the \d+ matrix ops, and both end-to-end workloads")],
    losing_matrix_cases)

add("matrixCases",
    "matrix-op rows in the benchmark table (dot/transpose/axpy, excluding learn+classify)",
    "static",
    [site(r"loses in \d+ of the (\d+)\s+matrix-op cases"),
     site(r"\d+ of the (\d+) matrix ops, and both end-to-end workloads")],
    lambda: sum(1 for _, _, u in BENCH_ROWS if u == "ns"))

# -- the dot 256 headline -------------------------------------------------

add("dot256Speedup20x",
    "dot 256 speedup from the 20-repetition pair (bench-20260802-dot20x-*)",
    "static",
    [site(r"\*\*([\d.]+)× on the headline kernel"),
     site(r"The figure to cite is ([\d.]+)×"),
     site(r"([\d.]+)× is the one with the most\s+repetitions behind it"),
     site(r"\| ([\d.]+)× on `dot 256` \|"),
     site(r"\*\*([\d.]+)×\*\* over 20", file=ENVIRONMENT_MD),
     site(r"\*\*([\d.]+)× is the one to cite", file=ENVIRONMENT_MD),
     site(r"\| \*\*`benchDot/256`\*\* \| \*\*[\d.]+%\*\* \| \*\*[\d.]+%\*\* \| \*\*([\d.]+)×\*\* \|",
          file=BENCHMARKS_MD),
     site(r"([\d.]+)× \(20 rep\)", file=BENCHMARKS_MD),
     site(r"\*\*([\d.]+)× \(dot 256, 20 repetitions\)\*\*", file=BENCHMARKS_MD)],
    lambda: gbench_medians(D20_BASE)["benchDot/256"]["real_time"]
    / gbench_medians(D20_OPT)["benchDot/256"]["real_time"],
    decimals=3)

add("dot256SpeedupHigh",
    "highest committed dot 256 reading (the 10-repetition pair)",
    "static",
    [site(r"span [\d.]+× to ([\d.]+)×"),
     site(r"\*\*([\d.]+)×\*\* over 10 repetitions", file=ENVIRONMENT_MD),
     site(r"span [\d.]+ to ([\d.]+), so a fresh run", file=ENVIRONMENT_MD),
     site(r"([\d.]+)× \(10 rep\)", file=BENCHMARKS_MD)],
    lambda: dot256_ratios()[-1], decimals=3)

add("dot256SpeedupLow",
    "lowest committed dot 256 reading (the December 2025 record)",
    "static",
    [site(r"span ([\d.]+)× to [\d.]+×"),
     site(r"against ([\d.]+)× in the", file=ENVIRONMENT_MD),
     site(r"span ([\d.]+) to [\d.]+, so a fresh run", file=ENVIRONMENT_MD),
     site(r"([\d.]+)× \(Dec, 1 rep\)", file=BENCHMARKS_MD)],
    lambda: dot256_ratios()[0], decimals=3)

# The fact that was wrong. Note the two site regexes anchor on DIFFERENT
# nouns on purpose. ENVIRONMENT.md separately says "four readings of this
# kernel span 3.504 to 3.570" -- that sentence counts readings INCLUDING the
# withdrawn 3.520x, which is a different quantity, and is deliberately not a
# site here. Counting where a thing is DEFINED, not everywhere a similar word
# appears, is the entire discipline.
add("dot256ArtifactBackedReadings",
    "committed baseline/openmp-native run-pairs carrying a dot 256 median",
    "static",
    [site(r"(\w+) artifact-backed readings", word=True),
     site(r"(\w+) artifact-backed measurements", file=ENVIRONMENT_MD, word=True),
     site(r"survives (\w+) independent measurements", file=BENCHMARKS_MD, word=True)],
    lambda: len(dot256_pairs()))

add("repsAggregated",
    "repetitions behind the 14-row table (bench-20260802-aggregated-*)",
    "static",
    [site(r"Medians of \*\*(\d+) repetitions\*\*")],
    lambda: reps(AGG_BASE, "benchDot/256"))

add("repsDot20x",
    "repetitions behind the dot 256 headline (bench-20260802-dot20x-*)",
    "static",
    [site(r"re-measured at \*\*(\d+)\s+repetitions\*\*"),
     site(r"medians of (\d+) repetitions"),
     site(r"the most repetitions \((\d+)\)", file=ENVIRONMENT_MD),
     site(r"The (\d+)-repetition run above", file=ENVIRONMENT_MD)],
    lambda: reps(D20_BASE, "benchDot/256"))

add("cov20xBaseline",
    "coefficient of variation of the 20-rep dot 256 baseline",
    "static",
    [site(r"coefficient of variation on record for this kernel \(([\d.]+)% and"),
     site(r"coefficient of variation \(([\d.]+)% and [\d.]+%, against",
          file=ENVIRONMENT_MD),
     site(r"\| \*\*`benchDot/256`\*\* \| \*\*([\d.]+)%\*\*", file=BENCHMARKS_MD)],
    lambda: cov_pct(D20_BASE, "benchDot/256"), decimals=1)

add("cov20xOptimized",
    "coefficient of variation of the 20-rep dot 256 openmp+native side",
    "static",
    [site(r"for this kernel \([\d.]+% and ([\d.]+)%\)"),
     site(r"coefficient of variation \([\d.]+% and ([\d.]+)%, against",
          file=ENVIRONMENT_MD),
     site(r"\| \*\*`benchDot/256`\*\* \| \*\*[\d.]+%\*\* \| \*\*([\d.]+)%\*\*",
          file=BENCHMARKS_MD)],
    lambda: cov_pct(D20_OPT, "benchDot/256"), decimals=1)

add("cov10xBaseline",
    "coefficient of variation of the 10-rep dot 256 baseline",
    "static",
    [site(r"against ([\d.]+)% and [\d.]+% for the 10-rep", file=ENVIRONMENT_MD)],
    lambda: cov_pct(AGG_BASE, "benchDot/256"), decimals=1)

add("cov10xOptimized",
    "coefficient of variation of the 10-rep dot 256 openmp+native side",
    "static",
    [site(r"against [\d.]+% and ([\d.]+)% for the 10-rep", file=ENVIRONMENT_MD)],
    lambda: cov_pct(AGG_OPT, "benchDot/256"), decimals=1)

# -- the suite ------------------------------------------------------------

for _fid, _file, _pat in [
    ("testCasesMatrix", "tests/test_matrix.cpp", r"(\d+) in `test_matrix\.cpp`"),
    ("testCasesNeuralNet", "tests/test_neural_net.cpp", r"(\d+) in\s+`test_neural_net\.cpp`"),
    ("testCasesServerApi", "tests/test_server_api.cpp", r"and (\d+) in `test_server_api\.cpp`"),
]:
    add(_fid, f"TEST_CASE macros in {_file}", "static", [site(_pat)],
        (lambda f=_file: test_cases(f)))

add("testCasesProperties",
    "TEST_CASE macros in tests/test_matrix_properties.cpp",
    "static",
    [site(r"(\d+) property-based cases in `test_matrix_properties\.cpp`"),
     site(r"The (\d+) property-based cases use")],
    lambda: test_cases("tests/test_matrix_properties.cpp"))

add("testCasesTotal",
    "TEST_CASE macros across tests/",
    "static",
    [site(r"\*\*(\d+) Catch2 test cases\*\*"),
     site(r"so `ctest` reports (\d+)"),
     site(r"over the (\d+) cases —"),
     site(r"tests failed out of (\d+)`"),
     site(r"\| (\d+) cases over `Matrix`"),
     site(r"# (\d+) Catch2 cases;"),
     site(r"\| (\d+) tests passing on three OSes \|")],
    lambda: sum(test_cases(f"tests/{n}") for n in
                sorted(os.listdir(os.path.join(REPO, "tests")))
                if n.endswith(".cpp")))

add("playwrightTests",
    "test( declarations in web/tests/e2e/*.spec.ts",
    "static",
    [site(r"\| (\d+) tests across \d+ spec files"),
     site(r"# (\d+) Playwright tests × \d+ viewport projects")],
    playwright_tests)

add("playwrightSpecFiles",
    "*.spec.ts files under web/tests/e2e/",
    "static",
    [site(r"\| \d+ tests across (\d+) spec files")],
    playwright_specs)

add("playwrightProjects",
    "entries in the projects array of web/playwright.config.ts",
    "static",
    [site(r"run against (\d+) viewport projects"),
     site(r"× (\d+) viewport projects")],
    playwright_projects)

add("fuzzSeconds",
    "fuzz-seconds in .github/workflows/fuzzing.yml",
    "static",
    [site(r"address sanitizer, (\d+) s per PR")],
    lambda: int(grep1(".github/workflows/fuzzing.yml", r"fuzz-seconds:\s*(\d+)")))

# -- pins and thresholds --------------------------------------------------

add("adrCount",
    "architecture decision records under docs/adr/",
    "static",
    [site(r"# (\w+) architecture decision records", word=True)],
    lambda: len([n for n in os.listdir(os.path.join(REPO, "docs/adr"))
                 if n.endswith(".md")]))

add("ompGateElements",
    "the OpenMP element-count gate in Matrix::axpy",
    "static",
    [site(r"`rows_ \* cols_ >= (\d+)` gate")],
    lambda: int(grep1("src/Matrix.cpp", r"if \(rows_ \* cols_ >= (\d+)\)")))

add("bundleBudgetRawKb",
    "maxRawKb in web/scripts/check-bundle-budget.mjs",
    "static",
    [site(r"entry chunk to (\d+) KiB raw")],
    lambda: int(grep1("web/scripts/check-bundle-budget.mjs", r"maxRawKb:\s*(\d+)")))

add("bundleBudgetGzipKb",
    "maxGzipKb in web/scripts/check-bundle-budget.mjs",
    "static",
    [site(r"raw / (\d+) KiB gzip")],
    lambda: int(grep1("web/scripts/check-bundle-budget.mjs", r"maxGzipKb:\s*(\d+)")))

for _fid, _describe, _sites, _compute in [
    ("catch2Version", "the Catch2 GIT_TAG in CMakeLists.txt",
     [site(r"Catch2 v([\d.]+) \+ rapidcheck"), site(r"Catch2 v([\d.]+), rapidcheck")],
     lambda: cmake_tag(r"GIT_TAG\s+v(3\.[\d.]+)")),
    ("rapidcheckCommit", "the rapidcheck GIT_TAG in CMakeLists.txt (7-char prefix)",
     [site(r"rapidcheck \(pinned commit `([0-9a-f]+)`\)")],
     lambda: cmake_tag(r"GIT_TAG\s+([0-9a-f]{40})")[:7]),
    ("googleBenchmarkVersion", "the Google Benchmark GIT_TAG in CMakeLists.txt",
     [site(r"Google Benchmark v(\d+\.\d+\.\d+)"),
      site(r"\| Google Benchmark \| v(\d+\.\d+\.\d+),", file=ENVIRONMENT_MD)],
     lambda: cmake_tag(r"GIT_TAG\s+v(1\.[\d.]+)")),
    ("cmakeMinimum", "cmake_minimum_required in CMakeLists.txt",
     [site(r"CMake ≥ ([\d.]+), Release by default"), site(r"and CMake ≥ ([\d.]+)")],
     lambda: cmake_tag(r"cmake_minimum_required\(VERSION ([\d.]+)\)")),
    ("cxxStandard", "target_compile_features cxx_std_N in CMakeLists.txt",
     [site(r"cxx_std_(\d+)")],
     lambda: cmake_tag(r"cxx_std_(\d+)")),
    ("emscriptenVersion", "the emsdk version pinned in .github/workflows/wasm.yml",
     [site(r"Emscripten ([\d.]+) \(pinned in"), site(r"pinned emsdk ([\d.]+) and")],
     # Anchored on the setup-emsdk step, not on the first `version:` key in the
     # file. An unrelated `with: version:` on any action added above this step
     # would otherwise silently become the pinned Emscripten release.
     lambda: grep1(".github/workflows/wasm.yml",
                   r"setup-emsdk@[0-9a-f]+\s*\n\s*with:\s*\n\s*version:\s*([\d.]+)")),
]:
    add(_fid, _describe, "static", _sites, _compute)

for _fid, _pkg, _pat in [
    ("reactVersion", "react", r"React ([\d.]+), TypeScript"),
    ("typescriptVersion", "typescript", r"TypeScript ([\d.]+), Vite"),
    ("tailwindVersion", "tailwindcss", r"Tailwind CSS v([\d.]+) tokens"),
    ("motionVersion", "motion", r"Motion v([\d.]+) \|"),
    ("perfectFreehandVersion", "perfect-freehand", r"perfect-freehand ([\d.]+) over an SVG"),
    ("playwrightVersion", "@playwright/test", r"Playwright ([\d.]+)"),
]:
    add(_fid, f"the {_pkg} pin in web/package.json (major.minor)", "static",
        [site(_pat)], (lambda p=_pkg: pkg_version(p)))

add("viteVersion",
    "the rolldown-vite pin in web/package.json",
    "static",
    [site(r"`npm:rolldown-vite@([\d.]+)`")],
    lambda: grep1("web/package.json", r"npm:rolldown-vite@([\d.]+)"))

# -- the f32-vs-double comparison, read out of its own artifact -----------
#
# docs/WASM.md states that quantising the weights to float32 changes no
# predictions. That was an unmeasured assertion until 2026-08-13; these numbers
# come from benchmarks/mnist_f32_flips.json so the prose cannot drift from the
# measurement, and a re-run that changes the answer fails the build.


def f32_field(*path: str):
    p = os.path.join(REPO, "benchmarks/mnist_f32_flips.json")
    try:
        with open(p, encoding="utf-8") as fh:
            node = json.load(fh)
    except FileNotFoundError:
        die("benchmarks/mnist_f32_flips.json is missing. Regenerate with "
            "`./build/fast_mnist_eval --f32-weights`.")
    for key in path:
        if key not in node:
            die(f"benchmarks/mnist_f32_flips.json has no `{'.'.join(path)}` — the "
                f"schema changed and docs/WASM.md still quotes it.")
        node = node[key]
    return node


add("f32ParamsCompared", "params_compared in benchmarks/mnist_f32_flips.json", "static",
    [site(r"All \*\*([\d,]+)\*\* parameters in the `\.bin`", file=WASM_MD)],
    lambda: f32_field("parameter_check", "params_compared"))

add("f32Correct", "float32 correct count in benchmarks/mnist_f32_flips.json", "static",
    [site(r"evaluating gives ([\d,]+) / 10,000", file=WASM_MD)],
    lambda: f32_field("accuracy", "float32", "correct"))


# -- the in-browser reproduction, read out of its own artifact ------------
#
# docs/WASM.md states that the shipped wasm module reproduces the committed
# accuracy figure exactly. These come from benchmarks/mnist_eval_wasm.json, so a
# re-run that disagrees fails the build instead of leaving the prose confident.


def wasm_eval_field(*path: str):
    p = os.path.join(REPO, "benchmarks/mnist_eval_wasm.json")
    try:
        with open(p, encoding="utf-8") as fh:
            node = json.load(fh)
    except FileNotFoundError:
        die("benchmarks/mnist_eval_wasm.json is missing. Regenerate with "
            "`node tools/wasm_eval.mjs`.")
    for key in path:
        if key not in node:
            die(f"benchmarks/mnist_eval_wasm.json has no `{'.'.join(path)}` — the "
                f"schema changed and docs/WASM.md still quotes it.")
        node = node[key]
    return node


add("wasmEvalCorrect", "wasm_float32 correct count in benchmarks/mnist_eval_wasm.json",
    "static",
    [site(r"\*\*([\d,]+) / 10,000\. All ten thousand predictions", file=WASM_MD)],
    lambda: wasm_eval_field("accuracy", "wasm_float32", "correct"))

add("wasmEvalCompared", "images_compared in benchmarks/mnist_eval_wasm.json", "static",
    [site(r"over the same ([\d,]+) images", file=WASM_MD)],
    lambda: wasm_eval_field("agreement", "images_compared"))


# -- the wasm SIMD census, read out of the committed census artifact ------
#
# docs/WASM.md quotes four counts from docs/benchmarks/wasm-simd-census.json.
# That JSON is itself gated against the module's sha256 by
# tools/wasm_census.py --check, so this closes the loop: binary -> census ->
# prose, with a check at each hop.


def census_field(name: str) -> int:
    path = os.path.join(REPO, "docs/benchmarks/wasm-simd-census.json")
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)[name]
    except FileNotFoundError:
        die("docs/benchmarks/wasm-simd-census.json is missing. Run "
            "`python3 tools/wasm_census.py --write` (needs wabt).")
    except KeyError:
        die(f"docs/benchmarks/wasm-simd-census.json has no `{name}` — the census "
            f"schema changed and docs/WASM.md still quotes it.")


# README.md quotes the instruction count too, in its description of proof 4.1.
# A figure that appears in two files is a figure that can disagree with itself,
# so both sites are declared against the same source.
for _fid, _key, _pat, _readme_pat in [
    ("wasmCensusFunctions", "totalFunctions",
     r"\| Functions in the module \| \*\*(\d+)\*\* \|", None),
    ("wasmCensusVectorFunctions", "functionsWithVectorInstructions",
     r"\| Functions containing any 128-bit vector instruction \| \*\*(\d+)\*\* \|", None),
    ("wasmCensusVectorInstructions", "totalVectorInstructions",
     r"\| Vector instructions in total \| \*\*(\d+)\*\* \|",
     r"disassembled — all \*\*(\d+)\*\* of its 128-bit vector instructions"),
    ("wasmCensusSignatureHits", "signatureHits",
     r"sequences \| \*\*(\d+)\*\* \|", None),
]:
    _s = [site(_pat, file=WASM_MD)]
    if _readme_pat:
        _s.append(site(_readme_pat))
    add(_fid, f"`{_key}` in docs/benchmarks/wasm-simd-census.json", "static",
        _s, (lambda k=_key: census_field(k)))


# -- the JS bundle budgets, read out of the check script itself -----------
#
# README quotes three ceilings. They were correct and ungated, which is the
# state every drifted number in this repository was in first.


def bundle_budget(pattern: str) -> int:
    path = os.path.join(REPO, "web/scripts/check-bundle-budget.mjs")
    try:
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
    except FileNotFoundError:
        die("web/scripts/check-bundle-budget.mjs is missing; README quotes its budgets.")
    m = re.search(pattern, src)
    if not m:
        die(f"web/scripts/check-bundle-budget.mjs no longer matches {pattern!r} — "
            f"the script changed shape and README still quotes its budgets.")
    return int(m.group(1))


for _fid, _describe, _site_pat, _src_pat in [
    ("bundleEntryRawKb", "entry-chunk raw ceiling in check-bundle-budget.mjs",
     r"entry chunk to (\d+) KiB raw", r"maxRawKb:\s*(\d+)"),
    ("bundleEntryGzipKb", "entry-chunk gzip ceiling in check-bundle-budget.mjs",
     r"entry chunk to \d+ KiB raw / (\d+) KiB gzip", r"maxGzipKb:\s*(\d+)"),
    ("bundleTotalGzipKb", "all-JS gzip ceiling in check-bundle-budget.mjs",
     r"caps \*\*all\*\* shipped JavaScript at\n\*\*(\d+)\*\* KiB gzip",
     r"TOTAL_JS_GZIP_KB\s*=\s*(\d+)"),
]:
    add(_fid, _describe, "static", [site(_site_pat)],
        (lambda pat=_src_pat: bundle_budget(pat)))


# -- the misclassified-digit count the landing page draws -----------------
#
# README describes proof 4.7 as drawing "all 299 digits the model gets wrong".
# That count is the length of the committed failure manifest, which
# tools/export_failures.py --check ties to the pack's bytes, the pack's sha256,
# and the source CSV's sha256 — so this closes the same loop the census does:
# evaluation -> pack -> prose.


def misclassified_count() -> int:
    path = os.path.join(REPO, "web/public/failures/misclassified.json")
    try:
        with open(path, encoding="utf-8") as fh:
            return len(json.load(fh)["entries"])
    except FileNotFoundError:
        die("web/public/failures/misclassified.json is missing. Run "
            "`python3 tools/export_failures.py --write` (needs data/).")
    except KeyError:
        die("web/public/failures/misclassified.json has no `entries` — the "
            "manifest schema changed and README.md still quotes its length.")


add("misclassifiedDigits",
    "entries in web/public/failures/misclassified.json, drawn by proof 4.7",
    "static",
    [site(r"Accuracy — and all \*\*(\d+)\*\* digits the model gets wrong"),
     site(r"\*\*4\.7\*\* draws all \*\*(\d+)\*\*")],
    misclassified_count)


# -- the shipped WASM artifacts, measured off the committed files ---------
#
# docs/WASM.md opened by promising these were measured rather than estimated,
# and two of the three had drifted from an earlier build by 2026-08-13. The
# files are tracked in git, so there is no excuse for the prose and the bytes
# to disagree — this reads them.
#
# gzip is the canonical no-filename stream, which is what a server sends and
# what tools/gen_web_facts.py records for the landing page. `gzip -9 -c <file>`
# reports 14–18 bytes more because it stores the original filename.


def wasm_bytes(name: str) -> int:
    path = os.path.join(REPO, "web/public/wasm", name)
    try:
        with open(path, "rb") as fh:
            return len(fh.read())
    except FileNotFoundError:
        die(f"web/public/wasm/{name} is missing. It is a committed artifact "
            f"that docs/WASM.md quotes the size of directly.")


def wasm_gzip_bytes(name: str) -> int:
    path = os.path.join(REPO, "web/public/wasm", name)
    try:
        with open(path, "rb") as fh:
            return len(gzip.compress(fh.read(), compresslevel=9, mtime=0))
    except FileNotFoundError:
        die(f"web/public/wasm/{name} is missing. It is a committed artifact "
            f"that docs/WASM.md quotes the gzipped size of directly.")


for _fid, _name, _byte_pat, _kb_pat, _gz_pat in [
    ("wasmGlue", "fast_mnist.js",
     r"`web/public/wasm/fast_mnist\.js`\s*\|[^|]*\(([\d,]+) B\)",
     r"`web/public/wasm/fast_mnist\.js`\s*\|\s*([\d.]+) kB",
     r"`web/public/wasm/fast_mnist\.js`\s*\|[^|]*· ([\d.]+) kB gzipped"),
    ("wasmModule", "fast_mnist.wasm",
     r"`web/public/wasm/fast_mnist\.wasm`\s*\|[^|]*\(([\d,]+) B\)",
     r"`web/public/wasm/fast_mnist\.wasm`\s*\|\s*([\d.]+) kB",
     r"`web/public/wasm/fast_mnist\.wasm`\s*\|[^|]*· ([\d.]+) kB gzipped"),
    ("wasmWeights", "model.weights.bin",
     r"`web/public/wasm/model\.weights\.bin`\s*\|[^|]*\(([\d,]+) B\)",
     r"`web/public/wasm/model\.weights\.bin`\s*\|\s*([\d.]+) kB raw",
     r"`web/public/wasm/model\.weights\.bin`\s*\|[^|]*/ ([\d.]+) kB gzipped"),
]:
    add(f"{_fid}Bytes", f"the byte length of web/public/wasm/{_name}", "static",
        [site(_byte_pat, file=WASM_MD)], (lambda n=_name: wasm_bytes(n)))
    add(f"{_fid}Kb", f"web/public/wasm/{_name} in decimal kB", "static",
        [site(_kb_pat, file=WASM_MD)], (lambda n=_name: wasm_bytes(n) / 1000),
        decimals=1)
    add(f"{_fid}GzipKb", f"web/public/wasm/{_name} gzipped, decimal kB", "static",
        [site(_gz_pat, file=WASM_MD)], (lambda n=_name: wasm_gzip_bytes(n) / 1000),
        decimals=1)

# The digests of the files the browser actually downloads. benchmarks/mnist_eval.json
# records a sha256 for model.weights (the 800,678-byte ASCII checkpoint the native
# evaluator reads); the browser fetches model.weights.bin, a different file, and
# had no committed digest at all until 2026-08-13.


def wasm_sha256(name: str) -> str:
    path = os.path.join(REPO, "web/public/wasm", name)
    try:
        with open(path, "rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()
    except FileNotFoundError:
        die(f"web/public/wasm/{name} is missing. docs/WASM.md records its digest.")


for _name in ("fast_mnist.js", "fast_mnist.wasm", "model.weights.bin"):
    add(f"sha256_{_name.replace('.', '_')}",
        f"sha256 of web/public/wasm/{_name}",
        "static",
        [site(r"`web/public/wasm/" + re.escape(_name) + r"` \| `([0-9a-f]{64})` \|",
              file=WASM_MD)],
        (lambda n=_name: wasm_sha256(n)))

# -- the reference machine, sourced from ENVIRONMENT.md -------------------

for _fid, _describe, _sites, _pat in [
    ("machinePerfCores", "performance cores in docs/benchmarks/ENVIRONMENT.md",
     [site(r"(\d+) performance \+ \d+ efficiency cores")],
     r"\*\*(\d+) Performance \+ \d+ Efficiency\*\*"),
    ("machineEffCores", "efficiency cores in docs/benchmarks/ENVIRONMENT.md",
     [site(r"\d+ performance \+ (\d+) efficiency cores")],
     r"\*\*\d+ Performance \+ (\d+) Efficiency\*\*"),
    ("machineMemoryGiB", "memory in docs/benchmarks/ENVIRONMENT.md",
     [site(r"efficiency cores, (\d+) GiB")],
     r"\| Memory \| (\d+) GiB \|"),
    ("machineMacOS", "macOS version in docs/benchmarks/ENVIRONMENT.md",
     [site(r"macOS ([\d.]+), Apple clang")],
     r"\| macOS \| ([\d.]+) "),
    ("machineClang", "compiler version in docs/benchmarks/ENVIRONMENT.md",
     [site(r"Apple clang ([\d.]+),")],
     r"\| Compiler \| Apple clang ([\d.]+) "),
    ("machineCMake", "CMake version in docs/benchmarks/ENVIRONMENT.md",
     [site(r"CMake ([\d.]+), Google Benchmark")],
     r"\| CMake \| ([\d.]+) \|"),
    ("machineLoadAvg", "load_avg at the start of the run, per ENVIRONMENT.md",
     [site(r"`load_avg`\s+([\d.]+) at the start of the run")],
     r"`load_avg = \[([\d.]+),"),
]:
    add(_fid, _describe, "static", _sites, (lambda p=_pat: env_field(p)))

# -- recorded: coverage ---------------------------------------------------

# `| src/Matrix.cpp | 89.8% | **92.4%** | 78.8% |` -- three numbers per row,
# so three site regexes per row, each with exactly one group. NeuralNet.h
# prints `100%` rather than `100.0%` and has an em dash where its branch
# figure would be, so it overrides precision and declares no branch site.
COVERAGE_ROWS = [
    ("Matrix.cpp", r"`src/Matrix\.cpp`", "src/Matrix.cpp", 1, True),
    ("NeuralNet.cpp", r"`src/NeuralNet\.cpp`", "src/NeuralNet.cpp", 1, True),
    ("ServerApi.cpp", r"`src/ServerApi\.cpp`", "src/ServerApi.cpp", 1, True),
    ("NeuralNetH", r"`include/fast_mnist/NeuralNet\.h`", "include/fast_mnist/NeuralNet.h", 0, False),
    ("MatrixH", r"`include/fast_mnist/Matrix\.h`", "include/fast_mnist/Matrix.h", 1, True),
    ("Total", r"\*\*Total\*\*", "the weighted total", 1, True),
]

_pct = r"\*{0,2}[\d.]+%\*{0,2}"
for _key, _row_re, _human, _dp, _has_branches in COVERAGE_ROWS:
    _head = r"\| " + _row_re + r" \| "
    add(f"coverage{_key}Regions", f"region coverage of {_human}", "recorded",
        [site(_head + r"\*{0,2}([\d.]+)%", decimals=_dp)], decimals=_dp)
    add(f"coverage{_key}Lines", f"line coverage of {_human}", "recorded",
        [site(_head + _pct + r" \| \*{0,2}([\d.]+)%", decimals=_dp)], decimals=_dp)
    if _has_branches:
        add(f"coverage{_key}Branches", f"branch coverage of {_human}", "recorded",
            [site(_head + _pct + r" \| " + _pct + r" \| \*{0,2}([\d.]+)%", decimals=_dp)],
            decimals=_dp)

# -- recorded: OpenSSF Scorecard ------------------------------------------

add("scorecardScore",
    "the OpenSSF Scorecard score read from api.scorecard.dev",
    "recorded",
    [site(r"\*\*([\d.]+) / 10\*\*, read from `api\.scorecard\.dev`")],
    decimals=1)

add("scorecardVersion",
    "the Scorecard release that produced the score",
    "recorded",
    [site(r"\(Scorecard v([\d.]+)\)")])


# ── invariants ───────────────────────────────────────────────────────────
#
# Arithmetic cross-checks. These are what stop one figure from going stale
# behind another's back: add a test file and the per-file counts move, the sum
# stops agreeing, and --check says so before the README ships a total that is
# arithmetically impossible.

INVARIANTS = [
    ("the per-file case counts sum to the stated total",
     lambda f: (f["testCasesMatrix"] + f["testCasesNeuralNet"]
                + f["testCasesProperties"] + f["testCasesServerApi"]
                == f["testCasesTotal"]),
     lambda f: (f"{f['testCasesMatrix']} + {f['testCasesNeuralNet']} + "
                f"{f['testCasesProperties']} + {f['testCasesServerApi']} = "
                f"{f['testCasesMatrix'] + f['testCasesNeuralNet'] + f['testCasesProperties'] + f['testCasesServerApi']}, "
                f"not {f['testCasesTotal']}")),

    ("correct + incorrect classifications account for the whole test set",
     lambda f: (eval_json()["overall"]["correct"]
                + eval_json()["overall"]["incorrect"] == f["testSetImages"]),
     lambda f: (f"{eval_json()['overall']['correct']} correct + "
                f"{eval_json()['overall']['incorrect']} incorrect != "
                f"{f['testSetImages']} images")),

    ("the stated accuracy is correct/total",
     lambda f: abs(100.0 * eval_json()["overall"]["correct"] / f["testSetImages"]
                   - f["accuracyPct"]) < 0.005,
     lambda f: (f"{eval_json()['overall']['correct']}/{f['testSetImages']} = "
                f"{100.0 * eval_json()['overall']['correct'] / f['testSetImages']:.4f}%, "
                f"but the record says {f['accuracyPct']}%")),

    ("the dot kernel carries exactly one instruction set more than Matrix.cpp",
     lambda f: f["dotKernelIsaSets"] == f["matrixIsaSets"] + 1,
     lambda f: (f"src/NeuralNet.cpp has {f['dotKernelIsaSets']} and src/Matrix.cpp "
                f"has {f['matrixIsaSets']}. The README's qualified claim -- four "
                f"instruction sets IN THE DOT KERNELS, three in Matrix.cpp -- only "
                f"holds while that gap is exactly one. Re-read the qualifier before "
                f"changing either number.")),

    ("the 20-rep headline sits inside the span of committed readings",
     lambda f: (f["dot256SpeedupLow"] <= f["dot256Speedup20x"] <= f["dot256SpeedupHigh"]),
     lambda f: (f"{f['dot256Speedup20x']:.3f} is outside "
                f"[{f['dot256SpeedupLow']:.3f}, {f['dot256SpeedupHigh']:.3f}]")),

    ("every committed dot 256 reading is artifact-backed and counted",
     lambda f: f["dot256ArtifactBackedReadings"] == len(dot256_ratios()),
     lambda f: (f"counted {f['dot256ArtifactBackedReadings']} pairs but "
                f"{len(dot256_ratios())} ratios came back")),

    ("the table's dot 256 speedup is the high end of the committed span",
     lambda f: (f"{f['bench_dot256_speedup']:.3f}" == f"{f['dot256SpeedupHigh']:.3f}"),
     lambda f: (f"table row says {f['bench_dot256_speedup']:.3f}, span high is "
                f"{f['dot256SpeedupHigh']:.3f}")),

    ("the matrix-op row count matches the table",
     lambda f: f["matrixCases"] == sum(1 for _, _, u in BENCH_ROWS if u == "ns"),
     lambda f: f"{f['matrixCases']} != {sum(1 for _, _, u in BENCH_ROWS if u == 'ns')}"),

    ("more matrix ops lose than the headline suggests, and the README says so",
     lambda f: 0 < f["losingMatrixCases"] < f["matrixCases"],
     lambda f: (f"{f['losingMatrixCases']} of {f['matrixCases']} -- if this ever "
                f"reaches 0 or all, the paragraph explaining the mix needs rewriting, "
                f"not just the digits")),

    ("the 20-repetition pair really is the tightest on record",
     lambda f: (f["cov20xBaseline"] <= f["cov10xBaseline"]
                and f["cov20xOptimized"] <= f["cov10xOptimized"]),
     lambda f: (f"20-rep CoV ({f['cov20xBaseline']}%, {f['cov20xOptimized']}%) is no "
                f"longer tighter than 10-rep ({f['cov10xBaseline']}%, "
                f"{f['cov10xOptimized']}%). The README's reason for citing 3.536x "
                f"is that sentence, so the sentence -- not just the number -- is stale.")),

    ("the coverage total sits between the best and worst covered file",
     lambda f: (min(f["coverageServerApi.cppLines"], f["coverageMatrixHLines"])
                <= f["coverageTotalLines"]
                <= max(f["coverageNeuralNetHLines"], f["coverageMatrix.cppLines"])),
     lambda f: (f"total {f['coverageTotalLines']}% is outside the per-file range -- "
                f"a weighted mean cannot be, so the artifact mixes two runs")),
]


# ── resolve ──────────────────────────────────────────────────────────────


def load_artifact():
    if not os.path.exists(ARTIFACT):
        die(f"{ARTIFACT_REL} is missing.\n"
            f"      Recorded facts (coverage, Scorecard) have no source without it.\n"
            f"      Run: python3 tools/readme_facts.py --record")
    with open(ARTIFACT, encoding="utf-8") as fh:
        return json.load(fh)


def resolve():
    artifact = load_artifact()
    values = {}
    for fid, f in FACTS.items():
        if f["kind"] == "static":
            values[fid] = f["compute"]()
        else:
            rec = artifact.get("facts", {}).get(fid)
            if rec is None:
                die(f'fact "{fid}" is recorded, but {ARTIFACT_REL} has no entry for it.\n'
                    f"      Run: python3 tools/readme_facts.py --record")
            values[fid] = rec["value"]
    return values, artifact


# ── check / write ────────────────────────────────────────────────────────


def validate_sites():
    """Every site must have exactly one capture group and a file that exists.

    Checked before anything else runs. A two-group pattern does not fail
    loudly -- it silently compares the wrong digits, which is worse than a
    crash.
    """
    problems = []
    for fid, f in FACTS.items():
        for s in f["sites"]:
            try:
                groups = re.compile(s["pattern"]).groups
            except re.error as exc:
                problems.append(f"{fid}: {s['pattern']!r} is not a valid regex ({exc})")
                continue
            if groups != 1:
                problems.append(
                    f"{fid}: site {s['pattern']!r} has {groups} capture groups, "
                    f"must have exactly 1 (around the number)")
            if not os.path.exists(os.path.join(REPO, s["file"])):
                problems.append(f"{fid}: site names {s['file']}, which does not exist")
    if problems:
        sys.stderr.write("\n  The fact table itself is malformed:\n\n")
        for p in problems:
            sys.stderr.write(f"  x {p}\n")
        sys.stderr.write("\n")
        sys.exit(2)


def run(mode):
    validate_sites()
    values, artifact = resolve()
    problems = []
    rewrites = 0
    files = {}

    def load(rel):
        if rel not in files:
            files[rel] = {"text": read(rel), "dirty": False}
        return files[rel]

    def line_of(text, index):
        return text.count("\n", 0, index) + 1

    for fid, f in FACTS.items():
        expected = values[fid]
        for s in f["sites"]:
            entry = load(s["file"])
            matches = list(re.finditer(s["pattern"], entry["text"]))

            # The rule that makes this a checker and not a decoration.
            if not matches:
                problems.append(
                    f"{fid}: a claim site in {s['file']} matched NOTHING.\n"
                    f"      pattern  {s['pattern']}\n"
                    f"      The sentence was reworded and this fact is no longer verified\n"
                    f"      anywhere. Update the pattern in tools/readme_facts.py, or delete\n"
                    f"      the site if the claim is genuinely gone.")
                continue

            dp = f["decimals"] if s["decimals"] == "inherit" else s["decimals"]

            def wanted(found, _s=s, _dp=dp, _expected=expected):
                if isinstance(_expected, str) and not (_s["word"] or _s["ordinal"]):
                    return _expected          # version strings, commit hashes
                w = fmt(_expected, decimals=_dp, word=_s["word"],
                        ordinal=_s["ordinal"],
                        commas=("," in found) if _s["commas"] == "auto"
                        else bool(_s["commas"]))
                if (_s["word"] or _s["ordinal"]) and found[:1].isupper():
                    w = w.capitalize()
                return w

            if mode == "write":
                # Every rewrite shifts the offset of everything after it, so the
                # file is re-scanned after each edit instead of being edited from
                # a stale snapshot -- and the loop keeps going until the pattern
                # has no mismatches left. Stopping after the first hit would fix
                # one occurrence of a pattern that matches several, which is
                # precisely the failure this whole tool exists to catch: a
                # correction that reached three sites out of four. Several
                # patterns here genuinely match twice — `the ([\d,]+)-image MNIST
                # test set` appears in both the Overview and the Benchmarks
                # section — so this is a live case, not a hypothetical.
                converged = False
                for _ in range(500):
                    hit = next((mm for mm in
                                re.finditer(s["pattern"], entry["text"])
                                if mm.group(1) != wanted(mm.group(1))), None)
                    if hit is None:
                        converged = True
                        break
                    lo, hi = hit.span(1)
                    entry["text"] = (entry["text"][:lo] + wanted(hit.group(1))
                                     + entry["text"][hi:])
                    entry["dirty"] = True
                    rewrites += 1
                if not converged:
                    problems.append(
                        f"{fid}: --write did not converge on {s['file']}.\n"
                        f"      pattern  {s['pattern']}\n"
                        f"      The replacement it writes does not satisfy the pattern that\n"
                        f"      found it, so every pass re-edits the same text. Fix the site.")
                continue

            for m in matches:
                found = m.group(1)
                want = wanted(found)
                if found == want:
                    continue
                problems.append(
                    f"{fid}: {s['file']}:{line_of(entry['text'], m.start())} says "
                    f"{found}, but {f['describe']} is {want}.\n"
                    f"      context  {m.group(0).strip()[:100]}")

    for name, holds, explain in INVARIANTS:
        try:
            ok = holds(values)
        except KeyError as exc:
            problems.append(f"invariant '{name}' references a fact that no longer exists: {exc}")
            continue
        if not ok:
            problems.append(f"invariant broken -- {name}\n      {explain(values)}")

    # The README prints the date the Scorecard was read. That date is itself a
    # claim, so it is checked against the artifact rather than trusted:
    # otherwise the score can be refreshed while the date stays put, which
    # reads as more provenance than actually exists. It is also the only
    # defence against the failure mode this project cares about here -- a
    # third-party score quoted without saying when.
    readme = load(README)
    date_re = re.compile(r"read from `api\.scorecard\.dev` on \*\*(\d{4}-\d{2}-\d{2})\*\*")
    dm = date_re.search(readme["text"])
    recorded_at = artifact.get("facts", {}).get("scorecardScore", {}).get("readAt")
    if not dm:
        problems.append(
            f"the Scorecard read-date sentence no longer matches its pattern "
            f"({date_re.pattern}).\n"
            f"      A third-party score without its read date is a number with no provenance.")
    elif recorded_at is None:
        problems.append(f"{ARTIFACT_REL} records no readAt for scorecardScore.")
    elif dm.group(1) != recorded_at:
        if mode == "write":
            span = dm.span(1)
            readme["text"] = readme["text"][:span[0]] + recorded_at + readme["text"][span[1]:]
            readme["dirty"] = True
            rewrites += 1
        else:
            problems.append(
                f"README says the Scorecard was read on {dm.group(1)}, but "
                f"{ARTIFACT_REL} records {recorded_at}.")

    if mode == "write":
        written = []
        for rel, entry in files.items():
            if not entry["dirty"]:
                continue
            with open(os.path.join(REPO, rel), "w", encoding="utf-8") as fh:
                fh.write(entry["text"])
            written.append(rel)
        print("  v Everything already agrees with the source. Nothing rewritten."
              if rewrites == 0 else
              f"  v rewrote {rewrites} number{'' if rewrites == 1 else 's'} in "
              f"{', '.join(written)}.")
        if problems:
            sys.stderr.write("\n  Some problems cannot be fixed by rewriting a number:\n\n")
            for p in problems:
                sys.stderr.write(f"  x {p}\n\n")
            sys.exit(1)
        return

    if problems:
        sys.stderr.write(f"\n  The docs disagree with the code in {len(problems)} place(s):\n\n")
        for p in problems:
            sys.stderr.write(f"  x {p}\n\n")
        sys.stderr.write(
            "  Fix by re-running the source of truth, not by editing prose:\n"
            "    python3 tools/readme_facts.py --record   # if coverage or Scorecard moved\n"
            "    python3 tools/readme_facts.py --write    # then apply to the docs\n\n")
        sys.exit(1)

    n_sites = sum(len(f["sites"]) for f in FACTS.values())
    print(f"  v {len(FACTS)} facts, asserted at {n_sites} sites across {len(files)} file(s), "
          f"all agree with the code ({len(INVARIANTS)} invariants hold).")


# ── record ───────────────────────────────────────────────────────────────

COVERAGE_CMD = "tools/coverage.sh"
SCORECARD_URL = "https://api.scorecard.dev/projects/github.com/yadava5/glyph"

# llvm-cov's per-file table:
#   src/Matrix.cpp   205  21  89.76%  21  0  100.00%  301  23  92.36%  118  25  78.81%
COV_ROW = re.compile(
    r"^(\S+)\s+\d+\s+\d+\s+([\d.]+)%"      # regions
    r"\s+\d+\s+\d+\s+[\d.]+%"              # functions (not quoted anywhere)
    r"\s+\d+\s+\d+\s+([\d.]+)%"            # lines
    r"(?:\s+\d+\s+\d+\s+([\d.]+)%)?",      # branches -- absent for header-only files
    re.MULTILINE)

COV_FILE_TO_KEY = {
    "src/Matrix.cpp": "Matrix.cpp",
    "src/NeuralNet.cpp": "NeuralNet.cpp",
    "src/ServerApi.cpp": "ServerApi.cpp",
    "include/fast_mnist/NeuralNet.h": "NeuralNetH",
    "include/fast_mnist/Matrix.h": "MatrixH",
    "TOTAL": "Total",
}


def parse_coverage(out):
    rows = {}
    for m in COV_ROW.finditer(out):
        name = m.group(1)
        key = COV_FILE_TO_KEY.get(name)
        if key is None:
            continue
        rows[key] = {
            "Regions": float(m.group(2)),
            "Lines": float(m.group(3)),
            "Branches": float(m.group(4)) if m.group(4) else None,
        }
    missing = set(COV_FILE_TO_KEY.values()) - set(rows)
    if missing:
        raise RuntimeError(
            f"tools/coverage.sh produced no row for {sorted(missing)}. "
            f"An empty report from a green build is exactly the failure "
            f"tools/coverage.sh's own comment describes -- do not record it.")
    return rows


def parse_ctest(out):
    m = re.search(r"(\d+)% tests passed,\s*(\d+) tests failed out of (\d+)", out)
    if not m:
        raise RuntimeError("could not find ctest's pass/fail summary line")
    return {"passedPct": int(m.group(1)), "failed": int(m.group(2)),
            "total": int(m.group(3))}


def record():
    print(f"  -> {COVERAGE_CMD}")
    proc = subprocess.run(["bash", os.path.join(REPO, "tools/coverage.sh")],
                          cwd=REPO, capture_output=True, text=True)
    out = proc.stdout + proc.stderr
    # A red suite still has a real coverage number, and recording it is more
    # honest than refusing to -- see suiteOutcome below, which is why a green
    # artifact can never be mistaken for a green suite.
    rows = parse_coverage(out)
    ctest = parse_ctest(out)

    facts = {}
    for _key, _row_re, human, _dp, has_branches in COVERAGE_ROWS:
        for metric in ("Regions", "Lines", "Branches"):
            if metric == "Branches" and not has_branches:
                continue
            facts[f"coverage{_key}{metric}"] = {
                "value": rows[_key][metric],
                "command": f"{COVERAGE_CMD} ({human}, {metric.lower()})",
            }

    print(f"  -> GET {SCORECARD_URL}")
    try:
        with urllib.request.urlopen(SCORECARD_URL, timeout=30) as resp:
            sc = json.load(resp)
        read_at = (sc.get("date") or "")[:10] or date.today().isoformat()
        facts["scorecardScore"] = {
            "value": round(float(sc["score"]), 1),
            "command": f"GET {SCORECARD_URL}",
            "readAt": read_at,
            "note": "Third-party, recomputed weekly. --check NEVER fetches this; "
                    "a checker that reddens because someone else re-scored the "
                    "repo is a checker you learn to ignore.",
        }
        facts["scorecardVersion"] = {
            "value": sc.get("scorecard", {}).get("version", "").lstrip("v"),
            "command": f"GET {SCORECARD_URL}",
            "readAt": read_at,
        }
    except Exception as exc:  # noqa: BLE001
        prev = load_artifact().get("facts", {}) if os.path.exists(ARTIFACT) else {}
        if "scorecardScore" not in prev:
            raise RuntimeError(
                f"could not read the Scorecard ({exc}) and there is no previous "
                f"value to keep. Refusing to invent one.") from exc
        print(f"     ! Scorecard unreachable ({exc}); keeping the previous reading "
              f"and its date.")
        facts["scorecardScore"] = prev["scorecardScore"]
        facts["scorecardVersion"] = prev["scorecardVersion"]

    artifact = {
        "$comment": (
            "Recorded facts for README.md -- the figures that require executing "
            "something not in git. Regenerate with `python3 tools/readme_facts.py "
            "--record`, then apply with `--write`. Do not hand-edit: the point of "
            "this file is that these numbers have a command behind them. Figures "
            "that DO have a committed artifact (benchmarks/mnist_eval.json, "
            "docs/benchmarks/runs/*.json) are deliberately absent -- they are read "
            "from those files directly, so there is only ever one place for them "
            "to drift."),
        "recordedAt": date.today().isoformat(),
        "machine": f"{platform.system().lower()}-{platform.machine()}, "
                   f"python {platform.python_version()}",
        "facts": facts,
        # Recorded but deliberately NOT asserted anywhere in the README. A green
        # artifact must not be mistakable for a green suite: --record keeps the
        # coverage figures from a failing run on purpose, so without this block
        # a red suite and a clean one would leave identical files behind.
        "suiteOutcome": {
            "command": COVERAGE_CMD,
            "ctest": ctest,
            "allGreen": ctest["failed"] == 0 and ctest["total"] > 0,
            "coverageExitCode": proc.returncode,
        },
    }
    with open(ARTIFACT, "w", encoding="utf-8") as fh:
        json.dump(artifact, fh, indent=2)
        fh.write("\n")
    print(f"\n  v wrote {ARTIFACT_REL} (recorded {artifact['recordedAt']})")
    if not artifact["suiteOutcome"]["allGreen"]:
        print("    ! the suite was NOT green during this run -- the coverage figures "
              "are real but they describe a failing build.")
    print("    Now run: python3 tools/readme_facts.py --write")


# ── main ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "--check"
    if arg == "--record":
        record()
    elif arg == "--write":
        run("write")
    elif arg == "--check":
        run("check")
    else:
        sys.stderr.write(f"unknown option {arg}\n"
                         f"usage: readme_facts.py [--check|--write|--record]\n")
        sys.exit(2)
