import React from "react";
import { COLORS } from "../theme";

/**
 * DigitLanesField — the cover motif: an MNIST digit as a monumental raster
 * (what the network sees) bleeding off the page edges, with one row lit hot —
 * the dot-product hot loop — as a full-bleed scan band that streams into the
 * SIMD lane rail of the four ISAs. The band sits at the SAME y on front and
 * back, so the wrapped cover reads as one continuous line around the spine:
 * green (verified) ← sky (the browser kernel) | sky → amber (the lanes).
 *
 *   front — digit "3", left, cropped by the left/top bleed; hot row in amber;
 *           the scan band feeds the scalar bar + four ISA lanes, which run off
 *           the right edge (the lanes continue past the page).
 *   back  — digit "7", right, hugging the spine as the front digit does; no
 *           rail, no captions — the race is over. The band settles into
 *           WIN_GREEN and the hot row reads resolved.
 *
 * All vector: sky-blue raster cells, one amber→sky lane gradient on the
 * #05070C ground, a faint sky registration grid, and a low-alpha feTurbulence
 * grain. No blend-modes, masks, or external images (PDF-safe).
 */

export type DigitLanesFieldProps = {
  widthIn: number;
  heightIn: number;
  variant: "front" | "back";
  seed?: string;
};

const VB_W = 875;
const VB_H = 1125;

// --- deterministic PRNG (mulberry32 seeded via xmur3) ----------------------
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- digit bitmaps (1 = ink) -----------------------------------------------
// 15 rows × 12 cols, hand-drawn to read as MNIST-style strokes.
const DIGIT_3 = [
  "............",
  "...######...",
  "..########..",
  ".###....###.",
  ".##.....###.",
  "........###.",
  ".....#####..",
  ".....####...",
  ".....#####..",
  "........###.",
  ".##.....###.",
  ".###...####.",
  "..########..",
  "...######...",
  "............",
];
const DIGIT_7 = [
  "............",
  ".##########.",
  ".##########.",
  ".......###..",
  "......###...",
  ".....###....",
  ".....###....",
  "....###.....",
  "....###.....",
  "...###......",
  "...###......",
  "..###.......",
  "..###.......",
  "..###.......",
  "............",
];

// The four ISAs, widest → narrowest. `lanes` drives the segment count cut
// into each bar (doubles per SIMD register); wasm128 is the browser kernel.
const ISA_LANES = [
  { label: "AVX-512", lanes: 8, tag: "__m512d" },
  { label: "AVX2", lanes: 4, tag: "__m256d" },
  { label: "NEON", lanes: 2, tag: "float64x2" },
  { label: "wasm-simd128", lanes: 2, tag: "v128 · this page" },
] as const;

// --- shared geometry --------------------------------------------------------
// The scan band — the dot-product hot loop — sits at the SAME height on both
// covers so the wrap reads as one continuous line around the spine. Row 7
// crosses the middle stroke of the "3" and the diagonal of the "7"; each
// digit's grid origin is derived so its row 7 centers on the band.
const HOT_ROW = 7;
const ROW_CENTER = 375;
const BAND_TOP = ROW_CENTER - 30;
const BAND_BOTTOM = ROW_CENTER + 30;

// Front raster: large but FULLY visible — a cropped bright digit stops
// reading as a digit (tried it; it became a wall of cells). 1.6× the old
// pitch, clear of the masthead line at the top.
const F_CELL = 40;
const F_GAP = 5;
const F_PITCH = F_CELL + F_GAP;
const F_GRID_X = 20;
const F_GRID_Y = ROW_CENTER - F_CELL / 2 - HOT_ROW * F_PITCH; // 40

// Back raster: bigger pitch and ghosted — at low opacity the crop reads as
// texture, so the "7" can run off the right (spine) edge like a watermark.
const B_CELL = 46;
const B_GAP = 6;
const B_PITCH = B_CELL + B_GAP;
const B_GRID_Y = ROW_CENTER - B_CELL / 2 - HOT_ROW * B_PITCH; // -12

// Lane rail (front only) — right column, bars running off the right edge.
// AVX-512 is centered on the scan band: the row streams into the register.
// Bars end exactly at the bleed edge (x=875): that is already past the
// 862.5 trim, so they print running off the page — and clipcheck stays clean.
const LANE_X = 612;
const LANE_W = VB_W - LANE_X;
const LANE_H = 54;
const LANE_GAP = 30;

