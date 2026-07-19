import React from "react";
import { BodyPage } from "../templates/BodyPage";
import { COLORS, FONTS, SECTION_INK } from "../theme";
import { BUILD } from "../content";
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
      <SourceNote style={{ marginTop: 18 }}>{d.source}</SourceNote>
    </BodyPage>
  );
};

// ── p27 · build-closing — run the bench ────────────────────────────────────
export const BuildClosingPage: React.FC<PageProps> = (p) => {
  const d = BUILD.closing;
  return (
    <BodyPage {...p} sectionLabel="BUILD" sectionColor={VIOLET_INK} eyebrow={d.eyebrow} align="center">
      <h1 style={{ fontFamily: FONTS.SANS, fontSize: 62, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: COLORS.INK, margin: "0 0 10px" }}>
        {d.headline}
      </h1>
      <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 20, lineHeight: 1.35, color: COLORS.INK_MUTED, margin: "6px 0 30px", maxWidth: "6in" }}>
        {d.tagline}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20 }}>
        <Callout label={d.liveLabel} value={d.liveUrl} arrow={d.leftArrowLabel} accent={COLORS.SKY_DEEP} />
        <Callout label={d.spaceLabel} value={d.spaceUrl} arrow={d.rightArrowLabel} accent={VIOLET_INK} />
      </div>
      <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, height: 1, background: COLORS.HAIRLINE }} />
        <span style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: VIOLET_INK }}>
          {d.microNote}
        </span>
        <span style={{ flex: 1, height: 1, background: COLORS.HAIRLINE }} />
      </div>
    </BodyPage>
  );
};

const Callout: React.FC<{ label: string; value: string; arrow: string; accent: string }> = ({ label, value, arrow, accent }) => (
  <div style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderTop: `3px solid ${accent}`, borderRadius: 6, background: COLORS.PAPER_ELEVATED, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>{label}</span>
    <span style={{ fontFamily: FONTS.SANS, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: COLORS.INK, wordBreak: "break-word" }}>{value}</span>
    <span style={{ fontFamily: FONTS.MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: COLORS.INK_MUTED }}>{arrow} →</span>
  </div>
);
