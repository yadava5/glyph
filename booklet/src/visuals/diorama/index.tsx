import React from "react";
import type { SectionKey } from "../../theme";
import { COLORS } from "../../theme";
import { SceneFrame } from "./primitives";

/**
 * SectionKey → chapter-divider line-art. fast-mnist's five signatures, all
 * near-white engineering linework on the dark divider ground, each carrying
 * its own single accent:
 *
 *   WHY     the scalar treadmill — one lane busy, seven idle (steel)
 *   HOW     the four ISA lanes — one dot product, four widths (amber)
 *   INSIDE  the wasm engine — module → net → live gauge (sky)
 *   PROOF   the benchmark bars — baseline vs vectorized, 97.01% (green)
 *   BUILD   the toolchain scaffold — C++ → wasm → React (violet)
 */

const LINE = COLORS.ON_DARK;

const mono = (extra?: React.SVGProps<SVGTextElement>): React.SVGProps<SVGTextElement> => ({
  fontFamily: "ui-monospace, monospace",
  ...extra,
});

// ── 01 WHY — the scalar treadmill (one lane of eight) ──────────────────────
const WhyScalarTreadmill: React.FC = () => {
  const STEEL = COLORS.STEEL;
  const cell = 20;
  const regX = 46;
  const regY = 70;
  return (
    <SceneFrame lineColor={LINE} cornerLabels={{ topLeft: "SCALAR · 1 OF 8", bottomRight: "ON THE FLOOR" }}>
      {/* register of 8 lanes — only lane 0 lit */}
      <text x={regX} y={regY - 10} {...mono({ fontSize: 6, letterSpacing: "1", fill: "currentColor", opacity: 0.7 })}>
        register · 8 f64 lanes
      </text>
      {Array.from({ length: 8 }).map((_, i) => {
        const lit = i === 0;
        return (
          <rect
            key={i}
            x={regX + i * (cell - 4)}
            y={regY}
            width={cell - 6}
            height={cell}
            rx={2}
            fill={lit ? STEEL : "currentColor"}
            fillOpacity={lit ? 0.85 : 0.06}
            stroke="currentColor"
            strokeWidth={0.7}
            strokeOpacity={lit ? 0.9 : 0.35}
          />
        );
      })}

      {/* data queue feeding one narrow channel into lane 0 */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={30} y={120 + i * 16} width={12} height={12} rx={1.5} fill="currentColor" fillOpacity={0.14} stroke="currentColor" strokeWidth={0.6} />
      ))}
      <path d="M 42 126 C 70 128 70 96 66 92" fill="none" stroke={STEEL} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
      <text x={78} y={150} {...mono({ fontSize: 5.5, letterSpacing: "0.6", fill: "currentColor", opacity: 0.8 })}>
        one multiply,
      </text>
      <text x={78} y={159} {...mono({ fontSize: 5.5, letterSpacing: "0.6", fill: "currentColor", opacity: 0.8 })}>
        one add, repeat
      </text>

      {/* the seven idle lanes lying on the floor */}
      <line x1={24} y1={224} x2={192} y2={224} stroke="currentColor" strokeWidth={0.7} opacity={0.4} />
      <text x={24} y={216} {...mono({ fontSize: 6, letterSpacing: "1", fill: STEEL, opacity: 0.85 })}>
        7 idle lanes
      </text>
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={30 + i * 22} y={228} width={18} height={7} rx={1.5} fill={STEEL} fillOpacity={0.12} stroke={STEEL} strokeWidth={0.6} strokeOpacity={0.5} />
      ))}
    </SceneFrame>
  );
};

