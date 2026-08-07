import React from "react";
import { Page } from "../primitives/Page";
import { Eyebrow } from "../primitives/Eyebrow";
import { COLORS, FONTS, PAGE, SECTION, SECTION_INK, type SectionKey } from "../theme";
import { BUILD } from "../content";

/** Live area = trim height minus the top/bottom content margins. */
const LIVE_HEIGHT = `calc(${PAGE.trimH}in - ${PAGE.margin.top}in - ${PAGE.margin.bottom}in)`;

/**
 * BUILD spread (pages 24 / 25) — the optimization journey read across the
 * gutter. Left half: scalar → SIMD → wasm. Right half: wasm → bench → web.
 * The wasm compile is repeated as the hinge so the two halves read as one
 * continuous ribbon once bound.
 */
export type SpreadPageProps = {
  half: "left" | "right";
  parity: "recto" | "verso";
  pageNumber: number;
  totalPages: number;
  sectionLabel: string;
  sectionColor: string;
};

/** Per-stage detail — what each journey stage is, and where it lives. Derived
 *  from BUILD.pipeline sub-copy + the HOW/INSIDE chapters; nothing invented. */
const STAGE_DETAIL: Record<string, { does: string; where: string }> = {
  SCALAR: { does: "The course C++ MLP runs one multiply at a time — one CPU lane busy, the rest idle.", where: "the starter" },
  SIMD: { does: "The dot loop is hand-written for AVX-512, AVX2, and NEON — the full vector width, every iteration.", where: "3 native ISAs" },
  WASM: { does: "Emscripten compiles the same C++ to WebAssembly with -msimd128 — the fourth, hand-written kernel.", where: "Emscripten" },
  BENCH: { does: "The app times wasm128 against the same math with lanes off, live on the visitor's machine.", where: "live · p50" },
  WEB: { does: "React 19 renders the instrument; Vercel ships the committed simd128 artifact, never the fallback.", where: "React · Vercel" },
};

