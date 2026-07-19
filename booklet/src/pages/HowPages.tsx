import React from "react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION, SECTION_INK } from "../theme";
import { HOW } from "../content";
import { StatBig } from "../primitives/StatBig";
import { PullQuote } from "../primitives/PullQuote";
import { SourceNote } from "../primitives/SourceNote";
import { IsaLaneSignature } from "../visuals/IsaSignatures";
import { Prose, HangingNote, CodePanel, BandRows } from "./kit";

type PageProps = { parity: "recto" | "verso"; pageNumber: number; totalPages: number };

const AMBER = SECTION["02_HOW"];
const AMBER_INK = SECTION_INK["02_HOW"];

// Verbatim (condensed) kernel excerpts — src/NeuralNet.cpp via benchmarkData.ts.
const AVX512_SRC = `double dot512_rowvec(const double* row,
                     const double* x, size_t n) {
  __m512d acc0 = _mm512_setzero_pd(),
          acc1 = _mm512_setzero_pd();
  for (; k < n16; k += 16) {          // 16 doubles / iter
    acc0 = _mm512_fmadd_pd(ld(row+k),   ld(x+k),   acc0);
    acc1 = _mm512_fmadd_pd(ld(row+k+8), ld(x+k+8), acc1);
  }
  /* horizontal reduce + scalar tail */
}`;

const WASM_SRC = `double dot_wasm128_rowvec(const double* row,
                          const double* x, size_t n) {
  v128_t acc0 = wasm_f64x2_splat(0.0),
         acc1 = wasm_f64x2_splat(0.0);
  for (; k < n4; k += 4) {            // 4 doubles / iter
    acc0 = wasm_f64x2_add(acc0,
      wasm_f64x2_mul(ld(row+k),   ld(x+k)));
    acc1 = wasm_f64x2_add(acc1,
      wasm_f64x2_mul(ld(row+k+2), ld(x+k+2)));
  }
  /* extract lanes 0,1 + scalar tail */
}`;

// ── p9 · how-dispatch — four ISAs, one loop ────────────────────────────────
export const HowDispatchPage: React.FC<PageProps> = (p) => {
  const d = HOW.dispatch;
  return (
    <BodyPage {...p} sectionLabel="HOW" sectionColor={AMBER_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", columnGap: 26, alignItems: "start", marginTop: 6 }}>
        <div>
          <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 15, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 12px" }}>
            {d.lede}
          </p>
          <Prose items={[d.body]} />
          <IsaRail steps={d.steps} />
        </div>
        <IsaLaneSignature />
      </div>
      <SourceNote style={{ marginTop: 18 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

const IsaRail: React.FC<{ steps: typeof HOW.dispatch.steps }> = ({ steps }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
    {steps.map((s) => (
      <div
        key={s.label}
        style={{
          display: "grid",
          gridTemplateColumns: "22px 1fr auto",
          alignItems: "center",
          columnGap: 10,
          border: `0.5pt solid ${COLORS.HAIRLINE}`,
          borderLeft: `3px solid ${AMBER}`,
          borderRadius: 4,
          padding: "6px 10px",
        }}
      >
        <span style={{ fontFamily: FONTS.MONO, fontSize: 11, fontWeight: 700, color: AMBER_INK }}>{s.n}</span>
        <span style={{ fontFamily: FONTS.MONO, fontSize: 10.5, fontWeight: 700, color: COLORS.INK }}>
          {s.label}
          <span style={{ color: COLORS.INK_MUTED, fontWeight: 500 }}> · {s.detail}</span>
        </span>
        <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, color: COLORS.INK_SUBTLE }}>{s.accept}</span>
      </div>
    ))}
  </div>
);

// ── p10 · how-avx — the x86 wide lanes ─────────────────────────────────────
export const HowAvxPage: React.FC<PageProps> = (p) => {
  const d = HOW.avx;
  return (
    <BodyPage {...p} sectionLabel="HOW" sectionColor={AMBER_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 26, alignItems: "start" }}>
        <div>
          <Prose items={d.body} />
          <HangingNote label="FMA" accent={AMBER} accentInk={AMBER_INK} style={{ marginTop: 12 }}>
            {d.note}
          </HangingNote>
        </div>
        <CodePanel caption="src/NeuralNet.cpp · dot512_rowvec (condensed)" code={AVX512_SRC} accent={AMBER_INK} />
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 24, paddingTop: 16, borderTop: `1pt solid ${AMBER}` }}>
        <StatBig value={d.stat.value} label={d.stat.label} tier="metricMedium" color={AMBER_INK} />
        <StatBig value={d.stat2.value} label={d.stat2.label} tier="metricMedium" color={COLORS.INK} />
        <div style={{ flex: 1 }} />
      </div>
      <SourceNote style={{ marginTop: 16 }}>source · src/NeuralNet.cpp:49-74 (AVX-512) · :95-124 (AVX2)</SourceNote>
    </BodyPage>
  );
};

