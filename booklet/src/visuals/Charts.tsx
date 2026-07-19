import React from "react";
import { COLORS, FONTS } from "../theme";

/**
 * Charts — a varied, print-safe chart vocabulary for the content pages so the
 * booklet reads as more than a stack of bar graphs. Every chart is honest to
 * the booklet's already-verified figures (see content.ts) and renders as a
 * single inline SVG on a light editorial card (no animation, no external
 * assets — safe for the PDF export AND the /system-card web view).
 *
 *   RadialGauge     — the live speedup dial (wasm128 vs scalar p50).      [gauge]
 *   WaffleUnit      — 100-cell accuracy grid (9,701 / 10,000 correct).    [unit]
 *   SlopeChart      — GFLOP/s 6.9 → 24.3 on the matmul win.               [slope]
 *   Dumbbell        — 1-thread → omp+native per op, log time axis.        [dumbbell]
 *   ScatterQuadrant — parallel speedup vs baseline cost (the crossover).  [scatter]
 *   PerIterUnits    — doubles retired / iteration, AVX-512 vs AVX2.       [small-mult]
 *   AccumPipeline   — the wasm128 dual-accumulator hot loop, schematic.
 *
 * Mono is used for every axis tick and value so the numeric voice matches the
 * rest of the card; generous viewBox padding keeps labels off the edges.
 */

// ── shared card chrome ──────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  border: `0.5pt solid ${COLORS.HAIRLINE}`,
  borderRadius: 6,
  background: COLORS.PAPER_ELEVATED,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

export const ChartCard: React.FC<{
  label: string;
  accent: string;
  source: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, accent, source, children, style }) => (
  <div style={{ ...CARD, ...style }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>
        {label}
      </span>
      <span style={{ fontFamily: FONTS.MONO, fontSize: 7, color: COLORS.INK_SUBTLE }}>{source}</span>
    </div>
    {children}
  </div>
);

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, lineHeight: 1.32, color: COLORS.INK_MUTED }}>
    {children}
  </div>
);

const MONO = "ui-monospace, monospace";

// ── polar helpers (gauge) ───────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
/** Arc along the top semicircle from angle a0 to a1 (degrees, 180=left→0=right). */
function arcTop(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  // a0 > a1 (e.g. 180 → 0) sweeps clockwise in screen space (y down) → sweep 1
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

// ── RadialGauge — the live speedup dial ─────────────────────────────────────
export const RadialGauge: React.FC<{
  value: number; // e.g. 1.7
  min?: number;
  max?: number;
  bandLo?: number; // "typical range" shading
  bandHi?: number;
  accent?: string;
  source?: string;
}> = ({ value, min = 1, max = 2.5, bandLo = 1.5, bandHi = 1.9, accent = COLORS.SKY_DEEP, source = "p50 · your machine" }) => {
  const cx = 130;
  const cy = 128;
  const r = 96;
  const frac = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const angle = (v: number) => 180 - frac(v) * 180;
  const marker = polar(cx, cy, r, angle(value));
  const ticks = [min, (min + max) / 2, max].map((t) => Number(t.toFixed(2)));
  return (
    <ChartCard label="live · your machine" accent={accent} source={source}>
      <svg viewBox="0 0 260 168" width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* track */}
        <path d={arcTop(cx, cy, r, 180, 0)} fill="none" stroke={COLORS.STEEL} strokeOpacity={0.35} strokeWidth={13} strokeLinecap="round" />
        {/* typical band */}
        <path d={arcTop(cx, cy, r, angle(bandLo), angle(bandHi))} fill="none" stroke={COLORS.WIN_GREEN} strokeOpacity={0.3} strokeWidth={13} strokeLinecap="butt" />
        {/* value fill */}
        <path d={arcTop(cx, cy, r, 180, angle(value))} fill="none" stroke={COLORS.WIN_GREEN} strokeWidth={13} strokeLinecap="round" />
        {/* value marker on the arc */}
        <circle cx={marker.x} cy={marker.y} r={7} fill={accent} stroke={COLORS.PAPER} strokeWidth={2} />
        {/* ticks */}
        {ticks.map((t) => {
          const a = angle(t);
          const o = polar(cx, cy, r + 9, a);
          const i = polar(cx, cy, r - 9, a);
          return (
            <g key={t}>
              <line x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke={COLORS.INK_SUBTLE} strokeWidth={1} />
              <text x={o.x} y={o.y - 5} textAnchor="middle" fontFamily={MONO} fontSize={8} fontWeight={600} fill={COLORS.INK_MUTED}>
                {t}×
              </text>
            </g>
          );
        })}
        {/* center readout — clear of the arc, no needle to cross it */}
        <text x={cx} y={cy - 24} textAnchor="middle" fontFamily={MONO} fontSize={32} fontWeight={700} fill={COLORS.GREEN_DEEP} letterSpacing="-1">
          ~{value.toFixed(1)}×
        </text>
        <text x={cx} y={cy - 7} textAnchor="middle" fontFamily={MONO} fontSize={7.5} fill={COLORS.INK_MUTED} letterSpacing="0.5">
          session p50 · typical
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontFamily={MONO} fontSize={7.5} fill={COLORS.INK_SUBTLE}>
          typical run {bandLo}–{bandHi}×
        </text>
      </svg>
      <Caption>
        The badge shows the session median — the shaded band is where a typical
        run lands, so ~{value.toFixed(1)}× is defensible, not a fixed claim.
      </Caption>
    </ChartCard>
  );
};

