#!/usr/bin/env python3
"""Verify the evaluation studies still describe the files they were run against.

`benchmarks/mnist_eval_wasm.json` and `benchmarks/mnist_f32_flips.json` each
record the sha256 of every input they consumed — the wasm module, its glue, both
weight files, and the native reference record. Recording a digest is only half a
gate, though: something has to compare it. Without this, rebuilding
`fast_mnist.wasm` would leave both studies quietly describing a binary that no
longer exists, which is the exact defect shape `tools/wasm_census.py --check`
was written to prevent for the census.

Stdlib only, no network, no build. Runs in CI.

    python3 tools/check_eval_artifacts.py
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Each study, and the key under which it records its input digests. Both use the
# same `{name: {path, sha256}}` shape.
STUDIES = [
    ("benchmarks/mnist_eval_wasm.json", "artifacts"),
    ("benchmarks/mnist_f32_flips.json", "weights"),
]


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_study(rel: str, key: str) -> list[str]:
    study_path = ROOT / rel
    if not study_path.exists():
        return [f"{rel} is missing"]
    study = json.loads(study_path.read_text())
    recorded = study.get(key)
    if not isinstance(recorded, dict):
        return [f"{rel}: no `{key}` object — the schema changed and this gate is now blind"]

    problems: list[str] = []
    checked = 0
    for name, entry in recorded.items():
        if not isinstance(entry, dict):
            continue
        path, want = entry.get("path"), entry.get("sha256")
        if not path or not want:
            continue
        target = ROOT / path
        if not target.exists():
            problems.append(f"{rel}: {name} -> {path} does not exist")
            continue
        got = sha256(target)
        checked += 1
        if got != want:
            problems.append(
                f"{rel}: {name} ({path}) has changed since the study ran\n"
                f"      recorded {want}\n"
                f"      actual   {got}\n"
                f"      Re-run the study; its conclusions describe the old file."
            )
    if checked == 0:
        # A gate that verifies nothing passes for the wrong reason.
        problems.append(f"{rel}: `{key}` recorded no path+sha256 pairs — nothing was verified")
    elif not problems:
        print(f"OK {rel} — {checked} input digest(s) still match")
    return problems


def main() -> int:
    problems: list[str] = []
    for rel, key in STUDIES:
        problems.extend(check_study(rel, key))
    if problems:
        print("\nEvaluation studies no longer describe their inputs:\n", file=sys.stderr)
        for p in problems:
            print(f"  x {p}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