// ── p11 · how-neon — the ARM / M-series kernel ─────────────────────────────
export const HowNeonPage: React.FC<PageProps> = (p) => {
  const d = HOW.neon;
  return (
    <BodyPage {...p} sectionLabel="HOW" sectionColor={AMBER_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ maxWidth: "6.3in" }}>
        <Prose items={d.body} />
      </div>
      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: COLORS.PAPER_ELEVATED,
          border: `0.5pt solid ${COLORS.HAIRLINE}`,
          borderLeft: `3px solid ${AMBER}`,
          borderRadius: 6,
          padding: "12px 16px",
          maxWidth: "6.3in",
        }}
      >
        <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", color: AMBER_INK, whiteSpace: "nowrap" }}>
          THE COMMITTED RUN
        </span>
        <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 13.5, color: COLORS.INK, lineHeight: 1.35 }}>
          Apple M2 · clang 17 · Google Benchmark · run 20251226-154121 — the numbers in chapter 04 are this NEON kernel's.
        </span>
      </div>
      <HangingNote label="On the record" accent={AMBER} accentInk={AMBER_INK} style={{ marginTop: 16 }}>
        {d.note}
      </HangingNote>
      <div style={{ display: "flex", gap: 40, marginTop: 22, paddingTop: 16, borderTop: `1pt solid ${AMBER}` }}>
        <StatBig value={d.stat.value} label={d.stat.label} tier="metricSmall" color={AMBER_INK} />
        <StatBig value={d.stat2.value} label={d.stat2.label} tier="metricSmall" color={COLORS.INK} />
        <div style={{ flex: 1 }} />
      </div>
      <SourceNote style={{ marginTop: 16 }}>source · src/NeuralNet.cpp:146-165 (dot_neon_rowvec) · benchmarkData.ts:1-6</SourceNote>
    </BodyPage>
  );
};

// ── p12 · how-wasm — the fourth ISA, hand-written for the web ──────────────
export const HowWasmPage: React.FC<PageProps> = (p) => {
  const d = HOW.wasm;
  return (
    <BodyPage {...p} sectionLabel="HOW" sectionColor={AMBER_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 26, alignItems: "start" }}>
        <div>
          <Prose items={d.body} />
          <HangingNote label="New in v1.0" accent={AMBER} accentInk={AMBER_INK} style={{ marginTop: 12 }}>
            {d.note}
          </HangingNote>
        </div>
        <CodePanel caption="src/NeuralNet.cpp · dot_wasm128_rowvec (condensed)" code={WASM_SRC} accent={AMBER_INK} />
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 24, paddingTop: 16, borderTop: `1pt solid ${AMBER}` }}>
        <StatBig value={d.stat.value} label={d.stat.label} tier="metricMedium" color={AMBER_INK} />
        <StatBig value={d.stat2.value} label={d.stat2.label} tier="metricMedium" color={COLORS.INK} />
        <div style={{ flex: 1 }} />
      </div>
      <SourceNote style={{ marginTop: 16 }}>source · src/NeuralNet.cpp:195-215 · CMakeLists.txt:281 (-msimd128)</SourceNote>
    </BodyPage>
  );
};

// ── p13 · how-threads — OpenMP, honestly ───────────────────────────────────
export const HowThreadsPage: React.FC<PageProps> = (p) => {
  const d = HOW.threads;
  return (
    <BodyPage {...p} sectionLabel="HOW" sectionColor={AMBER_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 16px", maxWidth: "6.2in" }}>
        {d.lede}
      </p>
      <div style={{ maxWidth: "6.3in", marginBottom: 18 }}>
        <Prose items={[d.body]} />
      </div>
      <BandRows bands={d.bands} />
      <div style={{ marginTop: 18, borderLeft: `2.5px solid ${AMBER}`, paddingLeft: 16 }}>
        <PullQuote size="small" color={COLORS.INK} style={{ maxWidth: "6.2in" }}>
          {d.loopNote}
        </PullQuote>
      </div>
      <SourceNote style={{ marginTop: 16 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};