// ── WaffleUnit — accuracy as 100 unit cells ─────────────────────────────────
export const WaffleUnit: React.FC<{
  filled?: number; // green cells (correct), out of 100
  accent?: string;
  source?: string;
}> = ({ filled = 97, accent = COLORS.GREEN_DEEP, source = "benchmarkData.ts:11" }) => {
  const cols = 20;
  const rows = 5;
  const cell = 15;
  const gap = 4;
  const total = rows * cols; // 100
  const filledN = Math.round((filled / 100) * total);
  return (
    <ChartCard label="9,701 / 10,000 correct" accent={accent} source={source}>
      <svg viewBox={`0 0 ${cols * (cell + gap)} ${rows * (cell + gap) + 4}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {Array.from({ length: total }).map((_, i) => {
          const rr = Math.floor(i / cols);
          const cc = i % cols;
          const correct = i < filledN;
          return (
            <rect
              key={i}
              x={cc * (cell + gap)}
              y={rr * (cell + gap)}
              width={cell}
              height={cell}
              rx={2.5}
              fill={correct ? COLORS.WIN_GREEN : COLORS.SIMD_AMBER}
              fillOpacity={correct ? 0.9 : 0.85}
              stroke={correct ? COLORS.GREEN_DEEP : COLORS.AMBER_DEEP}
              strokeWidth={0.5}
              strokeOpacity={0.5}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Legend swatch={COLORS.WIN_GREEN} label={`correct · ${filled} of 100`} ink={COLORS.GREEN_DEEP} />
        <Legend swatch={COLORS.SIMD_AMBER} label={`missed · ${100 - filled} of 100 (≈299)`} ink={COLORS.AMBER_DEEP} />
        <span style={{ fontFamily: FONTS.MONO, fontSize: 7.5, color: COLORS.INK_SUBTLE }}>each ▢ = 1% = 100 digits</span>
      </div>
    </ChartCard>
  );
};

const Legend: React.FC<{ swatch: string; label: string; ink: string }> = ({ swatch, label, ink }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONTS.MONO, fontSize: 8, fontWeight: 600, color: ink }}>
    <span style={{ width: 9, height: 9, borderRadius: 2, background: swatch }} />
    {label}
  </span>
);

// ── SlopeChart — GFLOP/s left → right ───────────────────────────────────────
export const SlopeChart: React.FC<{
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  unit: string;
  delta: string;
  accent?: string;
  source?: string;
}> = ({ leftLabel, rightLabel, leftValue, rightValue, unit, delta, accent = COLORS.GREEN_DEEP, source }) => {
  const W = 240;
  const H = 150;
  const padX = 42;
  const padTop = 20;
  const padBot = 26;
  const maxV = Math.max(leftValue, rightValue) * 1.12;
  const y = (v: number) => padTop + (1 - v / maxV) * (H - padTop - padBot);
  const xL = padX;
  const xR = W - padX;
  return (
    <ChartCard label={`${unit} · scaling`} accent={accent} source={source ?? "benchmarkData.ts:36"}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* baseline */}
        <line x1={xL} y1={H - padBot} x2={xR} y2={H - padBot} stroke={COLORS.HAIRLINE} strokeWidth={0.8} />
        {/* verticals */}
        <line x1={xL} y1={padTop - 6} x2={xL} y2={H - padBot} stroke={COLORS.HAIRLINE} strokeWidth={0.6} strokeDasharray="2 3" />
        <line x1={xR} y1={padTop - 6} x2={xR} y2={H - padBot} stroke={COLORS.HAIRLINE} strokeWidth={0.6} strokeDasharray="2 3" />
        {/* slope */}
        <line x1={xL} y1={y(leftValue)} x2={xR} y2={y(rightValue)} stroke={accent} strokeWidth={2.4} strokeLinecap="round" />
        {/* dots */}
        <circle cx={xL} cy={y(leftValue)} r={5} fill={COLORS.STEEL} stroke={COLORS.STEEL_DEEP} strokeWidth={1} />
        <circle cx={xR} cy={y(rightValue)} r={5.5} fill={COLORS.WIN_GREEN} stroke={accent} strokeWidth={1} />
        {/* value labels */}
        <text x={xL} y={y(leftValue) - 10} textAnchor="middle" fontFamily={MONO} fontSize={13} fontWeight={700} fill={COLORS.STEEL_DEEP}>
          {leftValue}
        </text>
        <text x={xR} y={y(rightValue) - 11} textAnchor="middle" fontFamily={MONO} fontSize={15} fontWeight={700} fill={accent}>
          {rightValue}
        </text>
        {/* delta badge mid-slope */}
        <text x={(xL + xR) / 2} y={(y(leftValue) + y(rightValue)) / 2 - 6} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={700} fill={accent}>
          {delta}
        </text>
        {/* category labels */}
        <text x={xL} y={H - padBot + 14} textAnchor="middle" fontFamily={MONO} fontSize={8} fontWeight={600} fill={COLORS.INK_MUTED}>
          {leftLabel}
        </text>
        <text x={xR} y={H - padBot + 14} textAnchor="middle" fontFamily={MONO} fontSize={8} fontWeight={600} fill={COLORS.INK}>
          {rightLabel}
        </text>
      </svg>
      <Caption>matmul 256×256 · the same kernel, threaded + native — {delta} the throughput.</Caption>
    </ChartCard>
  );
};

// ── Dumbbell — 1-thread → omp+native per op ─────────────────────────────────
export type DumbRow = { op: string; base: number; opt: number; factor: string; win: boolean };
export const Dumbbell: React.FC<{ rows: DumbRow[]; accent?: string; source?: string }> = ({
  rows,
  accent = COLORS.GREEN_DEEP,
  source = "benchmarkData.ts:26-93",
}) => {
  const W = 560;
  const rowH = 30;
  const padL = 118;
  const padR = 74;
  const padTop = 26;
  const plotW = W - padL - padR;
  const H = padTop + rows.length * rowH + 20;
  const lo = 3; // µs
  const hi = 6000; // µs
  const lx = (v: number) => padL + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * plotW;
  const ticks = [10, 100, 1000];
  return (
    <ChartCard label="1-thread → omp+native · µs (log)" accent={accent} source={source}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* gridlines */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={lx(t)} y1={padTop - 8} x2={lx(t)} y2={H - 16} stroke={COLORS.HAIRLINE} strokeWidth={0.6} strokeDasharray="2 3" />
            <text x={lx(t)} y={H - 4} textAnchor="middle" fontFamily={MONO} fontSize={8} fill={COLORS.INK_SUBTLE}>
              {t >= 1000 ? `${t / 1000}ms` : `${t}µs`}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = padTop + i * rowH + rowH / 2;
          const xb = lx(r.base);
          const xo = lx(r.opt);
          const optColor = r.win ? COLORS.WIN_GREEN : COLORS.SIMD_AMBER;
          const optInk = r.win ? COLORS.GREEN_DEEP : COLORS.AMBER_DEEP;
          return (
            <g key={r.op}>
              <text x={padL - 12} y={y + 3} textAnchor="end" fontFamily={MONO} fontSize={9.5} fontWeight={600} fill={COLORS.INK}>
                {r.op}
              </text>
              <line x1={xb} y1={y} x2={xo} y2={y} stroke={optInk} strokeWidth={1.6} strokeOpacity={0.5} />
              {/* baseline dot */}
              <circle cx={xb} cy={y} r={4.5} fill={COLORS.STEEL} stroke={COLORS.STEEL_DEEP} strokeWidth={0.8} />
              {/* optimized dot */}
              <circle cx={xo} cy={y} r={5} fill={optColor} stroke={optInk} strokeWidth={0.9} />
              <text x={W - padR + 10} y={y + 3} textAnchor="start" fontFamily={MONO} fontSize={9} fontWeight={700} fill={optInk}>
                {r.factor}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Legend swatch={COLORS.STEEL} label="1-thread" ink={COLORS.STEEL_DEEP} />
        <Legend swatch={COLORS.WIN_GREEN} label="omp+native · faster ←" ink={COLORS.GREEN_DEEP} />
        <Legend swatch={COLORS.SIMD_AMBER} label="omp+native · slower →" ink={COLORS.AMBER_DEEP} />
      </div>
    </ChartCard>
  );
};

// ── ScatterQuadrant — speedup vs baseline cost (the crossover) ───────────────
export type ScatterPt = { op: string; base: number; factor: number; win: boolean; dx?: number; dy?: number };
export const ScatterQuadrant: React.FC<{ pts: ScatterPt[]; accent?: string; source?: string }> = ({
  pts,
  accent = COLORS.AMBER_DEEP,
  source = "benchmarkData.ts:26-90",
}) => {
  const W = 300;
  const H = 200;
  const padL = 40;
  const padR = 16;
  const padTop = 16;
  const padBot = 34;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const xlo = 3, xhi = 6000; // µs baseline
  const ylo = 0.18, yhi = 4.2; // factor (log)
  const px = (v: number) => padL + ((Math.log10(v) - Math.log10(xlo)) / (Math.log10(xhi) - Math.log10(xlo))) * plotW;
  const py = (v: number) => padTop + (1 - (Math.log10(v) - Math.log10(ylo)) / (Math.log10(yhi) - Math.log10(ylo))) * plotH;
  const xticks = [10, 100, 1000];
  const yticks = [0.25, 0.5, 1, 2, 4];
  return (
    <ChartCard label="speedup vs baseline cost" accent={accent} source={source}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* break-even band */}
        <rect x={padL} y={py(1)} width={plotW} height={py(ylo) - py(1)} fill={COLORS.SIMD_AMBER} fillOpacity={0.05} />
        <rect x={padL} y={padTop} width={plotW} height={py(1) - padTop} fill={COLORS.WIN_GREEN} fillOpacity={0.05} />
        {/* axes */}
        <line x1={padL} y1={padTop} x2={padL} y2={H - padBot} stroke={COLORS.HAIRLINE} strokeWidth={0.8} />
        <line x1={padL} y1={H - padBot} x2={W - padR} y2={H - padBot} stroke={COLORS.HAIRLINE} strokeWidth={0.8} />
        {/* break-even line */}
        <line x1={padL} y1={py(1)} x2={W - padR} y2={py(1)} stroke={COLORS.INK_MUTED} strokeWidth={0.8} strokeDasharray="4 3" />
        <text x={W - padR} y={py(1) - 4} textAnchor="end" fontFamily={MONO} fontSize={7.5} fontWeight={700} fill={COLORS.INK_MUTED}>
          break-even 1.0×
        </text>
        {/* y ticks */}
        {yticks.map((t) => (
          <text key={t} x={padL - 5} y={py(t) + 3} textAnchor="end" fontFamily={MONO} fontSize={7.5} fill={COLORS.INK_SUBTLE}>
            {t}×
          </text>
        ))}
        {/* x ticks */}
        {xticks.map((t) => (
          <text key={t} x={px(t)} y={H - padBot + 12} textAnchor="middle" fontFamily={MONO} fontSize={7.5} fill={COLORS.INK_SUBTLE}>
            {t >= 1000 ? `${t / 1000}ms` : `${t}µs`}
          </text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle" fontFamily={MONO} fontSize={8} fill={COLORS.INK_MUTED}>
          1-thread baseline cost →
        </text>
        {/* points */}
        {pts.map((p) => {
          const color = p.win ? COLORS.WIN_GREEN : COLORS.SIMD_AMBER;
          const ink = p.win ? COLORS.GREEN_DEEP : COLORS.AMBER_DEEP;
          return (
            <g key={p.op}>
              <circle cx={px(p.base)} cy={py(p.factor)} r={5} fill={color} fillOpacity={0.9} stroke={ink} strokeWidth={1} />
              <text
                x={px(p.base) + (p.dx ?? 8)}
                y={py(p.factor) + (p.dy ?? 3)}
                textAnchor={((p.dx ?? 8) < 0) ? "end" : "start"}
                fontFamily={MONO}
                fontSize={7.5}
                fontWeight={600}
                fill={ink}
              >
                {p.op}
              </text>
            </g>
          );
        })}
      </svg>
      <Caption>Above the line, threading pays; below, it costs. The slower an op is single-threaded, the more parallelism helps.</Caption>
    </ChartCard>
  );
};

// ── PerIterUnits — doubles retired / iteration (small multiples) ─────────────
export const PerIterUnits: React.FC<{ accent?: string }> = ({ accent = COLORS.AMBER_DEEP }) => {
  const rows = [
    { label: "AVX-512", n: 16, lanes: 8, reg: "__m512d" },
    { label: "AVX2", n: 8, lanes: 4, reg: "__m256d" },
    { label: "scalar", n: 1, lanes: 1, reg: "double", muted: true },
  ];
  const cell = 13;
  const gap = 3;
  return (
    <ChartCard label="doubles / iteration" accent={accent} source="NeuralNet.cpp:49-124">
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 52, fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 700, color: r.muted ? COLORS.STEEL_DEEP : COLORS.INK }}>
              {r.label}
            </span>
            <svg width={16 * (cell + gap)} height={cell + 2} style={{ display: "block", overflow: "visible", flexShrink: 0 }}>
              {Array.from({ length: r.n }).map((_, i) => (
                <rect
                  key={i}
                  x={i * (cell + gap)}
                  y={1}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={r.muted ? COLORS.STEEL : COLORS.SIMD_AMBER}
                  fillOpacity={r.muted ? 0.5 : 0.85}
                  stroke={r.muted ? COLORS.STEEL_DEEP : COLORS.AMBER_DEEP}
                  strokeWidth={0.5}
                  strokeOpacity={0.4}
                />
              ))}
            </svg>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, color: r.muted ? COLORS.STEEL_DEEP : COLORS.AMBER_DEEP, minWidth: 22 }}>
              {r.n}×
            </span>
          </div>
        ))}
      </div>
      <Caption>Two accumulators × the register width — 16 doubles retired per AVX-512 iteration, against the scalar loop's one.</Caption>
    </ChartCard>
  );
};

// ── AccumPipeline — the wasm128 dual-accumulator hot loop (schematic) ────────
export const AccumPipeline: React.FC<{ accent?: string }> = ({ accent = COLORS.AMBER_DEEP }) => {
  const boxX = 40;
  const boxW = 96;
  const accs = [
    { y: 28, label: "acc0", off: "k, k+1" },
    { y: 92, label: "acc1", off: "k+2, k+3" },
  ];
  const midY = (accs[0]!.y + 15 + accs[1]!.y + 15) / 2; // vertical center between the two rows
  return (
    <ChartCard label="wasm128 hot loop" accent={accent} source="NeuralNet.cpp:195">
      <svg viewBox="0 0 262 156" width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* stream in — kept on its own row, clear of the acc0 label */}
        <text x={2} y={11} fontFamily={MONO} fontSize={8} fontWeight={700} fill={COLORS.INK_MUTED}>row · x  →  two accumulators</text>
        {accs.map((a) => (
          <g key={a.label}>
            {/* label above the box */}
            <text x={boxX} y={a.y - 6} fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={COLORS.AMBER_DEEP}>{a.label} · f64x2</text>
            {/* the register box + two f64 lanes */}
            <rect x={boxX} y={a.y} width={boxW} height={30} rx={4} fill={COLORS.SIMD_AMBER} fillOpacity={0.1} stroke={COLORS.AMBER_DEEP} strokeWidth={0.9} />
            <rect x={boxX + 6} y={a.y + 6} width={38} height={18} rx={2} fill={COLORS.SIMD_AMBER} fillOpacity={0.78} />
            <rect x={boxX + 50} y={a.y + 6} width={38} height={18} rx={2} fill={COLORS.SIMD_AMBER} fillOpacity={0.78} />
            {/* caption below the box */}
            <text x={boxX} y={a.y + 42} fontFamily={MONO} fontSize={7} fill={COLORS.INK_SUBTLE}>mul → add · {a.off}</text>
            {/* feed arrow */}
            <line x1={18} y1={a.y + 15} x2={boxX} y2={a.y + 15} stroke={COLORS.AMBER_DEEP} strokeWidth={0.9} strokeDasharray="3 2" />
            {/* merge arrow to reduce */}
            <line x1={boxX + boxW} y1={a.y + 15} x2={182} y2={midY} stroke={COLORS.AMBER_DEEP} strokeWidth={0.9} strokeDasharray="3 2" />
          </g>
        ))}
        {/* reduce block */}
        <rect x={182} y={midY - 17} width={74} height={34} rx={4} fill={COLORS.GROUND} stroke={COLORS.AMBER_DEEP} strokeWidth={1} />
        <text x={219} y={midY - 2} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={COLORS.SKY_SOFT}>reduce</text>
        <text x={219} y={midY + 9} textAnchor="middle" fontFamily={MONO} fontSize={6.5} fill={COLORS.ON_DARK_MUTED}>lanes 0,1 + tail</text>
      </svg>
      <Caption>Two independent f64x2 accumulators hide add latency; a two-lane reduction and a scalar tail close the loop.</Caption>
    </ChartCard>
  );
};
