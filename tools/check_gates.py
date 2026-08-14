#!/usr/bin/env python3
"""Prove every gate in this repository can actually fail.

A green check means one of two things and they are indistinguishable from the
outside: the thing it watches is correct, or the check stopped watching. This
repository has now been bitten by the second one four times in a single day:

  * a Playwright selector scoped to `header [aria-label*=...]` that matched
    zero elements, and had therefore been passing vacuously for its whole life;
  * an assertion of /\\d/ against a line rendering the text "simd128", which
    contains a digit and so could never fail;
  * a canvas-ink assertion that read a canvas it had never scrolled into view,
    so it could never PASS - the same defect with the sign flipped;
  * and the naive fix for that one, which would have tripped the suite's own
    console gate through its repeated getImageData calls.

None of those was caught by running the checks. They cannot be: a check that
does nothing and a check that passes look identical in a green log. The only
evidence that a check works is watching it fail on demand.

So this gate breaks things on purpose. For each checker in tools/, it takes
the artifact that checker claims to protect, corrupts it in one surgical way,
runs the checker, and REQUIRES a non-zero exit. Then it restores the file and
verifies the restoration byte-for-byte by sha256. A checker that stays green
while its subject is corrupt is not a checker, and this fails.

Every mutation is chosen to be the smallest edit that should offend exactly
one gate, and each declares in prose what its red proves. That prose is the
point: `gen_web_facts` going red when a generated number changes is evidence
the landing page cannot quote a run the repository has moved off.

Stdlib only, no network, no build. Restores in a finally block and on SIGINT,
and refuses to report success if any file came back different from how it
started.

    python3 tools/check_gates.py            # all gates
    python3 tools/check_gates.py --list     # what would run, and what it proves
    python3 tools/check_gates.py -k census  # only gates matching a substring
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import signal
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Callable

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Files currently held open by an in-flight mutation, so the signal handler can
# put them back if someone interrupts mid-run.
_OPEN: dict[pathlib.Path, bytes | None] = {}


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _restore_all() -> None:
    for path, original in list(_OPEN.items()):
        try:
            if original is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(original)
        except OSError as exc:  # pragma: no cover - best effort on the way out
            print(f"  !! could not restore {path}: {exc}", file=sys.stderr)
    _OPEN.clear()


def _on_signal(signum, _frame):  # pragma: no cover - interrupt path
    print("\ninterrupted - restoring mutated files", file=sys.stderr)
    _restore_all()
    sys.exit(130)


# ---------------------------------------------------------------- mutations


def poke_json(rel: str, mutate: Callable[[dict], str]) -> Callable[[], str]:
    """Load a JSON file, let `mutate` change it in place, write it back.

    `mutate` returns a human description of the edit, so the report says what
    was broken rather than just that something was.
    """

    def apply() -> str:
        path = ROOT / rel
        doc = json.loads(path.read_text())
        what = mutate(doc)
        path.write_text(json.dumps(doc, indent=2) + "\n")
        return what

    return apply


def poke_text(rel: str, pattern: str, replace: Callable[[re.Match], str]) -> Callable[[], str]:
    def apply() -> str:
        path = ROOT / rel
        text = path.read_text()
        m = re.search(pattern, text)
        if m is None:
            raise LookupError(
                f"{rel}: mutation pattern {pattern!r} matched nothing. The file's shape "
                f"changed, so this gate is no longer being proven - fix the mutation."
            )
        new = text[: m.start()] + replace(m) + text[m.end() :]
        path.write_text(new)
        return f"{rel}: {m.group(0)!r} -> {replace(m)!r}"

    return apply


def create_file(rel: str, content: str, note: str) -> Callable[[], str]:
    def apply() -> str:
        path = ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return f"created {rel} - {note}"

    return apply


def _first_fact_value(doc: dict) -> str:
    for name, entry in doc["facts"].items():
        if isinstance(entry, dict) and isinstance(entry.get("value"), (int, float)):
            before = entry["value"]
            entry["value"] = round(before + 1.5, 4)
            return f"docs/readme-facts.json: facts.{name}.value {before} -> {entry['value']}"
    raise LookupError("no numeric fact found to corrupt - schema changed")


def _drop_a_needed_lock_entry(doc: dict) -> str:
    """Remove a package that something else depends on, the way a macOS
    `npm install` silently prunes Linux-only optional peers."""
    pkgs = doc["packages"]
    needed: set[str] = set()
    for meta in pkgs.values():
        if isinstance(meta, dict):
            for field_name in ("dependencies", "peerDependencies"):
                for dep in (meta.get(field_name) or {}):
                    needed.add(f"node_modules/{dep}")
    for key in sorted(needed):
        if key in pkgs:
            del pkgs[key]
            return f"web/package-lock.json: removed {key}, which other packages depend on"
    raise LookupError("no removable dependency target found - lock schema changed")


def _corrupt_an_eval_digest(doc: dict) -> str:
    for name, entry in doc["artifacts"].items():
        if isinstance(entry, dict) and entry.get("sha256"):
            before = entry["sha256"]
            entry["sha256"] = ("0" * 8) + before[8:]
            return f"benchmarks/mnist_eval_wasm.json: artifacts.{name}.sha256 first 8 chars zeroed"
    raise LookupError("no recorded sha256 found - study schema changed")


# A codepoint no subset built from this repo's own source could contain, used
# to prove the font gate notices a character the shipped fonts cannot draw.
UNCOVERED_GLYPH = "中"


@dataclass
class Gate:
    name: str
    cmd: list[str]
    proves: str
    touches: list[str]
    mutate: Callable[[], str]
    skip_if_missing: str | None = field(default=None)


GATES: list[Gate] = [
    Gate(
        name="readme_facts",
        cmd=["python3", "tools/readme_facts.py", "--check"],
        proves="the prose numbers are compared against the recorded artifacts, "
        "not merely present",
        touches=["docs/readme-facts.json"],
        mutate=poke_json("docs/readme-facts.json", _first_fact_value),
    ),
    Gate(
        name="gen_web_facts",
        cmd=["python3", "tools/gen_web_facts.py", "--check"],
        proves="the landing page cannot go on quoting a benchmark run the "
        "repository has moved off",
        touches=["web/src/features/performance/benchRuns.generated.ts"],
        mutate=poke_text(
            "web/src/features/performance/benchRuns.generated.ts",
            r"(?<=[:\s])\d{4,}(?=[,\s\n])",
            lambda m: str(int(m.group(0)) + 7),
        ),
    ),
    Gate(
        name="check_lockfile",
        cmd=["python3", "tools/check_lockfile.py"],
        proves="a lockfile missing a package some other package needs is "
        "caught here rather than by a red CI three pushes later",
        touches=["web/package-lock.json"],
        mutate=poke_json("web/package-lock.json", _drop_a_needed_lock_entry),
    ),
    Gate(
        name="wasm_census",
        cmd=["python3", "tools/wasm_census.py", "--check"],
        proves="a rebuilt module cannot leave a stale instruction count on the page",
        touches=["docs/benchmarks/wasm-simd-census.json"],
        mutate=poke_json(
            "docs/benchmarks/wasm-simd-census.json",
            lambda d: (
                f"docs/benchmarks/wasm-simd-census.json: totalVectorInstructions "
                f"{d['totalVectorInstructions']} -> {d.__setitem__('totalVectorInstructions', d['totalVectorInstructions'] + 1) or d['totalVectorInstructions']}"
            ),
        ),
    ),
    Gate(
        name="export_failures",
        cmd=["python3", "tools/export_failures.py", "--check"],
        proves="the 299 digits the page draws still match the evaluation record "
        "they illustrate",
        touches=["web/public/failures/misclassified.json"],
        mutate=poke_text(
            "web/public/failures/misclassified.json",
            r"\d+",
            lambda m: str(int(m.group(0)) + 1),
        ),
    ),
    Gate(
        name="check_eval_artifacts",
        cmd=["python3", "tools/check_eval_artifacts.py"],
        proves="the evaluation studies still describe the exact binaries they ran against",
        touches=["benchmarks/mnist_eval_wasm.json"],
        mutate=poke_json("benchmarks/mnist_eval_wasm.json", _corrupt_an_eval_digest),
    ),
    Gate(
        name="subset_fonts",
        cmd=["python3", "tools/subset_fonts.py", "--check"],
        proves="a character the shipped subset cannot draw is caught before it "
        "renders as a tofu box in production",
        touches=["web/src/__gate_probe__.tsx"],
        mutate=create_file(
            "web/src/__gate_probe__.tsx",
            f"export const probe = '{UNCOVERED_GLYPH}';\n",
            "a source file setting a character no subset of this repo covers",
        ),
        skip_if_missing="fontTools",
    ),
]


def run(cmd: list[str]) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def have_fonttools() -> bool:
    return run([sys.executable, "-c", "import fontTools"])[0] == 0


def check_gate(gate: Gate) -> tuple[str, str]:
    """Returns (status, detail). status is one of OK / CANNOT-FAIL / BROKEN / SKIP."""
    if gate.skip_if_missing == "fontTools" and not have_fonttools():
        return "SKIP", "fontTools is not installed, so this gate was not proven"

    # Control: the gate must be satisfied right now, or a red under mutation
    # proves nothing - it would have been red anyway.
    code, out = run(gate.cmd)
    if code != 0:
        return "BROKEN", f"already failing on a clean tree, so it cannot be tested:\n{out[:400]}"

    paths = [ROOT / rel for rel in gate.touches]
    for path in paths:
        _OPEN[path] = path.read_bytes() if path.exists() else None
    before = {p: _OPEN[p] for p in paths}

    try:
        what = gate.mutate()
        code, _ = run(gate.cmd)
    finally:
        _restore_all()

    for path, original in before.items():
        now = path.read_bytes() if path.exists() else None
        if now != original:
            return "BROKEN", f"{path} was NOT restored correctly - repository may be dirty"

    if code == 0:
        return "CANNOT-FAIL", f"stayed green while {what}"
    return "OK", what


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--list", action="store_true", help="show gates and what each proves")
    ap.add_argument("-k", metavar="SUBSTR", help="only gates whose name contains SUBSTR")
    ap.add_argument(
        "--allow-skip",
        action="append",
        default=[],
        metavar="NAME",
        help="tolerate a gate that cannot run here (e.g. missing fontTools)",
    )
    args = ap.parse_args()

    gates = [g for g in GATES if not args.k or args.k in g.name]
    if not gates:
        print(f"no gate matches {args.k!r}", file=sys.stderr)
        return 2

    if args.list:
        for g in gates:
            print(f"{g.name}\n    proves: {g.proves}\n    breaks: {', '.join(g.touches)}")
        return 0

    signal.signal(signal.SIGINT, _on_signal)
    signal.signal(signal.SIGTERM, _on_signal)

    failures: list[str] = []
    skipped: list[str] = []
    print(f"Proving {len(gates)} gate(s) can fail\n")
    for gate in gates:
        status, detail = check_gate(gate)
        if status == "OK":
            print(f"  v {gate.name:22} went red on demand")
            print(f"      {detail}")
            print(f"      so: {gate.proves}")
        elif status == "SKIP":
            print(f"  - {gate.name:22} SKIPPED - {detail}")
            skipped.append(gate.name)
        else:
            print(f"  x {gate.name:22} {status}")
            print(f"      {detail}")
            failures.append(f"{gate.name}: {status} - {detail}")
        print()

    for name in skipped:
        if name not in args.allow_skip:
            failures.append(
                f"{name}: skipped without --allow-skip {name}. A gate that is quietly "
                f"not proven is exactly the problem this script exists to find."
            )

    if failures:
        print("Gates that are not proven to work:\n", file=sys.stderr)
        for f in failures:
            print(f"  x {f}", file=sys.stderr)
        return 1

    proven = len(gates) - len(skipped)
    print(f"  v all {proven} gate(s) failed when their subject was corrupted, and "
          f"every file was restored byte-for-byte.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
