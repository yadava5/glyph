import React from "react";
import { COLORS, FONTS, PAGE } from "../theme";
import { BRAND, MASTHEAD } from "../content";
import { DigitLanesField } from "../visuals/DigitLanesField";
import { GlyphMark } from "../visuals/Mark";

/**
 * Front cover (page 01). A full-bleed blue-black field: a monumental MNIST
 * digit raster cropped by the bleed, its dot-product hot row lit as a
 * full-width scan band that streams into the SIMD lane rail of the four ISAs
 * (DigitLanesField) — the whole story in one image — with a scalar/vectorized
 * legend, a display-scale title block over a scrim, and a vertical mono
 * margin callout. The project's app chip (hand stroke over four SIMD lanes,
 * inlined in visuals/Mark.tsx) closes the title lockup on the baseline — the
 * product's icon beside its machine-set wordmark.
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

    {/* Vertical margin callout — right edge. ON_DARK_MUTED, not SUBTLE:
        measured APCA Lc -22 for SUBTLE on this ground vs -52 for MUTED. */}
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
        color: COLORS.ON_DARK_MUTED,
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

    {/* Title block — lower-left. Display scale (152px ≈ 114pt): the wordmark
        is the counterweight to the monumental digit above it. */}
    <div
      style={{
        position: "absolute",
        left: "0.7in",
        bottom: "0.95in",
        right: "0.7in",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 30,
          // lineHeight < 1 lets the y/p descenders overflow the line box;
          // reserve room so they never collide with the subtitle.
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.SANS,
            fontSize: 152,
            fontWeight: 700,
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            color: COLORS.ON_DARK,
          }}
        >
          {BRAND.name}
        </div>
        {/* the chip sits on the type baseline — the line box's bottom edge is
            ~4px under the baseline at lineHeight 0.9, so a small bottom margin
            levels the chip base with the letterforms */}
        <GlyphMark size={96} style={{ marginBottom: 6 }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.SERIF,
          fontStyle: "italic",
          fontSize: 24,
          lineHeight: 1.22,
          color: COLORS.ON_DARK_MUTED,
          maxWidth: "6.1in",
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
        <span style={{ color: COLORS.ON_DARK_MUTED }}>with {BRAND.contributor}</span>
        <span style={{ width: 28, height: 1, background: COLORS.ON_DARK_HAIRLINE }} />
        <span style={{ color: COLORS.ON_DARK_MUTED }}>{MASTHEAD.volume}</span>
      </div>
    </div>
  </section>
);
