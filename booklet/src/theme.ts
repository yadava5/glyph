/**
 * Glyph System Card — design tokens (self-contained).
 *
 * This booklet ships standalone: every token is inlined here so
 * `glyph/booklet` builds with no external package. The palette is
 * Glyph's OWN identity — a low-level *systems / benchmark* register:
 * a deep blue-black ink ground (the workbench at night), cool-steel
 * hairlines, and five accents pulled straight from the web frontend's
 * "Register B" (experience / workbench / hero) so the printed card and the
 * live site read as one instrument.
 *
 *   STEEL   #94A3B8  01 WHY     the scalar baseline — speed left on the floor
 *   AMBER   #F59E0B  02 HOW     the SIMD lanes — hand-written across 4 ISAs
 *   SKY     #38BDF8  03 INSIDE  the wasm128 kernel · the live in-browser bench
 *   GREEN   #4ADE80  04 PROOF   the winner — vectorized, verified, measured
 *   VIOLET  #A78BFA  05 BUILD   the toolchain — C++ · Emscripten · React
 *
 * Bright accents ride the dark surfaces (cover, dividers, code panels); the
 * *_DEEP variants are their legible-on-white counterparts, used for eyebrows,
 * footers, and rules on the light editorial pages.
 *
 * Source · web/src/styles/tokens.css (Register B grounds + accents),
 * web/src/features/experience/*.module.css (steel-vs-green bench bars,
 * amber→sky SIMD lanes, sky-blue registration grid).
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const COLORS = {
  // Paper (light content pages) — cool whites, a hair of blue
  PAPER: "#FFFFFF",
  PAPER_WARM: "#FBFCFE",
  PAPER_ELEVATED: "#F2F6FB",
  SURFACE: "#E8EEF5",

  // Hairlines — cool steel
  HAIRLINE: "#CBD5E1",
  HAIRLINE_STRONG: "#94A3B8",

  // Ink (primary text + the dark full-bleed ground) — near-black, blue undertone
  INK: "#0A0F17",
  INK_SOFT: "#131C2B",
  INK_MUTED: "rgba(10, 15, 23, 0.62)",
  INK_SUBTLE: "rgba(10, 15, 23, 0.40)",

  // On-dark inks (text over the #05070C ground)
  ON_DARK: "#EAF2FB",
  ON_DARK_MUTED: "rgba(234, 242, 251, 0.66)",
  ON_DARK_SUBTLE: "rgba(234, 242, 251, 0.40)",
  ON_DARK_HAIRLINE: "rgba(234, 242, 251, 0.15)",

  // Dark grounds — cover / dividers / code panels (blue-black, from Register B)
  GROUND: "#05070C",
  GROUND_ELEVATED: "#0A0F18",
  GROUND_PANEL: "#080C12",

  // ── Systems / ISA accents (bright — for dark surfaces) ──
  STEEL: "#94A3B8", // slate-400 · scalar baseline / loser bars
  SIMD_AMBER: "#F59E0B", // amber-500 · the SIMD lanes
  SKY: "#38BDF8", // sky-400 · electric blue
  SKY_SOFT: "#7DD3FC", // sky-300 · registration grid, edges (the primary blue)
  ELECTRIC: "#0EA5E9", // sky-500 · glow
  WIN_GREEN: "#4ADE80", // green-400 · vectorized winner / verified
  VIOLET: "#A78BFA", // violet-400 · toolchain / hidden layer

  // ── Deep variants (legible on white — for editorial pages) ──
  STEEL_DEEP: "#475569", // slate-600
  AMBER_DEEP: "#B45309", // amber-700
  SKY_DEEP: "#0369A1", // sky-700
  GREEN_DEEP: "#047857", // emerald-700
  VIOLET_DEEP: "#6D28D9", // violet-700

  // ── Accent tints (fills, bands) ──
  STEEL_TINT: "rgba(148, 163, 184, 0.12)",
  AMBER_TINT: "rgba(245, 158, 11, 0.12)",
  SKY_TINT: "rgba(56, 189, 248, 0.12)",
  GREEN_TINT: "rgba(74, 222, 128, 0.13)",
  VIOLET_TINT: "rgba(167, 139, 250, 0.12)",

  // Status
  SUCCESS: "#047857",
  DANGER: "#DC2626",
  DANGER_TINT: "rgba(220, 38, 38, 0.08)",

  // Neutral scale
  NEUTRAL_300: "#D4D4D4",
  NEUTRAL_400: "#9CA3AF",
  NEUTRAL_500: "#6B7280",
  NEUTRAL_600: "#4B5563",
  NEUTRAL_700: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Fonts — Instrument Serif + Plus Jakarta Sans + Monaspace Neon (mono).
// The mono carries the machine voice: every kernel, benchmark cell, and
// tabular digit. Serif italic is the human turn; sans is the body.
// ---------------------------------------------------------------------------

export const FONTS = {
  SANS: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  SERIF: '"Instrument Serif", Georgia, "Times New Roman", serif',
  MONO: '"Monaspace Neon", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

// ---------------------------------------------------------------------------
// Section color map — one ISA/systems accent per chapter. Bright variant
// rides the dark dividers + accent dots/bars; the *_INK map is the
// legible-on-white variant for content-page eyebrows and page-number footers.
// ---------------------------------------------------------------------------

export const SECTION = {
  "01_WHY": COLORS.STEEL,
  "02_HOW": COLORS.SIMD_AMBER,
  "03_INSIDE": COLORS.SKY,
  "04_PROOF": COLORS.WIN_GREEN,
  "05_BUILD": COLORS.VIOLET,
} as const;

export const SECTION_INK = {
  "01_WHY": COLORS.STEEL_DEEP,
  "02_HOW": COLORS.AMBER_DEEP,
  "03_INSIDE": COLORS.SKY_DEEP,
  "04_PROOF": COLORS.GREEN_DEEP,
  "05_BUILD": COLORS.VIOLET_DEEP,
} as const;

export type SectionKey = keyof typeof SECTION;

// ---------------------------------------------------------------------------
// Typography — sized for a held-in-hand 8.5"×11" page. Ported from the proven
// booklet ladder (px at 96 CSS DPI; printed pt = px ÷ 1.333).
// ---------------------------------------------------------------------------

export const TYPE = {
  // Display — cover title, divider numerals
  display: { size: 220, weight: 700, tracking: "-0.03em", lh: 0.92 },
  displayMedium: { size: 112, weight: 700, tracking: "-0.025em", lh: 1 },

  // Section title on divider pages (italic serif)
  sectionTitle: { size: 80, weight: 400, tracking: "0", lh: 1, italic: true },

  // Page headlines and subheads
  h1: { size: 36, weight: 700, tracking: "-0.02em", lh: 1.08 },
  h2: { size: 22, weight: 600, tracking: "-0.015em", lh: 1.2 },

  // Italic serif subheads
  subheadLarge: { size: 20, weight: 400, italic: true, lh: 1.2 },
  subheadMedium: { size: 18, weight: 400, italic: true, lh: 1.25 },
  subheadSmall: { size: 14, weight: 400, italic: true, lh: 1.3 },

  // Body
  body: { size: 11, weight: 400, tracking: "-0.005em", lh: 1.46 },

  // Pull quotes (serif italic)
  pullQuote: { size: 28, weight: 400, tracking: "0", lh: 1.25, italic: true },
  pullQuoteSmall: { size: 24, weight: 400, tracking: "0", lh: 1.25, italic: true },

  // Supporting
  caption: { size: 10, weight: 500, tracking: "0.02em", lh: 1.25 },
  mono: { size: 10, weight: 500, tracking: "0.04em", lh: 1.2 },
  pageNum: { size: 9, weight: 500, tracking: "0.04em", lh: 1 },

  // Monaspace UPPERCASE eyebrow
  eyebrow: { size: 10, weight: 500, tracking: "0.12em", lh: 1 },
  eyebrowLarge: { size: 14, weight: 500, tracking: "0.12em", lh: 1 },

  // Subtitle under divider number
  dividerSubtitle: { size: 24, weight: 400, tracking: "-0.01em", lh: 1.2 },

  // Small caps on callouts
  approvalLabel: { size: 10, weight: 600, tracking: "0.18em", lh: 1 },

  // Metric tiers — the numeric voice (mono 700, tabular)
  metricHero: { size: 92, weight: 700, tracking: "-0.03em", lh: 0.95 },
  metricLarge: { size: 60, weight: 700, tracking: "-0.02em", lh: 1 },
  metricMedium: { size: 44, weight: 700, tracking: "-0.03em", lh: 1 },
  metricSmall: { size: 30, weight: 700, tracking: "-0.02em", lh: 1 },
} as const;

// ---------------------------------------------------------------------------
// Page geometry — 8.5"×11" trim, 0.125" bleed, asymmetric margins.
// ---------------------------------------------------------------------------

export const PAGE = {
  trimW: 8.5,
  trimH: 11,
  bleedIn: 0.125,
  margin: {
    outer: 0.75,
    top: 0.875,
    bottom: 1.0,
    inner: 0.75,
  },
  grid: {
    cols: 4,
    gutterIn: 0.25,
  },
} as const;

// ---------------------------------------------------------------------------
// Card chrome
// ---------------------------------------------------------------------------

export const CARD = {
  bg: COLORS.PAPER_ELEVATED,
  border: `1px solid ${COLORS.HAIRLINE}`,
  radius: 6,
  padding: 10,
} as const;

// ---------------------------------------------------------------------------
// Color utility — hex → rgba().
// ---------------------------------------------------------------------------

export function hexWithAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