// ── 02 HOW — the four ISA lanes ────────────────────────────────────────────
const HowLanes: React.FC = () => {
  const AMBER = COLORS.SIMD_AMBER;
  const rows = [
    { label: "AVX-512", lanes: 8 },
    { label: "AVX2", lanes: 4 },
    { label: "NEON", lanes: 2 },
    { label: "wasm128", lanes: 2 },
  ];
  const barX = 60;
  const barW = 132;
  const top = 60;
  const h = 26;
  const gap = 22;
  return (
    <SceneFrame lineColor={LINE} cornerLabels={{ topLeft: "4 ISAs", bottomRight: "ONE DOT PRODUCT" }}>
      {/* input row·x feeding all four lanes */}
      <text x={16} y={40} {...mono({ fontSize: 6, letterSpacing: "1", fill: "currentColor", opacity: 0.7 })}>row · x →</text>
      {rows.map((r, ri) => {
        const y = top + ri * (h + gap);
        const seg = (barW - 4) / r.lanes;
        return (
          <g key={r.label}>
            <path d={`M 26 44 C 46 ${y + h / 2} 46 ${y + h / 2} ${barX} ${y + h / 2}`} fill="none" stroke={AMBER} strokeWidth={0.7} strokeOpacity={0.4} strokeDasharray="3 3" />
            <rect x={barX} y={y} width={barW} height={h} rx={3} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeWidth={0.8} strokeOpacity={0.5} />
            {Array.from({ length: r.lanes }).map((_, s) => (
              <rect key={s} x={barX + 2 + s * seg} y={y + 2} width={seg - 2} height={h - 4} rx={1.5} fill={AMBER} fillOpacity={0.8} />
            ))}
            <text x={barX - 4} y={y + h / 2 + 2} textAnchor="end" {...mono({ fontSize: 6, fontWeight: 700, fill: "currentColor" })}>{r.label}</text>
            <text x={barX + barW + 4} y={y + h / 2 + 2} {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.7 })}>{r.lanes}×</text>
          </g>
        );
      })}
    </SceneFrame>
  );
};

// ── 03 INSIDE — the wasm engine room ───────────────────────────────────────
const InsideEngineWasm: React.FC = () => {
  const SKY = COLORS.SKY;
  return (
    <SceneFrame lineColor={LINE} cornerLabels={{ topLeft: "WASM128 · -msimd128", bottomRight: "THIS PAGE" }}>
      {/* input raster */}
      <rect x={24} y={70} width={34} height={44} rx={3} fill={SKY} fillOpacity={0.08} stroke={SKY} strokeWidth={0.9} />
      {Array.from({ length: 5 }).map((_, r) =>
        Array.from({ length: 4 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={27 + c * 7.5} y={73 + r * 8} width={6} height={6.5} rx={0.8} fill={SKY} fillOpacity={(r + c) % 3 === 0 ? 0.7 : 0.16} />
        )),
      )}
      <text x={24} y={126} {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.7 })}>784 in</text>

      {/* the module cube */}
      <rect x={80} y={64} width={64} height={56} rx={4} fill="currentColor" fillOpacity={0.06} stroke={SKY} strokeWidth={1.1} />
      <text x={112} y={88} textAnchor="middle" {...mono({ fontSize: 8, fontWeight: 700, fill: SKY })}>wasm</text>
      <text x={112} y={100} textAnchor="middle" {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.75 })}>dot_wasm128</text>
      <text x={112} y={110} textAnchor="middle" {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.6 })}>40 KB · f64x2</text>
      <path d="M 58 92 L 80 92" stroke={SKY} strokeWidth={0.9} strokeDasharray="3 2" />

      {/* live gauge */}
      <text x={40} y={168} {...mono({ fontSize: 6, letterSpacing: "1", fill: SKY, opacity: 0.85 })}>live · scalar vs simd</text>
      <rect x={40} y={176} width={130} height={12} rx={2} fill={COLORS.STEEL} fillOpacity={0.4} />
      <text x={166} y={185} textAnchor="end" {...mono({ fontSize: 6, fontWeight: 700, fill: LINE })}>scalar</text>
      <rect x={40} y={194} width={78} height={12} rx={2} fill={COLORS.WIN_GREEN} fillOpacity={0.85} />
      <text x={122} y={204} {...mono({ fontSize: 7, fontWeight: 700, fill: COLORS.WIN_GREEN })}>~1.7×</text>

      {/* network glyph */}
      {[0, 1, 2].map((col) => {
        const n = col === 0 ? 4 : col === 1 ? 6 : 3;
        const x = 46 + col * 44;
        return Array.from({ length: n }).map((_, i) => (
          <circle key={`${col}-${i}`} cx={x} cy={230 + i * 12} r={2.4} fill={col === 2 ? COLORS.WIN_GREEN : "none"} fillOpacity={0.8} stroke={SKY} strokeWidth={0.8} />
        ));
      })}
      <text x={92} y={262} textAnchor="middle" {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.7 })}>784 → 100 → 10</text>
    </SceneFrame>
  );
};

