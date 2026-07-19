import React from "react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION, SECTION_INK } from "../theme";
import { INSIDE } from "../content";
import { StatBig } from "../primitives/StatBig";
import { SourceNote } from "../primitives/SourceNote";
import { NetworkAnatomySignature } from "../visuals/IsaSignatures";
import { RadialGauge } from "../visuals/Charts";
import { Prose, HangingNote, FactGrid, CodePanel } from "./kit";

type PageProps = { parity: "recto" | "verso"; pageNumber: number; totalPages: number };

const SKY = SECTION["03_INSIDE"];
const SKY_INK = SECTION_INK["03_INSIDE"];

const WASM_SRC = `for (; k < n4; k += 4) {   // f64x2 · 4 doubles/iter
  acc0 = wasm_f64x2_add(acc0,
    wasm_f64x2_mul(ld(row+k),   ld(x+k)));
  acc1 = wasm_f64x2_add(acc1,
    wasm_f64x2_mul(ld(row+k+2), ld(x+k+2)));
}  // extract lanes 0,1 + scalar tail`;

// ── p15 · inside-wasm — the loop the browser runs ──────────────────────────
export const InsideWasmPage: React.FC<PageProps> = (p) => {
  const d = INSIDE.wasm;
  return (
    <BodyPage {...p} sectionLabel="INSIDE" sectionColor={SKY_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ maxWidth: "6.4in", marginBottom: 16 }}>
        <Prose items={[d.body]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 26, alignItems: "start" }}>
        <CodePanel caption={d.codeCaption} code={WASM_SRC} accent={SKY_INK} />
        <FactGrid facts={d.facts} accent={SKY} />
      </div>
      <SourceNote style={{ marginTop: 18 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// ── p16 · inside-bench — the live in-browser benchmark ─────────────────────
export const InsideBenchPage: React.FC<PageProps> = (p) => {
  const d = INSIDE.bench;
  return (
    <BodyPage {...p} sectionLabel="INSIDE" sectionColor={SKY_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", columnGap: 26, alignItems: "start" }}>
        <div>
          <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 15, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 12px" }}>
            {d.lede}
          </p>
          <Prose items={[d.body]} />
          {/* the on-page readout, as the app renders it */}
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: COLORS.GROUND,
              borderRadius: 6,
              border: `0.5pt solid ${COLORS.HAIRLINE_STRONG}`,
              padding: "8px 14px",
              fontFamily: FONTS.MONO,
              fontSize: 10,
            }}
          >
            <span style={{ color: COLORS.STEEL }}>{d.readout.scalarLabel}</span>
            <span style={{ color: COLORS.ON_DARK_SUBTLE }}>→</span>
            <span style={{ color: COLORS.SKY_SOFT }}>{d.readout.simdLabel}</span>
            <span style={{ color: COLORS.WIN_GREEN, fontWeight: 700 }}>{d.readout.ratio}</span>
            <span style={{ color: COLORS.ON_DARK_SUBTLE }}>p50 · n</span>
          </div>
        </div>
        <RadialGauge value={1.7} min={1} max={2.5} bandLo={1.5} bandHi={1.9} accent={SKY_INK} source="useMnistDemoController.ts:163" />
      </div>
      <HangingNote label="Honest by design" accent={SKY} accentInk={SKY_INK} style={{ marginTop: 16 }}>
        {d.honest}
      </HangingNote>
      {/* method strip — how the badge number is earned (fills the page rhythm) */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { k: "forward pass only", v: "the classify hot loop, nothing else timed" },
          { k: "many iterations", v: "both kernels timed in C++, warm, back to back" },
          { k: "session p50", v: "the median of the run — the defensible middle" },
        ].map((m) => (
          <div key={m.k} style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${SKY}`, borderRadius: 4, padding: "9px 11px" }}>
            <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SKY_INK }}>{m.k}</div>
            <div style={{ fontFamily: FONTS.SANS, fontSize: 10, lineHeight: 1.35, color: COLORS.INK_MUTED, marginTop: 3 }}>{m.v}</div>
          </div>
        ))}
      </div>
      <SourceNote style={{ marginTop: 14 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// ── p17 · inside-anatomy — 784 → 100 → 10 ──────────────────────────────────
export const InsideAnatomyPage: React.FC<PageProps> = (p) => {
  const d = INSIDE.anatomy;
  return (
    <BodyPage {...p} sectionLabel="INSIDE" sectionColor={SKY_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", columnGap: 26, alignItems: "start" }}>
        <div>
          <Prose items={d.body} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {d.layers.map((l) => (
              <div key={l.name} style={{ display: "grid", gridTemplateColumns: "auto 0.7in 1fr", alignItems: "baseline", columnGap: 10, borderBottom: `0.5pt solid ${COLORS.HAIRLINE}`, paddingBottom: 5 }}>
                <span style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SKY_INK }}>{l.name}</span>
                <span style={{ fontFamily: FONTS.MONO, fontSize: 15, fontWeight: 700, color: COLORS.INK, fontVariantNumeric: "tabular-nums" }}>{l.units}</span>
                <span style={{ fontFamily: FONTS.SANS, fontSize: 10, color: COLORS.INK_MUTED }}>{l.detail}</span>
              </div>
            ))}
          </div>
        </div>
        <NetworkAnatomySignature />
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 22, paddingTop: 16, borderTop: `1pt solid ${SKY}` }}>
        <StatBig value={d.stat.value} label={d.stat.label} tier="metricMedium" color={SKY_INK} />
        <StatBig value={d.stat2.value} label={d.stat2.label} tier="metricSmall" color={COLORS.INK} />
        <div style={{ flex: 1 }} />
      </div>
      <SourceNote style={{ marginTop: 14 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};
