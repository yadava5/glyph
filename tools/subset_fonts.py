#!/usr/bin/env python3
"""Subset the self-hosted web fonts to the characters this site actually sets.

`web/public/fonts/` shipped the full Geist and Geist Mono variable faces: 726
and 887 codepoints, including Cyrillic, Greek and the full combining-diacritics
block, for a page written in English with a handful of maths symbols. Fonts
block text rendering, so that is the most expensive kind of dead weight.

The character set is **derived, not guessed**. It is the union of:

  * every character appearing in the site's own sources — `web/src/**` (ts, tsx,
    css), `web/index.html` and the generated benchmark data, which is where the
    ×, →, ≥, ÷, µ, ″ and · come from; and
  * a base set of printable ASCII plus the Latin-1 letters and typographic
    punctuation a text face is expected to carry.

Guessing here fails silently and visibly: a missing glyph is a tofu box in
production and nothing in the build notices. So `--check` re-reads the installed
fonts and fails if any required character is absent, and that runs in CI.

    python3 tools/subset_fonts.py --write    # subset in place, print savings
    python3 tools/subset_fonts.py --check    # fail if a needed glyph is missing

Requires fonttools with the woff2 extra (`pip install 'fonttools[woff2]'`).
"""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "web/public/fonts"
SOURCE_DIRS = [ROOT / "web/src"]
SOURCE_FILES = [ROOT / "web/index.html"]
SOURCE_SUFFIXES = {".ts", ".tsx", ".css", ".html"}

FONTS = [
    "Geist-Variable.woff2",
    "GeistMono-Variable.woff2",
    "InstrumentSerif-Regular.woff2",
    "InstrumentSerif-Italic.woff2",
]

# Printable ASCII, the Latin-1 letters, and the punctuation a text face is
# expected to carry whether or not it happens to appear in source today. Keeping
# these costs a few hundred bytes and avoids a tofu the moment someone types a
# curly quote.
BASE = (
    set(range(0x20, 0x7F))
    | set(range(0xA0, 0x100))
    | {
        0x2013, 0x2014,          # en dash, em dash
        0x2018, 0x2019,          # curly single quotes
        0x201C, 0x201D,          # curly double quotes
        0x2026,                  # ellipsis
        0x2032, 0x2033,          # prime, double prime (the 16″ in the machine name)
        0x2039, 0x203A,          # single guillemets
        0x2212,                  # true minus
        0x00A0,                  # nbsp
    }
)


# Characters the scan finds but the page never sets in these faces. Each one is
# here with its reason, because a silent exclusion list is how a real tofu gets
# waved through. Verified 2026-08-13 by grepping every occurrence.
EXCLUDED = {
    0x00AD: "soft hyphen — an invisible line-break hint, not a glyph",
    0x2318: "⌘ — only in title= attributes, which the OS renders, not the page",
    0x21E7: "⇧ — same, DrawingCanvas undo/redo tooltips",
    0x2500: "─ — CSS/TS comment section rules, never rendered",
    0x2502: "│ — same",
    0x250C: "┌ — same",
    0x2510: "┐ — same",
    0x2514: "└ — same",
    0x2518: "┘ — same",
}


def source_chars() -> set[int]:
    """Every character in the site's own sources.

    Deliberately not restricted to string literals. Over-inclusion costs a few
    bytes; under-inclusion ships a broken glyph, and a regex that tries to find
    "only the strings" in TSX is a source of exactly that kind of miss.
    """
    chars: set[int] = set()
    files = list(SOURCE_FILES)
    for d in SOURCE_DIRS:
        files.extend(p for p in d.rglob("*") if p.suffix in SOURCE_SUFFIXES)
    for path in files:
        chars |= {ord(c) for c in path.read_text(encoding="utf-8")}
    # Control characters are not glyphs.
    return {c for c in chars if c >= 0x20}


def required() -> set[int]:
    return (BASE | source_chars()) - set(EXCLUDED)


def installed_coverage(path: pathlib.Path) -> set[int]:
    from fontTools.ttLib import TTFont

    font = TTFont(path, fontNumber=0)
    covered: set[int] = set()
    for table in font["cmap"].tables:
        covered |= set(table.cmap.keys())
    return covered


def has_axes(path: pathlib.Path) -> list[str]:
    from fontTools.ttLib import TTFont

    font = TTFont(path, fontNumber=0)
    return [a.axisTag for a in font["fvar"].axes] if "fvar" in font else []


def check() -> int:
    need = required()
    failed = False
    for name in FONTS:
        path = FONT_DIR / name
        if not path.exists():
            print(f"MISSING {path.relative_to(ROOT)}", file=sys.stderr)
            failed = True
            continue
        covered = installed_coverage(path)
        # Instrument Serif is a display accent used for a handful of words, not
        # a text face; it never carried the full set and is not expected to.
        if name.startswith("InstrumentSerif"):
            print(f"  skip {name} (display accent, partial coverage by design)")
            continue
        missing = sorted(need - covered)
        if missing:
            failed = True
            shown = " ".join(f"U+{c:04X}({chr(c)!r})" for c in missing[:14])
            print(
                f"{name}: {len(missing)} required character(s) missing — {shown}"
                f"{' …' if len(missing) > 14 else ''}",
                file=sys.stderr,
            )
        else:
            print(f"  ok {name}: covers all {len(need)} required characters, axes={has_axes(path)}")
    return 1 if failed else 0


def write() -> int:
    need = sorted(required())
    unicodes = ",".join(f"U+{c:04X}" for c in need)
    total_before = total_after = 0
    for name in FONTS:
        path = FONT_DIR / name
        before = path.stat().st_size
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / name
            cmd = [
                sys.executable, "-m", "fontTools.subset", str(path),
                f"--unicodes={unicodes}",
                "--flavor=woff2",
                f"--output-file={out}",
                # The features the stylesheet actually asks for, plus the ones a
                # browser applies without being asked. `tnum` is load-bearing:
                # base.css sets `font-variant-numeric: tabular-nums`, and
                # dropping it would silently un-align every number column on the
                # page. The eleven `ssNN` stylistic sets Geist ships are not
                # referenced anywhere in web/src, and keeping them retained ~750
                # alternate glyphs that nothing can reach.
                "--layout-features=kern,liga,clig,calt,ccmp,mark,mkmk,rlig,locl,tnum",
                # Do NOT instance: the wght axis is what makes these variable
                # fonts useful, and pinning it here would move an axis choice
                # from render time to build time.
                "--retain-gids=0",
                "--name-IDs=*",
                "--notdef-outline",
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"{name}: subsetting failed\n{result.stderr}", file=sys.stderr)
                return 1
            after = out.stat().st_size
            if after >= before:
                print(f"  {name}: {before} → {after} B (no saving, left alone)")
                total_before += before
                total_after += before
                continue
            path.write_bytes(out.read_bytes())
        total_before += before
        total_after += after
        print(f"  {name}: {before:,} → {after:,} B  ({100 * (1 - after / before):.0f}% smaller)")
    print(f"\ntotal {total_before:,} → {total_after:,} B "
          f"({total_before - total_after:,} B saved across {len(FONTS)} files)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--write", action="store_true", help="subset the fonts in place")
    g.add_argument("--check", action="store_true", help="fail if a needed glyph is missing")
    args = ap.parse_args()
    return write() if args.write else check()


if __name__ == "__main__":
    raise SystemExit(main())
