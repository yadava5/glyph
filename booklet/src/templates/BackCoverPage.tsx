import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { COLORS, FONTS } from "../theme";
import { BACK_COVER } from "../content";
import { DigitLanesField } from "../visuals/DigitLanesField";

/**
 * Back cover (page 28). Continues the front cover's digit-lanes field (reseeded
 * to a "7" so it reads as a wraparound), then lands the reader on the live
 * product: a QR to the web app + the live in-browser benchmark.
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

    {/* Scrim so the QR + colophon stay legible over the field */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top, rgba(5,7,12,0.92) 30%, rgba(5,7,12,0.35) 70%, rgba(5,7,12,0.6) 100%)",
        pointerEvents: "none",
      }}
    />

    {/* Colophon — upper-left */}
    <div
      style={{
        position: "absolute",
        top: "0.7in",
        left: "0.7in",
        fontFamily: FONTS.MONO,
        fontSize: 8.5,
        fontWeight: 500,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: COLORS.ON_DARK_MUTED,
        lineHeight: 1.6,
      }}
    >
      {BACK_COVER.colophon.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          <br />
        </React.Fragment>
      ))}
    </div>

    {/* QR block — center-lower, on a paper card for scannability */}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "2.2in",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          background: COLORS.PAPER,
          borderRadius: 12,
          padding: 18,
          boxShadow: `0 0 0 1px ${COLORS.ON_DARK_HAIRLINE}`,
        }}
      >
        <QRCodeSVG value={BACK_COVER.qrTarget} size={150} level="M" marginSize={0} fgColor={COLORS.GROUND} />
      </div>
      <div
        style={{
          fontFamily: FONTS.MONO,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLORS.ON_DARK,
        }}
      >
        {BACK_COVER.qrCaption}
      </div>
      <div
        style={{
          fontFamily: FONTS.SANS,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: COLORS.SKY_SOFT,
        }}
      >
        {BACK_COVER.qrTarget.replace("https://", "")}
      </div>
    </div>

    {/* Live benchmark note */}
    <div
      style={{
        position: "absolute",
        left: "0.9in",
        right: "0.9in",
        bottom: "1.3in",
        textAlign: "center",
        fontFamily: FONTS.MONO,
        fontSize: 8.5,
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: COLORS.ON_DARK_MUTED,
        lineHeight: 1.5,
      }}
    >
      {BACK_COVER.spaceNote}
    </div>

    {/* Closing italic line — bottom-right */}
    <div
      style={{
        position: "absolute",
        bottom: "0.7in",
        right: "0.7in",
        fontFamily: FONTS.SERIF,
        fontStyle: "italic",
        fontSize: 14,
        color: COLORS.ON_DARK_MUTED,
        textAlign: "right",
      }}
    >
      {BACK_COVER.closingLine}
    </div>
  </section>
);
