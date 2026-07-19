import React from "react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION, SECTION_INK } from "../theme";
import { WHY } from "../content";
import { PullQuote } from "../primitives/PullQuote";
import { SourceNote } from "../primitives/SourceNote";
import { Prose, HangingNote, SignalStrip, CompareColumns, ReframeList } from "./kit";

type PageProps = { parity: "recto" | "verso"; pageNumber: number; totalPages: number };

const STEEL = SECTION["01_WHY"];
const STEEL_INK = SECTION_INK["01_WHY"];

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
      <SourceNote style={{ marginTop: 16 }}>source · LandingPage.tsx:174 · apps/server.cpp:24-25 (baseline: intentionally not optimized)</SourceNote>
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
      <SourceNote style={{ marginTop: 18 }}>source · src/NeuralNet.cpp (gemv hot loop) · benchmarkData.ts:26-66</SourceNote>
    </BodyPage>
  );
};
