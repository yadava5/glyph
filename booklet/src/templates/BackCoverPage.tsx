import React from "react";
import { COLORS, FONTS, PAGE } from "../theme";
import { BACK_COVER } from "../content";
import { DigitLanesField } from "../visuals/DigitLanesField";

/**
 * Back cover (page 28) — a PURE closing. It mirrors the front cover: the same
 * full-bleed digit-lanes field (reseeded to a "7" so it reads as a wraparound),
 * a quiet serif closing line over a lower scrim, the wordmark, and the
 * colophon. Deliberately NO QR / scan / URL / CTA — the reader is sent to the
 * live product on page 27 (Try It); this last leaf just closes the book, a
 * bookend to the opening cover.
 */
export const BackCoverPage: React.FC = () => (
  <section
    className="page"
    data-bleed="true"
    style={{
      background: COLORS.GROUND,
      color: COLORS.ON_DARK,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <DigitLanesField widthIn={8.75} heightIn={11.25} variant="back" />

    {/* Lower scrim so the closing block stays legible over the field — echoes
        the cover's title-block scrim. */}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "4.6in",
        background: `linear-gradient(to top, ${COLORS.GROUND} 14%, rgba(5,7,12,0.86) 48%, rgba(5,7,12,0) 100%)`,
        pointerEvents: "none",
      }}
    />

    {/* Masthead — top-left, mirrors the front cover */}
    <div
      style={{
        position: "absolute",
        top: "0.7in",
        left: "0.7in",
        fontFamily: FONTS.MONO,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: COLORS.ON_DARK_MUTED,
      }}
    >
      {BACK_COVER.masthead}
    </div>

    {/* Volume — top-right, quiet counterpart to the cover legend */}
    <div
      style={{
        position: "absolute",
        top: "0.68in",
        right: "0.7in",
        fontFamily: FONTS.MONO,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: COLORS.ON_DARK_SUBTLE,
      }}
    >
      {BACK_COVER.volume} · fin.
    </div>

    {/* Vertical margin echo — right edge, mirrors the cover's silicon callout */}
    <div
      style={{
        position: "absolute",
        right: "0.4in",
        bottom: `${PAGE.margin.bottom}in`,
        writingMode: "vertical-rl",
        fontFamily: FONTS.MONO,
        fontSize: 8.5,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: COLORS.ON_DARK_SUBTLE,
      }}
    >
      {BACK_COVER.edgeNote}
    </div>

    {/* Closing block — lower-left, mirrors the cover's title block */}
    <div
      style={{
        position: "absolute",
        left: "0.7in",
        bottom: "0.95in",
        right: "1.1in",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.SERIF,
          fontStyle: "italic",
          fontSize: 34,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: COLORS.ON_DARK,
          maxWidth: "5.6in",
        }}
      >
        — {BACK_COVER.closingLine}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: FONTS.SANS,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: COLORS.ON_DARK,
          }}
        >
          fast<span style={{ color: COLORS.SKY_SOFT }}>-mnist</span>
        </span>
        <span style={{ width: 26, height: 1, background: COLORS.ON_DARK_HAIRLINE }} />
        <span
          style={{
            fontFamily: FONTS.MONO,
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.ON_DARK_SUBTLE,
          }}
        >
          {BACK_COVER.signature}
        </span>
      </div>

      <div
        style={{
          fontFamily: FONTS.MONO,
          fontSize: 8.5,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: COLORS.ON_DARK_SUBTLE,
          lineHeight: 1.7,
          borderTop: `0.5pt solid ${COLORS.ON_DARK_HAIRLINE}`,
          paddingTop: 12,
        }}
      >
        {BACK_COVER.colophon.map((line, i) => (
          <React.Fragment key={i}>
            {line}
            <br />
          </React.Fragment>
        ))}
      </div>
    </div>
  </section>
);
