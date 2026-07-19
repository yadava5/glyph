import React from "react";
import { COLORS } from "../theme";

/**
 * DigitLanesField — the cover motif: an MNIST digit rendered as a raster of
 * cells (what the network sees) that streams rightward and dissolves into the
 * SIMD lanes of the four instruction sets. A single steel "scalar" bar sits
 * above the vectorized lanes so the cover reads as a scalar-vs-vectorized
 * race: one lane busy vs eight.
 *
 *   front    — digit "3" resolving into AVX-512 / AVX2 / NEON / wasm128 lanes.
 *   back     — digit "7", reseeded + shifted so the wrap reads continuous.
 *
 * All vector: sky-blue raster cells + amber→sky lane fills on the #05070C
 * ground, a faint sky registration grid, and a low-alpha feTurbulence grain.
 * No blend-modes, masks, or external images (PDF-safe).
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

// The four ISAs, widest → narrowest. `lanes` drives the segment count drawn
// in each bar (doubles per SIMD register); wasm128 is the browser kernel.
const ISA_LANES = [
  { label: "AVX-512", lanes: 8, tag: "__m512d" },
  { label: "AVX2", lanes: 4, tag: "__m256d" },
  { label: "NEON", lanes: 2, tag: "float64x2" },
  { label: "wasm-simd128", lanes: 2, tag: "v128 · this page" },
] as const;

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

  const bitmap = variant === "front" ? DIGIT_3 : DIGIT_7;
  const rows = bitmap.length;
  const cols = bitmap[0]!.length;

  // Digit raster geometry — upper-left region.
  const cell = 25;
  const gap = 4;
  const gridX = variant === "back" ? 150 : 120;
  const gridY = 205;

  // Lane bars — right region, stacked. y-bands computed below.
  const laneX = 545;
  const laneW = 255;
  const laneTop = 250;
  const laneH = 58;
  const laneGap = 34;

  // Streaming particles: digit ink cells → lanes.
  type P = { x: number; y: number; r: number; op: number; sky: boolean };
  const particles: P[] = [];
  const inkCells: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (bitmap[r]![c] === "#") inkCells.push([r, c]);
    }
  }
  for (let i = 0; i < 46; i++) {
    const src = inkCells[Math.floor(rand() * inkCells.length)]!;
    const [r, c] = src;
    const srcX = gridX + c * (cell + gap) + cell / 2;
    const srcY = gridY + r * (cell + gap) + cell / 2;
    const t = rand();
    const targetLane = Math.floor(rand() * ISA_LANES.length);
    const dstY = laneTop + targetLane * (laneH + laneGap) + laneH / 2;
    const dstX = laneX - 8 - rand() * 60;
    particles.push({
      x: srcX + (dstX - srcX) * t,
      y: srcY + (dstY - srcY) * t,
      r: 2.2 + rand() * 2.4,
      op: 0.16 + t * 0.5,
      sky: rand() > 0.42,
    });
  }

  const gradId = `lane-grad-${variant}`;
  const gridId = `reg-grid-${variant}`;
  const grainId = `field-grain-${variant}`;

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
        <pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.SKY_SOFT} strokeWidth="0.6" strokeOpacity="0.07" />
        </pattern>
        <filter id={grainId} x="-2%" y="-2%" width="104%" height="104%" primitiveUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" seed={variant === "front" ? 7 : 13} />
          <feColorMatrix
            values="0 0 0 0 0.42
                    0 0 0 0 0.55
                    0 0 0 0 0.72
                    0 0 0 0.05 0"
          />
        </filter>
        <radialGradient id={`field-vignette-${variant}`} cx="50%" cy={variant === "front" ? "36%" : "60%"} r="80%">
          <stop offset="0%" stopColor={COLORS.GROUND} stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
        </radialGradient>
      </defs>

      {/* Ground + registration grid */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={COLORS.GROUND} />
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#${gridId})`} />

      <g opacity={0.99}>
        {/* ---- The digit raster (what the network sees) ---- */}
        {bitmap.map((line, r) =>
          Array.from(line).map((ch, c) => {
            const x = gridX + c * (cell + gap);
            const y = gridY + r * (cell + gap);
            const ink = ch === "#";
            return (
              <rect
                key={`${r}-${c}`}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={3}
                fill={ink ? COLORS.SKY_SOFT : COLORS.SKY}
                fillOpacity={ink ? 0.9 : 0.05}
                stroke={ink ? COLORS.SKY : "none"}
                strokeOpacity={ink ? 0.35 : 0}
                strokeWidth={0.75}
              />
            );
          }),
        )}
        {/* raster caption */}
        <text x={gridX} y={gridY - 16} fontFamily="ui-monospace, monospace" fontSize={13} letterSpacing="2.5" fill={COLORS.SKY_SOFT} fillOpacity={0.7}>
          28×28 · row · x
        </text>

        {/* ---- Streaming particles: raster → lanes ---- */}
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.sky ? COLORS.SKY : COLORS.SIMD_AMBER} fillOpacity={p.op} />
        ))}

        {/* ---- Scalar reference bar (the race: one lane) ---- */}
        <g>
          <rect x={laneX} y={laneTop - laneH - laneGap} width={laneW} height={laneH} rx={4} fill="none" stroke={COLORS.STEEL} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 4" />
          <rect x={laneX + 3} y={laneTop - laneH - laneGap + 3} width={(laneW - 6) / 8} height={laneH - 6} rx={2} fill={COLORS.STEEL} fillOpacity={0.55} />
          <text x={laneX + laneW - 6} y={laneTop - laneH - laneGap + laneH / 2 + 4} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={12} letterSpacing="1.5" fill={COLORS.STEEL} fillOpacity={0.8}>
            scalar · 1 lane
          </text>
        </g>

        {/* ---- The four ISA lanes (vectorized) ---- */}
        {ISA_LANES.map((isa, li) => {
          const y = laneTop + li * (laneH + laneGap);
          const segW = (laneW - 6) / isa.lanes;
          return (
            <g key={isa.label}>
              <rect x={laneX} y={y} width={laneW} height={laneH} rx={4} fill={COLORS.GROUND_ELEVATED} stroke={COLORS.SKY} strokeOpacity={0.22} strokeWidth={1} />
              {Array.from({ length: isa.lanes }).map((_, s) => (
                <rect
                  key={s}
                  x={laneX + 3 + s * segW}
                  y={y + 3}
                  width={segW - 3}
                  height={laneH - 6}
                  rx={2}
                  fill={`url(#${gradId})`}
                  fillOpacity={0.82}
                />
              ))}
              <text x={laneX} y={y - 7} fontFamily="ui-monospace, monospace" fontSize={12.5} fontWeight={600} letterSpacing="1" fill={COLORS.SKY_SOFT}>
                {isa.label}
              </text>
              <text x={laneX + laneW} y={y - 7} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={10} letterSpacing="0.5" fill={COLORS.ON_DARK_SUBTLE}>
                {isa.lanes}× {isa.tag}
              </text>
            </g>
          );
        })}

        {/* winner tick — under the digit, where there is room off the bleed */}
        <text x={gridX} y={gridY + rows * (cell + gap) + 26} fontFamily="ui-monospace, monospace" fontSize={12} letterSpacing="1.5" fill={COLORS.WIN_GREEN} fillOpacity={0.82}>
          → one dot product, hand-written 4×
        </text>
      </g>

      {/* Vignette + grain (last, over everything) */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={`url(#field-vignette-${variant})`} pointerEvents="none" />
      <rect x={0} y={0} width={VB_W} height={VB_H} filter={`url(#${grainId})`} pointerEvents="none" opacity={0.85} />
    </svg>
  );
};
