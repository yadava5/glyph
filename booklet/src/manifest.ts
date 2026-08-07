/**
 * The booklet's page registry — single source of truth for ordering, parity,
 * and page-kind dispatch. Pure data: the validator script and the runtime
 * `Booklet.tsx` both consume this file, so it must stay JSX-free.
 *
 * Saddle-stitch parity (28-page book = 7 folded sheets): page 01 is a recto
 * (odd index), pages alternate recto/verso, and the page count is a multiple
 * of 4. `scripts/validate-parity.mjs` enforces this at PDF-export time.
 *
 * Two-page spreads (kind: "spread") MUST be a verso+recto pair on adjacent
 * indices so they face each other once bound — here, the BUILD journey.
 */

import type { SectionKey } from "./theme";

export type PageKind =
  | "cover"
  | "back-cover"
  | "endpaper"
  | "toc"
  | "divider"
  | "body"
  | "spread";

/** Body-page kinds — one per unique body content module. */
export type BodyKey =
  | "why-scalar"
  | "why-floor"
  | "why-hotloop"
  | "how-dispatch"
  | "how-avx"
  | "how-neon"
  | "how-wasm"
  | "how-threads"
  | "inside-wasm"
  | "inside-bench"
  | "inside-anatomy"
  | "proof-speedups"
  | "proof-accuracy"
  | "proof-table"
  | "proof-tests"
  | "build-stack"
  | "build-closing";

export type PageSpec =
  | { num: 1; kind: "cover"; parity: "recto"; sectionKey: null }
  | { num: 2; kind: "endpaper"; parity: "verso"; sectionKey: null }
  | { num: 3; kind: "toc"; parity: "recto"; sectionKey: null }
  | {
      num: number;
      kind: "divider";
      parity: "recto" | "verso";
      sectionKey: SectionKey;
      chapterNum: string;
      chapterTitle: string;
      subtitle: string;
      artSlot: string;
      chapterIndex: number;
      chapterTotal: number;
    }
  | {
      num: number;
      kind: "body";
      parity: "recto" | "verso";
      sectionKey: SectionKey;
      body: BodyKey;
    }
  | {
      num: number;
      kind: "spread";
      parity: "recto" | "verso";
      sectionKey: SectionKey;
      half: "left" | "right";
    }
  | { num: 28; kind: "back-cover"; parity: "verso"; sectionKey: null };

// ---------------------------------------------------------------------------
// Manifest — the 28 pages, in order.
// ---------------------------------------------------------------------------

