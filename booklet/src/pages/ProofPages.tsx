import React from "react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION, SECTION_INK } from "../theme";
import { PROOF } from "../content";
import { StatBig } from "../primitives/StatBig";
import { PullQuote } from "../primitives/PullQuote";
import { SourceNote } from "../primitives/SourceNote";
import { Prose, HangingNote, CodePanel } from "./kit";
import { SlopeChart, WaffleUnit, Dumbbell, type DumbRow } from "../visuals/Charts";

type PageProps = { parity: "recto" | "verso"; pageNumber: number; totalPages: number };

const GREEN = SECTION["04_PROOF"];
const GREEN_INK = SECTION_INK["04_PROOF"];

// ── p19 · proof-speedups — two scoped figures ──────────────────────────────
type Scoped = { value: string; scope: string; workload: string; detail: string; caveat: string };
const ScopedCard: React.FC<{ tag: string; accent: string; data: Scoped }> = ({ tag, accent, data }) => (
  <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderTop: `3px solid ${accent}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>{tag}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontFamily: FONTS.MONO, fontSize: 46, fontWeight: 700, letterSpacing: "-0.03em", color: accent, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{data.value}</span>
      <span style={{ fontFamily: FONTS.MONO, fontSize: 10, fontWeight: 700, color: COLORS.INK, lineHeight: 1.25 }}>{data.scope}</span>
    </div>
    <div style={{ fontFamily: FONTS.MONO, fontSize: 9.5, color: COLORS.INK_MUTED }}>{data.workload}</div>
    <div style={{ fontFamily: FONTS.MONO, fontSize: 9.5, color: COLORS.INK, fontWeight: 600 }}>{data.detail}</div>
    <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 11.5, lineHeight: 1.35, color: COLORS.INK_MUTED, borderTop: `0.5pt solid ${COLORS.HAIRLINE}`, paddingTop: 8 }}>
      {data.caveat}
    </div>
  </div>
);

export const ProofSpeedupsPage: React.FC<PageProps> = (p) => {
  const d = PROOF.speedups;
  return (
    <BodyPage {...p} sectionLabel="PROOF" sectionColor={GREEN_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 18px", maxWidth: "6.3in" }}>
        {d.lede}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20 }}>
        <ScopedCard tag="native · committed" accent={GREEN_INK} data={d.native} />
        <ScopedCard tag="in-browser · live" accent={COLORS.SKY_DEEP} data={d.browser} />
      </div>
      <HangingNote label="The counter-example" accent={COLORS.STEEL} accentInk={COLORS.STEEL_DEEP} style={{ marginTop: 16 }}>
        {d.crossover}
      </HangingNote>
      {/* the native win, two ways: throughput slope + wall-clock delta */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.25fr 0.75fr", columnGap: 20, alignItems: "stretch" }}>
        <SlopeChart leftLabel="1-thread" rightLabel="omp+native" leftValue={6.9} rightValue={24.3} unit="GFLOP/s" delta="+3.5×" accent={GREEN_INK} source="benchmarkData.ts:36" />
        <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `3px solid ${GREEN_INK}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
          <div style={{ fontFamily: FONTS.MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: GREEN_INK }}>in wall-clock</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 16, fontWeight: 700, color: COLORS.STEEL_DEEP, fontVariantNumeric: "tabular-nums" }}>4.835ms</span>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 12, color: COLORS.INK_SUBTLE }}>→</span>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 20, fontWeight: 700, color: GREEN_INK, fontVariantNumeric: "tabular-nums" }}>1.380ms</span>
          </div>
          <div style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 600, color: COLORS.INK_MUTED }}>−71% · matmul 256×256</div>
          <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, lineHeight: 1.3, color: COLORS.INK_MUTED, borderTop: `0.5pt solid ${COLORS.HAIRLINE}`, paddingTop: 7 }}>
            Threading + native codegen, measured on the M2 — on top of the SIMD already in every config.
          </div>
        </div>
      </div>
      <SourceNote style={{ marginTop: 14 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// ── p20 · proof-accuracy — 97.01% ──────────────────────────────────────────
export const ProofAccuracyPage: React.FC<PageProps> = (p) => {
  const d = PROOF.accuracy;
  return (
    <BodyPage {...p} sectionLabel="PROOF" sectionColor={GREEN_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", columnGap: 30, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: FONTS.MONO, fontSize: 92, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 0.95, color: GREEN_INK, fontVariantNumeric: "tabular-nums" }}>
            {d.hero}
          </div>
          <div style={{ fontFamily: FONTS.MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.INK_MUTED, marginTop: 8, maxWidth: "3in" }}>
            {d.heroLabel}
          </div>
        </div>
        <div>
          <Prose items={[d.body]} />
          <div style={{ fontFamily: FONTS.MONO, fontSize: 11, fontWeight: 700, color: COLORS.INK, marginBottom: 14 }}>{d.exact}</div>
          <CodePanel caption={d.receiptLabel} code={d.receipt} accent={GREEN_INK} />
        </div>
      </div>
      {/* accuracy as a unit grid — every miss shown, not just the win */}
      <div style={{ marginTop: 20 }}>
        <WaffleUnit filled={97} accent={GREEN_INK} source="TestingSetList.txt · 10,000" />
      </div>
      <HangingNote label="On the record" accent={GREEN} accentInk={GREEN_INK} style={{ marginTop: 16 }}>
        {d.note}
      </HangingNote>
      <SourceNote style={{ marginTop: 14 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// ── p21 · proof-table — the full benchmark ─────────────────────────────────
const BenchRow: React.FC<{ op: string; base: string; opt: string; factor: string; win: boolean }> = ({ op, base, opt, factor, win }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.9fr", alignItems: "center", columnGap: 10, padding: "7px 0", borderBottom: `0.5pt solid ${COLORS.HAIRLINE}` }}>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 10, fontWeight: 600, color: COLORS.INK }}>{op}</span>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 9.5, color: COLORS.INK_MUTED, fontVariantNumeric: "tabular-nums" }}>{base}</span>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 9.5, color: COLORS.INK, fontVariantNumeric: "tabular-nums" }}>{opt}</span>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 10, fontWeight: 700, color: win ? COLORS.GREEN_DEEP : COLORS.AMBER_DEEP, textAlign: "right" }}>{factor}</span>
  </div>
);

export const ProofTablePage: React.FC<PageProps> = (p) => {
  const d = PROOF.table;
  return (
    <BodyPage {...p} sectionLabel="PROOF" sectionColor={GREEN_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 15, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 16px", maxWidth: "6.3in" }}>
        {d.lede}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.9fr", columnGap: 10, paddingBottom: 5, borderBottom: `1.5px solid ${COLORS.INK}` }}>
        {["operation", "1-thread", "omp+native", "factor"].map((h) => (
          <span key={h} style={{ fontFamily: FONTS.MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.INK_MUTED, textAlign: h === "factor" ? "right" : "left" }}>{h}</span>
        ))}
      </div>
      <div style={{ marginTop: 2 }}>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.1em", color: COLORS.GREEN_DEEP, margin: "8px 0 2px" }}>WINS — parallelism pays</div>
        {d.wins.map((r) => <BenchRow key={r.op} {...r} />)}
        <div style={{ fontFamily: FONTS.MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.1em", color: COLORS.AMBER_DEEP, margin: "10px 0 2px" }}>LOSSES — too small to thread</div>
        {d.losses.map((r) => <BenchRow key={r.op} {...r} />)}
      </div>
      <div style={{ marginTop: 12, background: COLORS.PAPER_ELEVATED, border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `3px solid ${COLORS.STEEL}`, borderRadius: 5, padding: "9px 12px", fontFamily: FONTS.SANS, fontSize: 10, lineHeight: 1.4, color: COLORS.INK }}>
        {d.classify}
      </div>
      {/* the same run as a dumbbell — wins pull left (faster), losses push right */}
      <div style={{ marginTop: 14 }}>
        <Dumbbell rows={TABLE_DUMB} accent={GREEN_INK} source="benchmarkData.ts:26-93" />
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONTS.MONO, fontSize: 8, color: COLORS.INK_MUTED, maxWidth: "4.4in" }}>{d.method}</span>
        <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 600, color: GREEN_INK }}>$ {d.reproduce}</span>
      </div>
      <SourceNote style={{ marginTop: 10 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// wins pull the omp+native dot left of the 1-thread dot; losses push it right.
const TABLE_DUMB: DumbRow[] = [
  { op: "matmul 256×256", base: 4835, opt: 1380, factor: "3.50×", win: true },
  { op: "transpose 1024", base: 978, opt: 502, factor: "1.95×", win: true },
  { op: "axpy 1024", base: 231, opt: 115, factor: "2.01×", win: true },
  { op: "transpose 128", base: 5.4, opt: 23.7, factor: "4.3× worse", win: false },
  { op: "axpy 256", base: 13.9, opt: 26.3, factor: "1.9× worse", win: false },
];

// ── p22 · proof-tests — 41 + 29 ────────────────────────────────────────────
export const ProofTestsPage: React.FC<PageProps> = (p) => {
  const d = PROOF.tests;
  return (
    <BodyPage {...p} sectionLabel="PROOF" sectionColor={GREEN_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ maxWidth: "6.4in", marginBottom: 16 }}>
        <Prose items={[d.body]} />
      </div>
      <div style={{ display: "flex", gap: 34, paddingTop: 14, paddingBottom: 16, borderTop: `1pt solid ${GREEN}`, borderBottom: `0.5pt solid ${COLORS.HAIRLINE}` }}>
        {d.stats.map((s, i) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <StatBig value={s.value} label={s.label} tier="metricMedium" color={i === 0 ? GREEN_INK : COLORS.INK} />
            <span style={{ fontFamily: FONTS.MONO, fontSize: 7.5, color: COLORS.INK_SUBTLE }}>{s.note}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
        {d.breakdown.map((b) => (
          <div key={b.k} style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: `0.5pt solid ${COLORS.HAIRLINE}`, paddingBottom: 5 }}>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 9.5, fontWeight: 700, color: GREEN_INK, minWidth: "1.7in" }}>{b.k}</span>
            <span style={{ fontFamily: FONTS.SANS, fontSize: 9.5, color: COLORS.INK_MUTED }}>{b.v}</span>
          </div>
        ))}
      </div>
      <HangingNote label="Reconciled" accent={GREEN} accentInk={GREEN_INK} style={{ marginTop: 16 }}>
        {d.honest}
      </HangingNote>
      <PullQuote size="small" color={COLORS.INK} style={{ marginTop: 16, maxWidth: "6.2in" }}>
        {d.handoffQuote}
      </PullQuote>
      <SourceNote style={{ marginTop: 14 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};
