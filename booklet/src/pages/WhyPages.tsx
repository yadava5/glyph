import React from "react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION, SECTION_INK } from "../theme";
import { WHY, ISAS } from "../content";
import { PullQuote } from "../primitives/PullQuote";
import { SourceNote } from "../primitives/SourceNote";
import { Prose, HangingNote, SignalStrip, CompareColumns, ReframeList } from "./kit";

type PageProps = { parity: "recto" | "verso"; pageNumber: number; totalPages: number };

const STEEL = SECTION["01_WHY"];
const STEEL_INK = SECTION_INK["01_WHY"];

/** Eight lanes, one busy — the scalar loop uses a single lane while the width
 *  the silicon offers (AVX-512 = 8 doubles) sits idle. Schematic of the coda. */
const IdleLanes: React.FC = () => (
  <div style={{ marginTop: 18, border: `0.5pt solid ${COLORS.HAIRLINE}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "13px 15px" }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: STEEL_INK }}>the machine's width · 1 of 8 lanes busy</span>
      <span style={{ fontFamily: FONTS.MONO, fontSize: 7.5, color: COLORS.INK_SUBTLE }}>AVX-512 · __m512d · 8 doubles</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
      {Array.from({ length: 8 }, (_, i) => {
        const busy = i === 0;
        return (
          <div key={i} style={{ height: 26, borderRadius: 3, background: busy ? COLORS.STEEL_DEEP : "transparent", border: busy ? "none" : `1px solid ${COLORS.HAIRLINE_STRONG}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.MONO, fontSize: 7, fontWeight: 700, color: busy ? COLORS.PAPER : COLORS.INK_SUBTLE }}>
            {busy ? "scalar" : "idle"}
          </div>
        );
      })}
    </div>
    <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, color: COLORS.INK_MUTED, marginTop: 9 }}>
      One lane does arithmetic; seven wait. A hand-written kernel puts all eight to work every iteration.
    </div>
  </div>
);

/** Scalar vs the four ISA widths — the doubles-per-register each kernel fills,
 *  the width the auto-vectorizer leaves unused. Numbers from ISAS.lanes. */
const LaneWidths: React.FC = () => {
  const rows = [
    { label: "scalar", w: 1, note: "one lane · the starter" },
    ...ISAS.map((k) => ({ label: k.label, w: k.lanes, note: `${k.reg}` })),
  ];
  return (
    <div style={{ marginTop: 20, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 12 }}>
      <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: STEEL_INK, marginBottom: 10 }}>
        the width that goes unused · doubles / register
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => {
          const isScalar = r.label === "scalar";
          const c = isScalar ? COLORS.STEEL_DEEP : COLORS.SKY_DEEP;
          return (
            <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1in 1fr 1.4in", alignItems: "center", columnGap: 12 }}>
              <span style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 700, color: c }}>{r.label}</span>
              <span style={{ display: "flex", gap: 3 }}>
                {Array.from({ length: r.w }, (_, i) => (
                  <span key={i} style={{ width: 16, height: 14, borderRadius: 2, background: isScalar ? COLORS.STEEL_TINT : COLORS.SKY_TINT, borderTop: `2px solid ${c}` }} />
                ))}
                <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, color: c, marginLeft: 4, alignSelf: "center" }}>{r.w}×</span>
              </span>
              <span style={{ fontFamily: FONTS.MONO, fontSize: 7.5, color: COLORS.INK_SUBTLE, textAlign: "right" }}>{r.note}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** One loop fanning out to four ISA kernels — the §02 preview. From ISAS. */
const IsaFan: React.FC = () => (
  <div style={{ marginTop: 20, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 12 }}>
    <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: STEEL_INK, marginBottom: 10 }}>
      one loop · four ISAs — what §02 opens on
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1.1in 20px 1fr", alignItems: "center", columnGap: 8 }}>
      <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${STEEL_INK}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "10px 12px", textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 11, fontWeight: 700, color: COLORS.INK }}>row · x</div>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 7.5, color: COLORS.INK_MUTED, marginTop: 2 }}>the hot loop</div>
      </div>
      <span style={{ textAlign: "center", color: COLORS.HAIRLINE_STRONG, fontSize: 14 }}>→</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {ISAS.map((k) => (
          <div key={k.id} style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderTop: `2.5px solid ${COLORS.SKY_DEEP}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, color: COLORS.SKY_DEEP }}>{k.label}</span>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 7, color: COLORS.INK_MUTED }}>{k.perIter}× / iter</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── p5 · why-scalar — the coursework starter ───────────────────────────────
export const WhyScalarPage: React.FC<PageProps> = (p) => {
  const d = WHY.scalar;
  return (
    <BodyPage {...p} sectionLabel="WHY" sectionColor={STEEL_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <PullQuote color={COLORS.INK} style={{ maxWidth: "6.3in", marginBottom: 18 }}>
        “{d.pullQuote}”
      </PullQuote>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", rowGap: 4, maxWidth: "6.3in" }}>
        <Prose items={d.body} />
      </div>
      <HangingNote label="The turn" accent={STEEL} accentInk={STEEL_INK} style={{ marginTop: 12, marginBottom: 20 }}>
        {d.coda}
      </HangingNote>
      <SignalStrip items={d.signals} />
      <IdleLanes />
      <SourceNote style={{ marginTop: 16 }}>source · LandingPage.tsx:174 · apps/server.cpp:23-26 (baseline: intentionally not optimized)</SourceNote>
    </BodyPage>
  );
};

// ── p6 · why-floor — the compiler leaves it on the floor ───────────────────
export const WhyFloorPage: React.FC<PageProps> = (p) => {
  const d = WHY.floor;
  return (
    <BodyPage {...p} sectionLabel="WHY" sectionColor={STEEL_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 22px", maxWidth: "6.2in" }}>
        {d.lede}
      </p>
      <CompareColumns
        leftTitle={d.beforeTitle}
        left={d.before}
        rightTitle={d.withTitle}
        right={d.with}
        leftAccent={STEEL_INK}
        rightAccent={COLORS.SKY_DEEP}
      />
      <div style={{ marginTop: 22, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 12 }}>
        <PullQuote size="small" color={COLORS.INK} style={{ maxWidth: "6.4in" }}>
          {d.gate}
        </PullQuote>
      </div>
      <LaneWidths />
      <SourceNote style={{ marginTop: 16 }}>source · src/NeuralNet.cpp:186-193 (“exactly what LLVM’s autovectorizer declines to do”)</SourceNote>
    </BodyPage>
  );
};

// ── p7 · why-hotloop — the whole cost is one dot product ───────────────────
export const WhyHotloopPage: React.FC<PageProps> = (p) => {
  const d = WHY.hotloop;
  return (
    <BodyPage {...p} sectionLabel="WHY" sectionColor={STEEL_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ maxWidth: "6.3in" }}>
        <Prose items={d.body} />
      </div>
      <div style={{ margin: "18px 0", borderLeft: `2.5px solid ${STEEL}`, paddingLeft: 16 }}>
        <PullQuote color={COLORS.INK} style={{ maxWidth: "6in" }}>
          {d.thesis}
        </PullQuote>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", columnGap: 30, alignItems: "center", marginTop: 8 }}>
        <ReframeList rows={d.reframe} accent={STEEL_INK} />
        <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 15, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: 0 }}>
          {d.handoff}
        </p>
      </div>
      <IsaFan />
      <SourceNote style={{ marginTop: 18 }}>source · src/NeuralNet.cpp:224-246 (gemv hot loop) · benchmarkData.ts:26-66</SourceNote>
    </BodyPage>
  );
};