// ── 04 PROOF — the benchmark bars + accuracy stamp ─────────────────────────
const ProofBars: React.FC = () => {
  const GREEN = COLORS.WIN_GREEN;
  const STEEL = COLORS.STEEL;
  const bars = [
    { label: "matmul", base: 92, opt: 26, factor: "3.50×" },
    { label: "transpose", base: 70, opt: 36, factor: "1.95×" },
    { label: "axpy", base: 64, opt: 32, factor: "2.01×" },
  ];
  const baseY = 190;
  const x0 = 40;
  const gw = 46;
  return (
    <SceneFrame lineColor={LINE} cornerLabels={{ topLeft: "MEASURED · M2", bottomRight: "RE-RUNNABLE" }}>
      {/* baseline axis */}
      <line x1={28} y1={baseY} x2={196} y2={baseY} stroke="currentColor" strokeWidth={0.7} opacity={0.5} />
      {bars.map((b, i) => {
        const x = x0 + i * gw;
        return (
          <g key={b.label}>
            <rect x={x} y={baseY - b.base} width={16} height={b.base} rx={1.5} fill={STEEL} fillOpacity={0.35} stroke={STEEL} strokeWidth={0.6} />
            <rect x={x + 18} y={baseY - b.opt} width={16} height={b.opt} rx={1.5} fill={GREEN} fillOpacity={0.85} />
            <text x={x + 17} y={baseY + 10} textAnchor="middle" {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.75 })}>{b.label}</text>
            <text x={x + 17} y={baseY - b.base - 5} textAnchor="middle" {...mono({ fontSize: 6, fontWeight: 700, fill: GREEN })}>{b.factor}</text>
          </g>
        );
      })}
      <text x={40} y={70} {...mono({ fontSize: 6, letterSpacing: "1", fill: "currentColor", opacity: 0.7 })}>omp+native vs 1-thread</text>

      {/* accuracy stamp */}
      <circle cx={110} cy={244} r={30} fill="none" stroke={GREEN} strokeWidth={1.2} />
      <circle cx={110} cy={244} r={34} fill="none" stroke={GREEN} strokeWidth={0.5} strokeOpacity={0.4} strokeDasharray="2 3" />
      <text x={110} y={242} textAnchor="middle" {...mono({ fontSize: 11, fontWeight: 700, fill: GREEN })}>97.01%</text>
      <text x={110} y={254} textAnchor="middle" {...mono({ fontSize: 5, letterSpacing: "0.5", fill: "currentColor", opacity: 0.75 })}>9701 / 10000</text>
    </SceneFrame>
  );
};

// ── 05 BUILD — the toolchain scaffold ──────────────────────────────────────
const BuildScaffold: React.FC = () => {
  const VIOLET = COLORS.VIOLET;
  const stages = [
    { n: "1", label: "SCALAR", detail: "course C++ MLP" },
    { n: "2", label: "SIMD", detail: "AVX / NEON kernels" },
    { n: "3", label: "WASM", detail: "Emscripten · simd128" },
    { n: "4", label: "BENCH", detail: "live · vs scalar" },
    { n: "5", label: "WEB", detail: "React 19 · Vercel" },
  ];
  const x = 54;
  const top = 52;
  const gap = 42;
  const w = 118;
  const h = 30;
  return (
    <SceneFrame lineColor={LINE} cornerLabels={{ topLeft: "C++ → WASM → REACT", bottomRight: "THE JOURNEY" }}>
      {/* spine */}
      <line x1={x - 12} y1={top} x2={x - 12} y2={top + (stages.length - 1) * gap + h} stroke={VIOLET} strokeWidth={1} strokeOpacity={0.6} />
      {stages.map((s, i) => {
        const y = top + i * gap;
        return (
          <g key={s.label}>
            {i < stages.length - 1 && (
              <path d={`M ${x - 12} ${y + h} L ${x - 12} ${y + gap}`} stroke={VIOLET} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.6} />
            )}
            <circle cx={x - 12} cy={y + h / 2} r={7} fill={COLORS.GROUND} stroke={VIOLET} strokeWidth={1} />
            <text x={x - 12} y={y + h / 2 + 2.5} textAnchor="middle" {...mono({ fontSize: 7, fontWeight: 700, fill: VIOLET })}>{s.n}</text>
            <rect x={x} y={y} width={w} height={h} rx={3} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeWidth={0.8} strokeOpacity={0.5} />
            <text x={x + 10} y={y + 13} {...mono({ fontSize: 8, fontWeight: 700, fill: "currentColor" })}>{s.label}</text>
            <text x={x + 10} y={y + 24} {...mono({ fontSize: 5.5, fill: "currentColor", opacity: 0.7 })}>{s.detail}</text>
          </g>
        );
      })}
    </SceneFrame>
  );
};

export const DIORAMAS: Record<SectionKey, React.FC> = {
  "01_WHY": WhyScalarTreadmill,
  "02_HOW": HowLanes,
  "03_INSIDE": InsideEngineWasm,
  "04_PROOF": ProofBars,
  "05_BUILD": BuildScaffold,
};

export { WhyScalarTreadmill, HowLanes, InsideEngineWasm, ProofBars, BuildScaffold };
