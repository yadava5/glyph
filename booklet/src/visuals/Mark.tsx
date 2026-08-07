import React from "react";
import { COLORS } from "../theme";

/**
 * GlyphMark — the project's mark (logos/glyph.svg), hand-transcribed as inline
 * SVG so the print/PDF path never fetches an asset: a handwritten stroke over
 * four SIMD lanes — hand over machine — inside its app chip.
 *
 * Unlike the Cadence and jetpack devices, this mark KEEPS the tile: rendered
 * bare, the stroke-over-lanes reads as a struck-through numeral 2 the moment
 * it sits near type (screenshot-verified — the cover lockup parsed as
 * "Glyph 2"). The chip frame is what makes it parse as an icon. The tile is
 * restated in this book's chrome — GROUND_ELEVATED fill with an ON_DARK @0.40
 * border (measured APCA Lc -22; the house 0.15 hairline measured Lc 0 against
 * the raw cover ground — invisible — and the frame is load-bearing here).
 * Glyph colours are resolved from theme.ts (no currentColor, no
 * prefers-color-scheme): hand stroke ON_DARK (Lc -99), lanes STEEL — the
 * theme's scalar-baseline voice — at Lc -52. The source's #52525B lanes
 * measured Lc -16 here and ON_DARK@0.30 measured -13: both at or under the
 * invisibility floor, rejected; the machine half of the argument must be seen.
 */
export const GlyphMark: React.FC<{
  /** Rendered chip size in px (the mark is square). */
  size: number;
  style?: React.CSSProperties;
}> = ({ size, style }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 48 48" fill="none" style={style}>
    {/* the tile: HAND over MACHINE */}
    <rect
      x="1"
      y="1"
      width="46"
      height="46"
      rx="11"
      fill={COLORS.GROUND_ELEVATED}
      stroke={COLORS.ON_DARK}
      strokeOpacity={0.4}
      strokeWidth={1.4}
    />
    {/* the four SIMD lanes — the machine */}
    <g stroke={COLORS.STEEL} strokeWidth={1.5}>
      <line x1="9.6" y1="13.2" x2="38.4" y2="13.2" />
      <line x1="9.6" y1="20.4" x2="38.4" y2="20.4" />
      <line x1="9.6" y1="27.6" x2="38.4" y2="27.6" />
      <line x1="9.6" y1="34.8" x2="38.4" y2="34.8" />
    </g>
    {/* the handwritten stroke — the hand */}
    <path
      d="M15 19.2 C15 12.6 32.4 11.4 32.4 18.6 C32.4 24 20.4 28.8 14.4 36 L34.8 36"
      stroke={COLORS.ON_DARK}
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
