#!/usr/bin/env python3
"""Pack the 299 digits the network gets wrong into a committed browser artifact.

`benchmarks/mnist_misclassified.csv` lists every one of the 299 test images the
committed model misclassifies, with its true label, the prediction, and both
activations. What it does not carry is the images — those live in `data/`, which
is gitignored and 831 MB, so the page can name its failures but cannot show
them.

This packs exactly those 299 images into one binary the browser can fetch:
299 × 784 unsigned bytes, row-major, no header, in CSV row order. At 28×28 grey
that is 234,416 bytes raw and roughly a quarter of that gzipped, because MNIST
digits are mostly background.

Showing the failures is the point. A page that publishes 97.01% and shows ten
cherry-picked successes is advertising; one that hands you all 299 of its
mistakes, in full, is making a checkable claim about its own limits.

    python3 tools/export_failures.py --write
    python3 tools/export_failures.py --check    # digests still match

Provenance: the images are MNIST test digits, unmodified, from the same
`data/TestingSet/` the committed evaluation read. The manifest records the
sha256 of the pack and of the CSV it was built from, so the pack cannot drift
from the record it illustrates.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "benchmarks/mnist_misclassified.csv"
DATA = ROOT / "data"
OUT_DIR = ROOT / "web/public/failures"
PACK = OUT_DIR / "misclassified.bin"
MANIFEST = OUT_DIR / "misclassified.json"

SIDE = 28
PIXELS = SIDE * SIDE


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def read_pgm(path: pathlib.Path) -> bytes:
    """Read a P2 (ASCII) PGM and return 784 raw bytes.

    The dataset ships plain-text PGM, which is why this is not a memcpy. The
    header is `P2 / W H / maxval`, whitespace-separated, and comment lines start
    with '#'. Anything that is not 28×28 with maxval 255 is a hard error rather
    than something to rescale quietly — a silently resized digit would be a
    fabricated exhibit.
    """
    tokens: list[str] = []
    for line in path.read_text().splitlines():
        line = line.split("#", 1)[0]
        tokens.extend(line.split())
    if not tokens or tokens[0] != "P2":
        raise SystemExit(f"{path}: not an ASCII PGM (magic {tokens[:1]})")
    width, height, maxval = int(tokens[1]), int(tokens[2]), int(tokens[3])
    if (width, height, maxval) != (SIDE, SIDE, 255):
        raise SystemExit(f"{path}: expected {SIDE}x{SIDE} maxval 255, got {width}x{height} {maxval}")
    values = [int(t) for t in tokens[4 : 4 + PIXELS]]
    if len(values) != PIXELS:
        raise SystemExit(f"{path}: expected {PIXELS} samples, found {len(values)}")
    return bytes(values)


def rows() -> list[dict[str, str]]:
    with CSV_PATH.open() as fh:
        return list(csv.DictReader(fh))


def build() -> tuple[bytes, dict]:
    entries = rows()
    blob = bytearray()
    manifest_rows = []
    for r in entries:
        rel = r["file"]
        path = DATA / rel
        if not path.exists():
            raise SystemExit(
                f"{path} is missing. data/ is gitignored (831 MB); this tool has to be "
                f"run on a machine with the MNIST test set staged."
            )
        blob.extend(read_pgm(path))
        manifest_rows.append(
            {
                "index": int(r["index"]),
                "true": int(r["true"]),
                "pred": int(r["pred"]),
                "predActivation": float(r["pred_activation"]),
                "trueActivation": float(r["true_activation"]),
            }
        )

    pack = bytes(blob)
    manifest = {
        "$comment": (
            "Every MNIST test digit the committed model gets wrong, packed for the web. "
            "Written by tools/export_failures.py from benchmarks/mnist_misclassified.csv "
            "and data/TestingSet/. Images are unmodified MNIST test digits."
        ),
        "count": len(manifest_rows),
        "side": SIDE,
        "bytesPerImage": PIXELS,
        "layout": "row-major uint8, one image after another, in the order of `entries`",
        "pack": "misclassified.bin",
        "packBytes": len(pack),
        "packSha256": sha256_bytes(pack),
        "sourceCsv": "benchmarks/mnist_misclassified.csv",
        "sourceCsvSha256": sha256_bytes(CSV_PATH.read_bytes()),
        "entries": manifest_rows,
    }
    return pack, manifest


def check() -> int:
    if not PACK.exists() or not MANIFEST.exists():
        print("MISSING web/public/failures/ — run tools/export_failures.py --write", file=sys.stderr)
        return 1
    manifest = json.loads(MANIFEST.read_text())
    pack = PACK.read_bytes()
    problems = []
    if len(pack) != manifest["packBytes"]:
        problems.append(f"pack is {len(pack)} bytes, manifest says {manifest['packBytes']}")
    if sha256_bytes(pack) != manifest["packSha256"]:
        problems.append("pack sha256 disagrees with the manifest")
    if sha256_bytes(CSV_PATH.read_bytes()) != manifest["sourceCsvSha256"]:
        problems.append(
            "benchmarks/mnist_misclassified.csv has changed since the pack was built — "
            "re-run tools/export_failures.py --write on a machine with data/ staged"
        )
    if len(manifest["entries"]) * PIXELS != len(pack):
        problems.append("entry count and pack length disagree")
    if problems:
        for p in problems:
            print(f"  x {p}", file=sys.stderr)
        return 1
    print(
        f"OK web/public/failures — {manifest['count']} misclassified digits, "
        f"{len(pack):,} bytes, digests match the committed record"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--write", action="store_true")
    g.add_argument("--check", action="store_true")
    args = ap.parse_args()

    if args.check:
        return check()

    pack, manifest = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PACK.write_bytes(pack)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    import gzip

    gz = len(gzip.compress(pack, compresslevel=9, mtime=0))
    print(f"wrote {PACK.relative_to(ROOT)} — {manifest['count']} images, {len(pack):,} bytes "
          f"({gz:,} gzipped, {100 * gz / len(pack):.0f}%)")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