export const SpreadPage: React.FC<SpreadPageProps> = ({
  half,
  parity,
  pageNumber,
  totalPages,
  sectionLabel,
  sectionColor,
}) => {
  const { pipeline } = BUILD;
  const stages = half === "left" ? pipeline.stages.slice(0, 3) : pipeline.stages.slice(2, 5);
  const headline = half === "left" ? pipeline.headlineLeft : pipeline.headlineRight;
  const sub = half === "left" ? pipeline.subLeft : pipeline.subRight;

  return (
    <Page
      parity={parity}
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionLabel={sectionLabel}
      sectionColor={sectionColor}
    >
      <div style={{ display: "flex", flexDirection: "column", minHeight: LIVE_HEIGHT }}>
        <Eyebrow color={SECTION_INK["05_BUILD"]} style={{ marginBottom: 6 }}>
          {half === "left" ? pipeline.eyebrowLeft : pipeline.eyebrowRight}
        </Eyebrow>

        <div style={{ textAlign: half === "right" ? "right" : "left" }}>
          <h1
            style={{
              fontFamily: FONTS.SANS,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: COLORS.INK,
              margin: 0,
            }}
          >
            {headline}
          </h1>
          <p
            style={{
              fontFamily: FONTS.SERIF,
              fontStyle: "italic",
              fontSize: 14,
              lineHeight: 1.4,
              color: COLORS.INK_MUTED,
              margin: "6px 0 0",
              maxWidth: "5.4in",
              marginLeft: half === "right" ? "auto" : 0,
            }}
          >
            {sub}
          </p>
        </div>

        {/* Ribbon fills the live area; the connectors grow to distribute the
            three stage cards evenly from the header down to the foot note. */}
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", paddingTop: 20, paddingBottom: "1.55in" }}>
          {stages.map((s, i) => {
            const accent = SECTION[s.accentKey as SectionKey];
            const bridge = s.label === "WASM";
            const d = STAGE_DETAIL[s.label];
            return (
              <React.Fragment key={s.label}>
                <StageCard n={s.n} label={s.label} detail={s.detail} accent={accent} bridge={bridge} does={d?.does} where={d?.where} />
                {i < stages.length - 1 && <Connector />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Foot — the committed-artifact note (left) or ship targets (right) */}
      <div style={{ position: "absolute", left: "0.75in", right: "0.75in", bottom: "1.2in" }}>
        {half === "left" ? (
          <div
            style={{
              borderTop: `1pt solid ${COLORS.INK}`,
              paddingTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.MONO,
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: SECTION_INK["05_BUILD"],
                whiteSpace: "nowrap",
              }}
            >
              committed artifact
            </span>
            <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 13, color: COLORS.INK, lineHeight: 1.35 }}>
              {BUILD.pipeline.registry}
            </span>
          </div>
        ) : (
          <div
            style={{
              borderTop: `1pt solid ${COLORS.INK}`,
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
              fontFamily: FONTS.MONO,
              fontSize: 8.5,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: COLORS.INK_MUTED,
            }}
          >
            <span style={{ color: COLORS.SKY_DEEP }}>{BUILD.closing.liveUrl}</span>
            <span>·</span>
            <span style={{ color: COLORS.VIOLET_DEEP }}>{BUILD.closing.spaceUrl}</span>
          </div>
        )}
      </div>

      {/* gutter continuity marker — sits above the page-number footer rail
          (bottom 0.5in) so the two never overlap */}
      <div
        style={{
          position: "absolute",
          bottom: "0.82in",
          [half === "left" ? "right" : "left"]: "0.75in",
          fontFamily: FONTS.MONO,
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: SECTION_INK["05_BUILD"],
        }}
      >
        {half === "left" ? "journey continues →" : "← the wasm compile bridges the fold"}
      </div>
    </Page>
  );
};

const StageCard: React.FC<{
  n: string;
  label: string;
  detail: string;
  accent: string;
  bridge: boolean;
  does?: string;
  where?: string;
}> = ({ n, label, detail, accent, bridge, does, where }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      border: `0.5pt solid ${bridge ? accent : COLORS.HAIRLINE}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 5,
      background: bridge ? `${accent}18` : COLORS.PAPER_ELEVATED,
      padding: "14px 16px",
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: accent,
        color: COLORS.GROUND,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.MONO,
        fontSize: 15,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {n}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: FONTS.SANS, fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: COLORS.INK }}>
            {label}
          </span>
          {bridge && (
            <span
              style={{
                fontFamily: FONTS.MONO,
                fontSize: 7.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: accent,
              }}
            >
              the hinge
            </span>
          )}
        </div>
        {where && (
          <span style={{ fontFamily: FONTS.MONO, fontSize: 7.5, letterSpacing: "0.04em", color: COLORS.INK_SUBTLE, whiteSpace: "nowrap" }}>{where}</span>
        )}
      </div>
      <div style={{ fontFamily: FONTS.MONO, fontSize: 9, color: COLORS.INK_MUTED, marginTop: 2 }}>{detail}</div>
      {does && (
        <div style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 11.5, lineHeight: 1.35, color: COLORS.INK, marginTop: 7 }}>{does}</div>
      )}
    </div>
  </div>
);

/** A vertical link between stage cards that GROWS to fill the slack, so the
 *  three cards distribute evenly down the page instead of clustering. */
const Connector: React.FC = () => (
  <div style={{ flexGrow: 1, minHeight: 26, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
    <span style={{ position: "absolute", top: 4, bottom: 4, width: 1.5, background: COLORS.HAIRLINE_STRONG }} />
    <span style={{ position: "relative", background: COLORS.PAPER, color: COLORS.HAIRLINE_STRONG, fontSize: 15, lineHeight: 1, padding: "3px 0" }}>↓</span>
  </div>
);