export const PAGES: readonly PageSpec[] = [
  { num: 1, kind: "cover", parity: "recto", sectionKey: null },
  { num: 2, kind: "endpaper", parity: "verso", sectionKey: null },
  { num: 3, kind: "toc", parity: "recto", sectionKey: null },

  {
    num: 4, kind: "divider", parity: "verso", sectionKey: "01_WHY",
    chapterNum: "01", chapterTitle: "WHY",
    subtitle: "the compiler leaves the speed on the floor",
    artSlot: "/art/div-01-why.svg",
    chapterIndex: 1, chapterTotal: 5,
  },
  { num: 5, kind: "body", parity: "recto", sectionKey: "01_WHY", body: "why-scalar" },
  { num: 6, kind: "body", parity: "verso", sectionKey: "01_WHY", body: "why-floor" },
  { num: 7, kind: "body", parity: "recto", sectionKey: "01_WHY", body: "why-hotloop" },

  {
    num: 8, kind: "divider", parity: "verso", sectionKey: "02_HOW",
    chapterNum: "02", chapterTitle: "HOW",
    subtitle: "one dot product · four instruction sets",
    artSlot: "/art/div-02-how.svg",
    chapterIndex: 2, chapterTotal: 5,
  },
  { num: 9, kind: "body", parity: "recto", sectionKey: "02_HOW", body: "how-dispatch" },
  { num: 10, kind: "body", parity: "verso", sectionKey: "02_HOW", body: "how-avx" },
  { num: 11, kind: "body", parity: "recto", sectionKey: "02_HOW", body: "how-neon" },
  { num: 12, kind: "body", parity: "verso", sectionKey: "02_HOW", body: "how-wasm" },
  { num: 13, kind: "body", parity: "recto", sectionKey: "02_HOW", body: "how-threads" },

  {
    num: 14, kind: "divider", parity: "verso", sectionKey: "03_INSIDE",
    chapterNum: "03", chapterTitle: "INSIDE",
    subtitle: "the wasm128 kernel — the live bench — the network",
    artSlot: "/art/div-03-inside.svg",
    chapterIndex: 3, chapterTotal: 5,
  },
  { num: 15, kind: "body", parity: "recto", sectionKey: "03_INSIDE", body: "inside-wasm" },
  { num: 16, kind: "body", parity: "verso", sectionKey: "03_INSIDE", body: "inside-bench" },
  { num: 17, kind: "body", parity: "recto", sectionKey: "03_INSIDE", body: "inside-anatomy" },

  {
    num: 18, kind: "divider", parity: "verso", sectionKey: "04_PROOF",
    chapterNum: "04", chapterTitle: "PROOF",
    subtitle: "scoped speedups — 97.01% — 37 + 57 tests",
    artSlot: "/art/div-04-proof.svg",
    chapterIndex: 4, chapterTotal: 5,
  },
  { num: 19, kind: "body", parity: "recto", sectionKey: "04_PROOF", body: "proof-speedups" },
  { num: 20, kind: "body", parity: "verso", sectionKey: "04_PROOF", body: "proof-accuracy" },
  { num: 21, kind: "body", parity: "recto", sectionKey: "04_PROOF", body: "proof-table" },
  { num: 22, kind: "body", parity: "verso", sectionKey: "04_PROOF", body: "proof-tests" },

  {
    num: 23, kind: "divider", parity: "recto", sectionKey: "05_BUILD",
    chapterNum: "05", chapterTitle: "BUILD",
    subtitle: "C++ → Emscripten → React · the optimization journey",
    artSlot: "/art/div-05-build.svg",
    chapterIndex: 5, chapterTotal: 5,
  },
  { num: 24, kind: "spread", parity: "verso", sectionKey: "05_BUILD", half: "left" },
  { num: 25, kind: "spread", parity: "recto", sectionKey: "05_BUILD", half: "right" },
  { num: 26, kind: "body", parity: "verso", sectionKey: "05_BUILD", body: "build-stack" },
  { num: 27, kind: "body", parity: "recto", sectionKey: "05_BUILD", body: "build-closing" },

  { num: 28, kind: "back-cover", parity: "verso", sectionKey: null },
] as const;

// ---------------------------------------------------------------------------
// Invariants — enforced at validate-parity.mjs time.
// ---------------------------------------------------------------------------

/** Expected parity for a given 1-based page index: recto on odd, verso on even. */
export function expectedParity(num: number): "recto" | "verso" {
  return num % 2 === 1 ? "recto" : "verso";
}

/** Assert manifest invariants. Throws the first failure it encounters. */
export function assertManifestInvariants(): void {
  if (PAGES.length % 4 !== 0) {
    throw new Error(`saddle-stitch needs a multiple of 4 pages, got ${PAGES.length}`);
  }
  for (const p of PAGES) {
    if (p.parity !== expectedParity(p.num)) {
      throw new Error(
        `page ${p.num}: expected ${expectedParity(p.num)}, manifest says ${p.parity}`,
      );
    }
  }
  const spreads = PAGES.filter((p) => p.kind === "spread");
  if (spreads.length !== 2) {
    throw new Error(`expected exactly 2 spread pages, got ${spreads.length}`);
  }
  const [l, r] = spreads;
  if (!l || !r) throw new Error("spread pages missing");
  if (l.num + 1 !== r.num) {
    throw new Error(`spread pages must be adjacent: got num=${l.num} and num=${r.num}`);
  }
  if (l.parity !== "verso" || r.parity !== "recto") {
    throw new Error(`spread pages must be verso+recto; got ${l.parity}+${r.parity}`);
  }
}
