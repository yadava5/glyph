#!/usr/bin/env python3
"""Emit the web frontend's benchmark numbers from the committed run records.

The landing page used to carry hand-typed copies of benchmark figures. That is
how it ended up quoting a December MacBook Air run months after
`docs/benchmarks/ENVIRONMENT.md` designated a different machine as the
reference: a typed number has no link back to the artifact it came from, so
nothing notices when the artifact is superseded.

This script is that link. It reads the Google Benchmark JSON in
`docs/benchmarks/runs/` and writes `web/src/features/performance/benchRuns.generated.ts`,
which the frontend imports. Every displayed figure is derived from those files
at build time by `benchDerive.ts`, so the page cannot claim a number the
repository does not contain.

    python3 tools/gen_bench_display.py            # rewrite the generated file
    python3 tools/gen_bench_display.py --check    # fail if it would change

`--check` runs in CI. It is the reason a stale figure becomes a red build
rather than something a reader has to catch.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUNS = ROOT / "docs/benchmarks/runs"
OUT = ROOT / "web/src/features/performance/benchRuns.generated.ts"

# The one thing the JSON does not record. Google Benchmark's `context` carries
# core count, cache sizes and load average but not the CPU model, so the model
# names below are transcribed from docs/benchmarks/ENVIRONMENT.md (reference)
# and BENCHMARKS.md#environment (December). Everything else on this page is
# read out of the artifacts.
MACHINES = {
    "20260802-aggregated": "Apple M1 Pro · MacBook Pro 16″",
    "20260802-dot20x": "Apple M1 Pro · MacBook Pro 16″",
    "20251226-154121": "Apple M2 · MacBook Air (fanless)",
}

# id -> (stamp, [configs]). Order is the order they appear in the TS file.
WANTED = [
    ("reference", "20260802-aggregated", ["baseline", "openmp-native"]),
    ("dot20x", "20260802-dot20x", ["baseline", "openmp-native"]),
    ("december", "20251226-154121", ["baseline", "native", "openmp-native"]),
]

CONFIG_KEY = {"baseline": "baselineNs", "native": "nativeNs", "openmp-native": "ompNs"}
CV_KEY = {"baseline": "cvBaseline", "openmp-native": "cvOmp"}


def read_run(stamp: str, config: str) -> dict[str, Any]:
    return json.loads((RUNS / f"bench-{stamp}-{config}.json").read_text())


def series(doc: dict[str, Any]) -> tuple[dict[str, float], dict[str, float], int]:
    """Return (median real_time by case, cv by case, repetitions).

    A single-repetition record has no aggregates, so its per-iteration rows are
    the medians by definition and there is no spread to report. A repeated run
    reports `_median` and `_cv` and those are used verbatim — this never
    re-derives a statistic Google Benchmark already computed.
    """
    aggregates = {b["name"]: b for b in doc["benchmarks"] if b.get("run_type") == "aggregate"}
    if aggregates:
        medians = {
            name[: -len("_median")]: b["real_time"]
            for name, b in aggregates.items()
            if name.endswith("_median")
        }
        cvs = {
            name[: -len("_cv")]: b["real_time"]
            for name, b in aggregates.items()
            if name.endswith("_cv")
        }
        reps = max(b.get("repetitions", 1) for b in doc["benchmarks"])
        return medians, cvs, reps
    rows = [b for b in doc["benchmarks"] if b.get("run_type", "iteration") == "iteration"]
    return {b["name"]: b["real_time"] for b in rows}, {}, 1


def build_run(run_id: str, stamp: str, configs: list[str]) -> dict[str, Any]:
    docs = {c: read_run(stamp, c) for c in configs}
    ctx = docs["baseline"]["context"]

    cases: dict[str, dict[str, Any]] = {}
    reps_seen: set[int] = set()
    for config, doc in docs.items():
        medians, cvs, reps = series(doc)
        reps_seen.add(reps)
        for name, ns in medians.items():
            case = cases.setdefault(name, {"baselineNs": None, "nativeNs": None, "ompNs": None})
            case[CONFIG_KEY[config]] = round(ns, 1)
            if config in CV_KEY and name in cvs:
                case[CV_KEY[config]] = round(cvs[name] * 100, 2)

    if len(reps_seen) != 1:
        raise SystemExit(f"{stamp}: configs disagree on repetition count: {sorted(reps_seen)}")

    l1d = next((c["size"] for c in ctx.get("caches", []) if c["level"] == 1 and c["type"] == "Data"), None)
    l2 = next((c["size"] for c in ctx.get("caches", []) if c["level"] == 2), None)

    return {
        "id": run_id,
        "stamp": stamp,
        "dateISO": ctx["date"],
        "machine": MACHINES[stamp],
        "cores": ctx["num_cpus"],
        "reps": reps_seen.pop(),
        "loadAvg": [round(x, 2) for x in ctx["load_avg"]] if ctx.get("load_avg") else None,
        "l1dBytes": l1d,
        "l2Bytes": l2,
        "benchmarkVersion": ctx.get("library_version"),
        "configs": configs,
        "artifacts": [f"docs/benchmarks/runs/bench-{stamp}-{c}.json" for c in configs],
        "cases": dict(sorted(cases.items())),
    }


def ts_value(v: Any, indent: int) -> str:
    pad = "  " * indent
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, str):
        return json.dumps(v)
    if isinstance(v, list):
        if all(isinstance(x, (int, float)) for x in v):
            return "[" + ", ".join(repr(x) for x in v) + "]"
        inner = ",\n".join(f"{pad}  {ts_value(x, indent + 1)}" for x in v)
        return "[\n" + inner + f"\n{pad}]"
    if isinstance(v, dict):
        rows = []
        for k, val in v.items():
            key = k if k.isidentifier() else json.dumps(k)
            rows.append(f"{pad}  {key}: {ts_value(val, indent + 1)}")
        return "{\n" + ",\n".join(rows) + f"\n{pad}}}"
    raise TypeError(type(v))


def render(runs: list[dict[str, Any]]) -> str:
    head = '''/*
 * GENERATED FILE — do not edit by hand.
 *
 * Written by `tools/gen_bench_display.py` from the Google Benchmark JSON
 * committed under `docs/benchmarks/runs/`. Every number below is a
 * `real_time` median read straight out of one of those files, and every
 * figure the page displays is derived from these by `benchDerive.ts` — so a
 * displayed number cannot drift from the artifact it claims to come from.
 *
 * Regenerate:  python3 tools/gen_bench_display.py
 * CI gate:     python3 tools/gen_bench_display.py --check
 *
 * `ns` values are wall-clock nanoseconds per iteration. `cv*` values are the
 * coefficient of variation as a percentage, reported by Google Benchmark for
 * repeated runs; a single-repetition record has no spread and reports null.
 */

export interface BenchCase {
  /** Wall-clock ns/op, no `-march=native`, no OpenMP. */
  baselineNs: number;
  /** `-march=native`, no OpenMP. Only the December run measured this config. */
  nativeNs: number | null;
  /** `-march=native` + OpenMP. */
  ompNs: number;
  /** Coefficient of variation, %, baseline config. */
  cvBaseline?: number;
  /** Coefficient of variation, %, openmp+native config. */
  cvOmp?: number;
}

export interface BenchRun {
  id: string;
  /** Run stamp — the filename infix under docs/benchmarks/runs/. */
  stamp: string;
  dateISO: string;
  /** From ENVIRONMENT.md; the JSON records cores and caches but not the model. */
  machine: string;
  cores: number;
  /** Google Benchmark repetitions per case. */
  reps: number;
  /** 1/5/15-minute load average at the start of the run, if recorded. */
  loadAvg: number[] | null;
  l1dBytes: number | null;
  l2Bytes: number | null;
  benchmarkVersion: string | null;
  configs: string[];
  /** Repo-relative paths a reader can open to check any number here. */
  artifacts: string[];
  cases: Record<string, BenchCase>;
}

'''
    body = []
    for run in runs:
        body.append(f"export const {run['id']}Run: BenchRun = {ts_value(run, 0)};\n")
    # No aggregate `RUNS` map: a dynamic index into one would pin every run
    # into the bundle. Named exports let the bundler drop a run the page does
    # not read, which is the difference between shipping one record and three.
    tail = (
        "/** The run the repository designates canonical — see docs/benchmarks/ENVIRONMENT.md. */\n"
        "export const referenceRunId = "
        + json.dumps(runs[0]["id"])
        + " as const;\n"
    )
    return head + "\n".join(body) + "\n" + tail


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="exit 1 if the file is stale")
    args = ap.parse_args()

    runs = [build_run(rid, stamp, cfgs) for rid, stamp, cfgs in WANTED]
    text = render(runs)

    if args.check:
        if not OUT.exists():
            print(f"MISSING {OUT.relative_to(ROOT)} — run tools/gen_bench_display.py", file=sys.stderr)
            return 1
        current = OUT.read_text()
        if current != text:
            print(
                f"STALE {OUT.relative_to(ROOT)} — it no longer matches the committed run\n"
                f"records. Run `python3 tools/gen_bench_display.py` and commit the result.",
                file=sys.stderr,
            )
            import difflib

            diff = difflib.unified_diff(
                current.splitlines(keepends=True),
                text.splitlines(keepends=True),
                fromfile="committed",
                tofile="regenerated",
                n=2,
            )
            sys.stderr.writelines(list(diff)[:80])
            return 1
        print(f"OK {OUT.relative_to(ROOT)} matches the committed run records")
        return 0

    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)} — {len(runs)} runs")
    for run in runs:
        print(f"  {run['id']:<10} {run['stamp']:<22} {len(run['cases']):>2} cases, {run['reps']} rep(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
