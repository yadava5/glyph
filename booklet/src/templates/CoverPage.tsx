import React from "react";
import { COLORS, FONTS, PAGE } from "../theme";
import { BRAND, MASTHEAD } from "../content";
import { DigitLanesField } from "../visuals/DigitLanesField";

/**
 * Front cover (page 01). A full-bleed blue-black field: an MNIST digit raster
 * streaming into the SIMD lanes of the four ISAs (DigitLanesField) — the whole
 * story in one image — with a scalar/vectorized legend, a lower-left title
 * block over a scrim, and a vertical mono margin callout.
 */
export const CoverPage: React.FC = () => (
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
    <DigitLanesField widthIn={8.75} heightIn={11.25} variant="front" />

    {/* Masthead — top-left */}
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
      {BRAND.name} · System Card
    </div>

    {/* Legend — top-right, seeds the scalar/vectorized/measured color language.
        A subtle scrim lifts it off the field. */}
    <div
      style={{
        position: "absolute",
        top: "0.6in",
        right: "0.62in",
        display: "flex",
        gap: 13,
        alignItems: "center",
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(6, 10, 18, 0.66)",
        border: `0.5pt solid ${COLORS.ON_DARK_HAIRLINE}`,
      }}
    >
      {[
        { c: COLORS.STEEL, l: "scalar" },
        { c: COLORS.SKY_SOFT, l: "vectorized" },
        { c: COLORS.WIN_GREEN, l: "measured" },
      ].map((x) => (
        <span
          key={x.l}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: FONTS.MONO,
            fontSize: 8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: COLORS.ON_DARK,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: x.c }} />
          {x.l}
        </span>
      ))}
    </div>

    {/* Vertical margin callout — right edge */}
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
      benchmarked live on your silicon
    </div>

    {/* Scrim behind the title block */}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "4.2in",
        background: `linear-gradient(to top, ${COLORS.GROUND} 12%, rgba(5,7,12,0.86) 46%, rgba(5,7,12,0) 100%)`,
        pointerEvents: "none",
      }}
    />

    {/* Title block — lower-left */}
    <div
      style={{
        position: "absolute",
        left: "0.7in",
        bottom: "0.95in",
        right: "0.7in",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.SANS,
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 0.92,
          color: COLORS.ON_DARK,
        }}
      >
        {BRAND.name}
      </div>
      <div
        style={{
          fontFamily: FONTS.SERIF,
          fontStyle: "italic",
          fontSize: 23,
          lineHeight: 1.22,
          color: COLORS.ON_DARK_MUTED,
          maxWidth: "5.6in",
        }}
      >
        {BRAND.subtitle}
      </div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: FONTS.MONO,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLORS.ON_DARK,
          flexWrap: "wrap",
        }}
      >
        <span>
          {BRAND.author} · {BRAND.year}
        </span>
        <span style={{ width: 28, height: 1, background: COLORS.ON_DARK_HAIRLINE }} />
        <span style={{ color: COLORS.ON_DARK_SUBTLE }}>with {BRAND.contributor}</span>
        <span style={{ width: 28, height: 1, background: COLORS.ON_DARK_HAIRLINE }} />
        <span style={{ color: COLORS.ON_DARK_SUBTLE }}>{MASTHEAD.volume}</span>
      </div>
    </div>
  </section>
);
