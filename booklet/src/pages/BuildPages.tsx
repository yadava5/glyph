import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION_INK } from "../theme";
import { BUILD, TRY_IT } from "../content";
import { SourceNote } from "../primitives/SourceNote";

type PageProps = { parity: "recto" | "verso"; pageNumber: number; totalPages: number };

const VIOLET_INK = SECTION_INK["05_BUILD"];

// ── p26 · build-stack — the toolchain ──────────────────────────────────────
export const BuildStackPage: React.FC<PageProps> = (p) => {
  const d = BUILD.stack;
  return (
    <BodyPage {...p} sectionLabel="BUILD" sectionColor={VIOLET_INK} eyebrow={d.eyebrow} headline={d.headline}>
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.4, color: COLORS.INK_MUTED, margin: "0 0 18px", maxWidth: "6.3in" }}>
        {d.lede}
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {d.rows.map((r, i) => (
          <div
            key={r.area}
            style={{
              display: "grid",
              gridTemplateColumns: "1.1in 1fr",
              alignItems: "baseline",
              columnGap: 16,
              padding: "11px 0",
              borderTop: i === 0 ? `1pt solid ${COLORS.INK}` : `0.5pt solid ${COLORS.HAIRLINE}`,
            }}
          >
            <span style={{ fontFamily: FONTS.MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: VIOLET_INK }}>
              {r.area}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: FONTS.MONO, fontSize: 12.5, fontWeight: 700, color: COLORS.INK }}>{r.tech}</span>
              <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 12, color: COLORS.INK_MUTED }}>{r.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* three toolchains, one dot product — the shape the journey walks through */}
      <div style={{ marginTop: 20, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: VIOLET_INK }}>three toolchains, one dot product</span>
          <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 11, color: COLORS.INK_SUBTLE }}>the journey · pp. 24–25 →</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr 20px 1fr", alignItems: "center", columnGap: 6 }}>
          {[
            { k: "C++17 core", v: "the 4 kernels", c: COLORS.AMBER_DEEP },
            { k: "Emscripten", v: "→ WebAssembly", c: COLORS.SKY_DEEP },
            { k: "React 19", v: "renders the bench", c: COLORS.VIOLET_DEEP },
          ].map((x, i) => (
            <React.Fragment key={x.k}>
              <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${x.c}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "10px 12px" }}>
                <div style={{ fontFamily: FONTS.MONO, fontSize: 11, fontWeight: 700, color: COLORS.INK }}>{x.k}</div>
                <div style={{ fontFamily: FONTS.MONO, fontSize: 8, color: COLORS.INK_MUTED, marginTop: 2 }}>{x.v}</div>
              </div>
              {i < 2 && <span style={{ textAlign: "center", color: COLORS.HAIRLINE_STRONG, fontSize: 14 }}>→</span>}
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 10.5, color: COLORS.INK_MUTED, marginTop: 10 }}>
          One C++ hot loop, compiled three ways — native SIMD, WebAssembly, and the React instrument that times it in front of you.
        </div>
      </div>

      <SourceNote style={{ marginTop: 16 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// ── p27 · try-it — the live app (QR + how the bench works) ──────────────────
export const TryItPage: React.FC<PageProps> = (p) => {
  const d = TRY_IT;
  return (
    <BodyPage {...p} sectionLabel="BUILD" sectionColor={VIOLET_INK} eyebrow={d.eyebrow} headline={d.headline} align="top">
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 17, lineHeight: 1.35, color: COLORS.INK_MUTED, margin: "2px 0 18px", maxWidth: "6.3in" }}>
        {d.tagline}
      </p>

      {/* Main: QR paper card (left) · what happens (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "2.35in 1fr", columnGap: 26, alignItems: "stretch" }}>
        {/* QR card */}
        <div
          style={{
            border: `0.5pt solid ${COLORS.HAIRLINE}`,
            borderTop: `3px solid ${VIOLET_INK}`,
            borderRadius: 8,
            background: COLORS.PAPER_ELEVATED,
            padding: "16px 16px 14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ alignSelf: "stretch", fontFamily: FONTS.MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: VIOLET_INK }}>
            scan me
          </div>
          <div style={{ background: COLORS.PAPER, borderRadius: 8, padding: 12, boxShadow: `0 0 0 1px ${COLORS.HAIRLINE}` }}>
            <QRCodeSVG value={d.qrTarget} size={138} level="M" marginSize={0} fgColor={COLORS.GROUND} />
          </div>
          <div style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: COLORS.INK_MUTED }}>
            {d.qrCaption}
          </div>
          <div style={{ fontFamily: FONTS.SANS, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: COLORS.SKY_DEEP }}>
            {d.liveUrl}
          </div>
        </div>

        {/* What happens — numbered steps + the readout */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: VIOLET_INK }}>
            what happens when you open it
          </div>
          {d.steps.map((s) => (
            <div key={s.n} style={{ display: "grid", gridTemplateColumns: "26px 1fr", alignItems: "start", columnGap: 12, borderBottom: `0.5pt solid ${COLORS.HAIRLINE}`, paddingBottom: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: VIOLET_INK,
                  color: COLORS.PAPER,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONTS.MONO,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {s.n}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontFamily: FONTS.SANS, fontSize: 12.5, fontWeight: 700, color: COLORS.INK }}>{s.k}</span>
                <span style={{ fontFamily: FONTS.SANS, fontSize: 10.5, lineHeight: 1.35, color: COLORS.INK_MUTED }}>{s.v}</span>
              </div>
            </div>
          ))}

          {/* the readout badge, as the app renders it */}
          <div
            style={{
              marginTop: 2,
              display: "inline-flex",
              alignSelf: "flex-start",
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
            <span style={{ color: COLORS.ON_DARK_SUBTLE }}>{d.readout.tail}</span>
          </div>
        </div>
      </div>

      {/* ISA echo strip — the four kernels; wasm128 is the one that runs here */}
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {d.isaEcho.map((isa) => {
          const live = isa.label === "wasm128";
          return (
            <div
              key={isa.label}
              style={{
                border: `0.5pt solid ${COLORS.HAIRLINE}`,
                borderTop: `2px solid ${live ? COLORS.SKY : COLORS.STEEL}`,
                borderRadius: 5,
                background: live ? COLORS.SKY_TINT : COLORS.PAPER_ELEVATED,
                padding: "9px 11px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <span style={{ fontFamily: FONTS.MONO, fontSize: 10, fontWeight: 700, color: live ? COLORS.SKY_DEEP : COLORS.INK }}>{isa.label}</span>
              <span style={{ fontFamily: FONTS.MONO, fontSize: 8, color: COLORS.INK_MUTED }}>{isa.detail}</span>
            </div>
          );
        })}
      </div>

      {/* also in the app — a denser send-off than a lone sentence */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: VIOLET_INK, marginBottom: 8 }}>
          {d.alsoLabel}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {d.alsoCards.map((c) => (
            <div key={c.k} style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${VIOLET_INK}`, borderRadius: 5, background: COLORS.PAPER_ELEVATED, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontFamily: FONTS.SANS, fontSize: 11.5, fontWeight: 700, color: COLORS.INK }}>{c.k}</span>
              <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 11, lineHeight: 1.3, color: COLORS.INK_MUTED }}>{c.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* reading the badge — decode the live readout the demo prints */}
      <div style={{ marginTop: 18, borderTop: `1pt solid ${COLORS.INK}`, paddingTop: 12 }}>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: VIOLET_INK, marginBottom: 10 }}>
          reading the badge
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderTop: `0.5pt solid ${COLORS.HAIRLINE}`, borderBottom: `0.5pt solid ${COLORS.HAIRLINE}` }}>
          {[
            { v: "scalar", k: "lanes off", n: "the same math, vectorization disabled", c: COLORS.STEEL_DEEP },
            { v: "simd128", k: "hand-written", n: "the f64x2 kernel this card describes", c: COLORS.SKY_DEEP },
            { v: "~1.7×", k: "the ratio", n: "this run's simd-over-scalar speedup", c: COLORS.GREEN_DEEP },
            { v: "p50 · n", k: "the median", n: "over n timed iterations, per visitor", c: COLORS.VIOLET_DEEP },
          ].map((x, i) => (
            <div key={x.v} style={{ padding: "10px 12px", borderLeft: i === 0 ? "none" : `0.5pt solid ${COLORS.HAIRLINE}`, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontFamily: FONTS.MONO, fontSize: 12, fontWeight: 700, color: x.c, letterSpacing: "-0.01em" }}>{x.v}</span>
              <span style={{ fontFamily: FONTS.MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.INK_MUTED }}>{x.k}</span>
              <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 9, lineHeight: 1.25, color: COLORS.INK_SUBTLE }}>{x.n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* micro-rule footer */}
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, height: 1, background: COLORS.HAIRLINE }} />
        <span style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: VIOLET_INK }}>
          {d.microNote}
        </span>
        <span style={{ flex: 1, height: 1, background: COLORS.HAIRLINE }} />
      </div>
      <SourceNote style={{ marginTop: 14 }}>the hot loop · {d.hotLoop} · {BUILD.closing.liveUrl}</SourceNote>
    </BodyPage>
  );
};