export const DigitLanesField: React.FC<DigitLanesFieldProps> = ({
  widthIn,
  heightIn,
  variant,
  seed = "fast-mnist-2026",
}) => {
  void widthIn;
  void heightIn;

  const rand = React.useMemo(
    () => mulberry32(xmur3(`${seed}::${variant}`)()),
    [seed, variant],
  );

  const front = variant === "front";
  const bitmap = front ? DIGIT_3 : DIGIT_7;
  const rows = bitmap.length;
  const cols = bitmap[0]!.length;

  const cell = front ? F_CELL : B_CELL;
  const pitch = front ? F_PITCH : B_PITCH;
  const gridW = cols * pitch - (front ? F_GAP : B_GAP);
  const gridY = front ? F_GRID_Y : B_GRID_Y;
  // front: digit sits left, fully on the page; back: the ghost "7" sits flush
  // against the right (spine) bleed edge, so its last column trims off in
  // print — a watermark hugging the spine, with clean clipcheck geometry.
  const gridX = front ? F_GRID_X : VB_W - gridW;

  // Streaming particles — data flowing along the scan band toward the rail.
  type P = { x: number; y: number; r: number; op: number; sky: boolean };
  const particles: P[] = [];
  if (front) {
    for (let i = 0; i < 22; i++) {
      const t = rand();
      particles.push({
        x: 180 + t * 420,
        y: ROW_CENTER + (rand() - 0.5) * 26,
        r: 1.8 + rand() * 2.2,
        op: 0.18 + t * 0.5,
        sky: rand() > 0.42,
      });
    }
  }

  const gradId = `lane-grad-${variant}`;
  const bandId = `band-grad-${variant}`;
  const gridId = `reg-grid-${variant}`;
  const grainId = `field-grain-${variant}`;

  // Hot-row accent: amber while the row is being read (front); WIN_GREEN once
  // it is resolved (back) — the legend's scalar/vectorized/measured language.
  const hotColor = front ? COLORS.SIMD_AMBER : COLORS.WIN_GREEN;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={COLORS.SIMD_AMBER} />
          <stop offset="100%" stopColor={COLORS.SKY_SOFT} />
        </linearGradient>
        {/* Scan-band gradient. The spine edge (front: left, back: right) is
            SKY_SOFT on both, so the band is continuous across the wrap:
            green ← sky │ sky → amber. */}
        <linearGradient id={bandId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={front ? COLORS.SKY_SOFT : COLORS.WIN_GREEN} />
          <stop offset="100%" stopColor={front ? COLORS.SIMD_AMBER : COLORS.SKY_SOFT} />
        </linearGradient>
        <pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.SKY_SOFT} strokeWidth="0.6" strokeOpacity="0.07" />
        </pattern>
        <filter id={grainId} x="-2%" y="-2%" width="104%" height="104%" primitiveUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" seed={front ? 7 : 13} />
          <feColorMatrix
            values="0 0 0 0 0.42
                    0 0 0 0 0.55
                    0 0 0 0 0.72
                    0 0 0 0.05 0"
          />
        </filter>
        <radialGradient id={`field-vignette-${variant}`} cx="50%" cy={front ? "36%" : "52%"} r="80%">
          <stop offset="0%" stopColor={COLORS.GROUND} stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
        </radialGradient>
      </defs>

      {/* Ground + registration grid */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={COLORS.GROUND} />
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#${gridId})`} />

      {/* ---- The scan band (under the raster, full bleed) ---- */}
      <rect
        x={0}
        y={BAND_TOP}
        width={VB_W}
        height={BAND_BOTTOM - BAND_TOP}
        fill={`url(#${bandId})`}
        fillOpacity={front ? 0.1 : 0.07}
      />
      {/* Band hairlines. On the front they stop short of the rail so the lane
          labels sit clean; on the back they run the full bleed. */}
      {[BAND_TOP, BAND_BOTTOM].map((y) => (
        <line
          key={y}
          x1={0}
          y1={y}
          x2={front ? LANE_X - 18 : VB_W}
          y2={y}
          stroke={`url(#${bandId})`}
          strokeOpacity={front ? 0.38 : 0.3}
          strokeWidth={1}
        />
      ))}

      <g opacity={0.99}>
        {/* ---- The digit raster (what the network sees) ---- */}
        {bitmap.map((line, r) =>
          Array.from(line).map((ch, c) => {
            const x = gridX + c * pitch;
            const y = gridY + r * pitch;
            // Skip cells that fall outside the bleed box (back: the empty top
            // row) — invisible at these opacities, and keeps clipcheck clean.
            if (x < 0 || y < 0 || x + cell > VB_W || y + cell > VB_H) return null;
            const ink = ch === "#";
            const hot = ink && r === HOT_ROW;
            return (
              <rect
                key={`${r}-${c}`}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={4}
                fill={hot ? hotColor : ink ? COLORS.SKY_SOFT : COLORS.SKY}
                fillOpacity={hot ? (front ? 0.95 : 0.8) : ink ? (front ? 0.78 : 0.15) : front ? 0.035 : 0.025}
                stroke={hot ? hotColor : ink && front ? COLORS.SKY : "none"}
                strokeOpacity={hot ? 0.5 : ink && front ? 0.3 : 0}
                strokeWidth={0.75}
              />
            );
          }),
        )}

        {front && (
          <>
            {/* raster caption — reads as a dimension note on the scan band */}
            <text x={36} y={BAND_TOP - 14} fontFamily="ui-monospace, monospace" fontSize={13} letterSpacing="2.5" fill={COLORS.SKY_SOFT} fillOpacity={0.75}>
              28×28 · row · x
            </text>

            {/* ---- Streaming particles: the row flowing toward the rail ---- */}
            {particles.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.sky ? COLORS.SKY : COLORS.SIMD_AMBER} fillOpacity={p.op} />
            ))}

            {/* ---- Scalar reference bar (the race: one lane) ---- */}
            <g>
              <text x={LANE_X} y={ROW_CENTER - LANE_H / 2 - LANE_GAP - 40} fontFamily="ui-monospace, monospace" fontSize={11.5} letterSpacing="1.5" fill={COLORS.STEEL} fillOpacity={0.8}>
                scalar · 1 lane
              </text>
              <rect
                x={LANE_X}
                y={ROW_CENTER - LANE_H / 2 - LANE_GAP - 30}
                width={LANE_W}
                height={24}
                rx={3}
                fill="none"
                stroke={COLORS.STEEL}
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <rect
                x={LANE_X + 3}
                y={ROW_CENTER - LANE_H / 2 - LANE_GAP - 27}
                width={(LANE_W - 6) / 8}
                height={18}
                rx={2}
                fill={COLORS.STEEL}
                fillOpacity={0.55}
              />
            </g>

            {/* ---- The four ISA lanes — the hot row re-executed four ways.
                 AVX-512 is centered on the scan band: the row streams straight
                 into the widest register. One amber→sky gradient per bar, cut
                 into its lane count by ground-colored gaps. ---- */}
            {ISA_LANES.map((isa, li) => {
              const y = ROW_CENTER - LANE_H / 2 + li * (LANE_H + LANE_GAP);
              const segW = (LANE_W - 6) / isa.lanes;
              return (
                <g key={isa.label}>
                  <rect x={LANE_X} y={y} width={LANE_W} height={LANE_H} rx={4} fill={COLORS.GROUND_ELEVATED} stroke={COLORS.SKY} strokeOpacity={0.22} strokeWidth={1} />
                  <rect x={LANE_X + 3} y={y + 3} width={LANE_W - 6} height={LANE_H - 6} rx={2} fill={`url(#${gradId})`} fillOpacity={0.82} />
                  {Array.from({ length: isa.lanes - 1 }).map((_, s) => (
                    <rect
                      key={s}
                      x={LANE_X + 3 + (s + 1) * segW - 2}
                      y={y + 2}
                      width={4}
                      height={LANE_H - 4}
                      fill={COLORS.GROUND}
                    />
                  ))}
                  <text x={LANE_X} y={y - 9} fontFamily="ui-monospace, monospace" fontSize={12.5} fontWeight={600} letterSpacing="1" fill={COLORS.SKY_SOFT}>
                    {isa.label}
                  </text>
                  <text x={858} y={y - 9} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={10} letterSpacing="0.5" fill={COLORS.ON_DARK_MUTED}>
                    {isa.lanes}× {isa.tag}
                  </text>
                </g>
              );
            })}

            {/* winner tick — a caption between the digit and the headline */}
            <text x={36} y={gridY + rows * pitch + 26} fontFamily="ui-monospace, monospace" fontSize={12} letterSpacing="1.5" fill={COLORS.WIN_GREEN} fillOpacity={0.82}>
              → one dot product, hand-written 4×
            </text>
          </>
        )}
      </g>

      {/* Vignette + grain (last, over everything) */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#field-vignette-${variant})`} pointerEvents="none" />
      <rect x={0} y={0} width={VB_W} height={VB_H} filter={`url(#${grainId})`} pointerEvents="none" opacity={0.85} />
    </svg>
  );
};
