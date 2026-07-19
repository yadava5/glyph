import React from "react";
import { COLORS, FONTS } from "../theme";

/**
 * Per-section "signature" visuals — one distinct diagram so the content pages
 * don't read as one template. Each renders on a light editorial card:
 *
 *   IsaLaneSignature      — the ISA-lane diagram: scalar's single lane vs the
 *                           4 SIMD kernels' widths (doubles per register).
 *   NetworkAnatomySignature — the 784 → 100 → 10 MLP sketch.
 *
 * (The live-bench visual moved to a radial gauge — see visuals/Charts.tsx
 * RadialGauge — so this file no longer carries a bar-chart signature.)
 */

const CARD: React.CSSProperties = {
  border: `0.5pt solid ${COLORS.HAIRLINE}`,
  borderRadius: 6,
  background: COLORS.PAPER_ELEVATED,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const CardHead: React.FC<{ label: string; accent: string; source: string }> = ({
  label,
  accent,
  source,
}) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
    <span
      style={{
        fontFamily: FONTS.MONO,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: accent,
      }}
    >
      {label}
    </span>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 7, color: COLORS.INK_SUBTLE }}>{source}</span>
  </div>
);

// ── ISA lanes — scalar's 1 lane vs the four kernels' widths ─────────────────

const LANE_ROWS: ReadonlyArray<{ label: string; lanes: number; reg: string; scalar?: boolean }> = [
  { label: "scalar", lanes: 1, reg: "double", scalar: true },
  { label: "AVX-512", lanes: 8, reg: "__m512d" },
  { label: "AVX2", lanes: 4, reg: "__m256d" },
  { label: "NEON", lanes: 2, reg: "float64x2" },
  { label: "wasm128", lanes: 2, reg: "v128 f64x2" },
];

const LANE_TRACK = 132; // px, the drawn width of a full 8-lane register

export const IsaLaneSignature: React.FC = () => (
  <div style={CARD}>
    <CardHead label="lanes / register" accent={COLORS.AMBER_DEEP} source="NeuralNet.cpp" />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {LANE_ROWS.map((row) => {
        const unit = LANE_TRACK / 8;
        return (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 56,
                fontFamily: FONTS.MONO,
                fontSize: 9,
                fontWeight: 700,
                color: row.scalar ? COLORS.STEEL_DEEP : COLORS.INK,
              }}
            >
              {row.label}
            </span>
            <svg width={LANE_TRACK} height={14} style={{ display: "block", flexShrink: 0 }}>
              {Array.from({ length: row.lanes }).map((_, s) => (
                <rect
                  key={s}
                  x={s * unit + 1}
                  y={1}
                  width={unit - 2}
                  height={12}
                  rx={1.5}
                  fill={row.scalar ? COLORS.STEEL : COLORS.SKY}
                  fillOpacity={row.scalar ? 0.55 : 0.85}
                />
              ))}
              {/* ghost of the full register width */}
              <rect x={0.5} y={0.5} width={LANE_TRACK - 1} height={13} rx={2} fill="none" stroke={COLORS.HAIRLINE} strokeWidth={0.6} />
            </svg>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 8, color: COLORS.INK_MUTED, minWidth: 62 }}>
              {row.lanes}× · {row.reg}
            </span>
          </div>
        );
      })}
    </div>
    <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, color: COLORS.INK_MUTED }}>
      One loop, five widths. The build selects the widest kernel the target
      supports — at compile time, so the dispatch is free.
    </div>
  </div>
);

// ── Network anatomy — 784 → 100 → 10 ───────────────────────────────────────

export const NetworkAnatomySignature: React.FC = () => {
  const hidden = Array.from({ length: 9 });
  const out = Array.from({ length: 10 });
  const inX = 30;
  const hidX = 108;
  const outX = 180;
  const colTop = 22;
  const colBot = 150;
  const hidY = (i: number) => colTop + (i * (colBot - colTop)) / (hidden.length - 1);
  const outY = (i: number) => colTop + (i * (colBot - colTop)) / (out.length - 1);
  return (
    <div style={CARD}>
      <CardHead label="784 → 100 → 10" accent={COLORS.SKY_DEEP} source="benchmarkData.ts:9-15" />
      <svg viewBox="0 0 210 168" width="100%" style={{ display: "block" }}>
        {/* edges: input block → hidden → output (representative) */}
        {hidden.map((_, h) =>
          out.map((_, o) => (
            <line key={`ho${h}-${o}`} x1={hidX} y1={hidY(h)} x2={outX} y2={outY(o)} stroke={COLORS.SKY} strokeWidth={0.25} strokeOpacity={0.28} />
          )),
        )}
        {hidden.map((_, h) => (
          <line key={`ih${h}`} x1={inX + 20} y1={86} x2={hidX} y2={hidY(h)} stroke={COLORS.SKY} strokeWidth={0.3} strokeOpacity={0.35} />
        ))}

        {/* input raster block (28×28, abstracted) */}
        <rect x={inX - 12} y={58} width={40} height={56} rx={3} fill={COLORS.SKY_TINT} stroke={COLORS.SKY_DEEP} strokeWidth={0.8} />
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => (
            <rect key={`px${r}-${c}`} x={inX - 8 + c * 6.4} y={62 + r * 8.2} width={5} height={6.4} rx={0.8} fill={COLORS.SKY} fillOpacity={(r + c) % 3 === 0 ? 0.75 : 0.18} />
          )),
        )}

        {/* hidden nodes */}
        {hidden.map((_, h) => (
          <circle key={`h${h}`} cx={hidX} cy={hidY(h)} r={3.4} fill={COLORS.PAPER} stroke={COLORS.SKY_DEEP} strokeWidth={1.1} />
        ))}
        {/* output nodes */}
        {out.map((_, o) => (
          <circle key={`o${o}`} cx={outX} cy={outY(o)} r={3.2} fill={COLORS.WIN_GREEN} fillOpacity={0.85} stroke={COLORS.GREEN_DEEP} strokeWidth={0.8} />
        ))}

        {/* column labels */}
        <text x={inX + 8} y={130} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={8} fontWeight={700} fill={COLORS.SKY_DEEP}>784</text>
        <text x={hidX} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={8} fontWeight={700} fill={COLORS.INK}>100 · sigmoid</text>
        <text x={outX} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={8} fontWeight={700} fill={COLORS.GREEN_DEEP}>10 · arg-max</text>
      </svg>
      <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, color: COLORS.INK_MUTED }}>
        79,510 parameters, two sigmoid layers, trained by the course's own
        backprop — the plain network the kernel makes fast.
      </div>
    </div>
  );
};
