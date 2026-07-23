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

      {/* the loop's shape — two accumulators, one reduction, a scalar tail */}
      <div style={{ marginTop: 20, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 12 }}>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SKY_INK, marginBottom: 10 }}>
          the shape · two accumulators, one reduce
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${SKY_INK}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "10px 12px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.MONO, fontSize: 10.5, fontWeight: 700, color: COLORS.INK }}>row · x</div>
            <div style={{ fontFamily: FONTS.MONO, fontSize: 7, color: COLORS.INK_MUTED, marginTop: 2 }}>4 doubles / iter</div>
          </div>
          <span style={{ color: COLORS.HAIRLINE_STRONG, fontSize: 14 }}>→</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
            {["acc0 · f64x2", "acc1 · f64x2"].map((a) => (
              <div key={a} style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderRadius: 5, background: COLORS.SKY_TINT, padding: "6px 11px", fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 700, color: COLORS.SKY_DEEP }}>{a} <span style={{ fontWeight: 400, color: COLORS.INK_MUTED }}>· wasm_f64x2_mul + add</span></div>
            ))}
          </div>
          <span style={{ color: COLORS.HAIRLINE_STRONG, fontSize: 14 }}>→</span>
          <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${COLORS.WIN_GREEN}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "10px 12px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: FONTS.MONO, fontSize: 9.5, fontWeight: 700, color: COLORS.GREEN_DEEP }}>extract 0,1</div>
            <div style={{ fontFamily: FONTS.MONO, fontSize: 7, color: COLORS.INK_MUTED, marginTop: 2 }}>+ scalar tail</div>
          </div>
        </div>
        <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, color: COLORS.INK_MUTED, marginTop: 9 }}>
          Two independent accumulators hide add latency; a two-lane horizontal reduce and a scalar tail finish the row — no threads, pure f64x2.
        </div>
      </div>

      <SourceNote style={{ marginTop: 16 }}>{d.source}</SourceNote>
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
          {/* the on-page readout, as the app renders it — tokens never break
              mid-word: the strip wraps BETWEEN tokens (flexWrap + nowrap) */}
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              rowGap: 5,
              background: COLORS.GROUND,
              borderRadius: 6,
              border: `0.5pt solid ${COLORS.HAIRLINE_STRONG}`,
              padding: "8px 14px",
              fontFamily: FONTS.MONO,
              fontSize: 10,
            }}
          >
            <span style={{ color: COLORS.STEEL, whiteSpace: "nowrap" }}>{d.readout.scalarLabel}</span>
            <span style={{ color: COLORS.ON_DARK_SUBTLE }}>→</span>
            <span style={{ color: COLORS.SKY_SOFT, whiteSpace: "nowrap" }}>{d.readout.simdLabel}</span>
            <span style={{ color: COLORS.WIN_GREEN, fontWeight: 700, whiteSpace: "nowrap" }}>{d.readout.ratio}</span>
            <span style={{ color: COLORS.ON_DARK_SUBTLE, whiteSpace: "nowrap" }}>p50 · n</span>
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

/** Where the 79,510 parameters live — pure arithmetic on the layer sizes
 *  already on this page: 784×100 weights + 100 biases, then 100×10 + 10. */
const ParamsBreakdown: React.FC = () => {
  const rows = [
    { layer: "input → hidden", math: "784 × 100 + 100", count: 78500, share: 78500 / 79510 },
    { layer: "hidden → output", math: "100 × 10 + 10", count: 1010, share: 1010 / 79510 },
  ];
  return (
    <div style={{ marginTop: 18, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 12 }}>
      <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SKY_INK, marginBottom: 10 }}>
        where the 79,510 parameters live · weights + biases
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map((r) => (
          <div key={r.layer} style={{ display: "grid", gridTemplateColumns: "1.15in 1.25in 1fr 0.62in", alignItems: "center", columnGap: 12 }}>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, color: SKY_INK }}>{r.layer}</span>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, color: COLORS.INK_MUTED }}>{r.math}</span>
            <span style={{ display: "block", height: 13, borderRadius: 2, background: COLORS.SKY_TINT, position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(r.share * 100, 1.6)}%`, background: COLORS.SKY_DEEP, borderRadius: 2 }} />
            </span>
            <span style={{ fontFamily: FONTS.MONO, fontSize: 9.5, fontWeight: 700, color: COLORS.INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.count.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, color: COLORS.INK_MUTED, marginTop: 9 }}>
        98.7% of the parameters — and of the forward-pass work — sit in the first layer's 784-wide rows: the exact loop the kernels vectorize.
      </div>
    </div>
  );
};

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
      <ParamsBreakdown />
      <div style={{ display: "flex", gap: 40, marginTop: 20, paddingTop: 16, borderTop: `1pt solid ${SKY}` }}>
        <StatBig value={d.stat.value} label={d.stat.label} tier="metricMedium" color={SKY_INK} />
        <StatBig value={d.stat2.value} label={d.stat2.label} tier="metricSmall" color={COLORS.INK} />
        <div style={{ flex: 1 }} />
      </div>
      <SourceNote style={{ marginTop: 14 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};
