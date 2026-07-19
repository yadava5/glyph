import React from "react";
import { COLORS, FONTS, TYPE } from "../theme";

/**
 * Shared page kit — the small, repeated editorial pieces (prose, honesty
 * notes, compare columns, code panels, fact grids, bands) so each content
 * page stays lean and every instance reads identically. All render on the
 * light editorial pages.
 */

// Map a semantic hue string to its bright + legible-on-white pair.
export type Hue = "steel" | "amber" | "sky" | "green" | "violet" | "danger";
export function hue(h: Hue): { bright: string; deep: string } {
  switch (h) {
    case "steel":
      return { bright: COLORS.STEEL, deep: COLORS.STEEL_DEEP };
    case "amber":
      return { bright: COLORS.SIMD_AMBER, deep: COLORS.AMBER_DEEP };
    case "sky":
      return { bright: COLORS.SKY, deep: COLORS.SKY_DEEP };
    case "green":
      return { bright: COLORS.WIN_GREEN, deep: COLORS.GREEN_DEEP };
    case "violet":
      return { bright: COLORS.VIOLET, deep: COLORS.VIOLET_DEEP };
    case "danger":
      return { bright: COLORS.DANGER, deep: COLORS.DANGER };
  }
}

export const Para: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <p
    style={{
      fontFamily: FONTS.SANS,
      fontSize: TYPE.body.size,
      lineHeight: TYPE.body.lh,
      letterSpacing: TYPE.body.tracking,
      color: COLORS.INK,
      margin: "0 0 10px",
      ...style,
    }}
  >
    {children}
  </p>
);

export const Prose: React.FC<{ items: readonly string[]; style?: React.CSSProperties }> = ({
  items,
  style,
}) => (
  <div style={style}>
    {items.map((p, i) => (
      <Para key={i}>{p}</Para>
    ))}
  </div>
);

/** The "On the record"-style hanging italic note with a colored left rule. */
export const HangingNote: React.FC<{
  label: string;
  children: React.ReactNode;
  accent: string;
  accentInk: string;
  style?: React.CSSProperties;
}> = ({ label, children, accent, accentInk, style }) => (
  <div style={{ borderLeft: `2.5px solid ${accent}`, paddingLeft: 14, ...style }}>
    <div
      style={{
        fontFamily: FONTS.MONO,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: accentInk,
        marginBottom: 5,
      }}
    >
      {label}
    </div>
    <p style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 14, lineHeight: 1.4, color: COLORS.INK, margin: 0 }}>
      {children}
    </p>
  </div>
);

/** A row of small labeled signal chips (cover-echo). */
export const SignalStrip: React.FC<{
  items: ReadonlyArray<{ label: string; quote: string; hue: Hue }>;
}> = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
    {items.map((s) => {
      const c = hue(s.hue);
      return (
        <div
          key={s.label}
          style={{
            border: `0.5pt solid ${COLORS.HAIRLINE}`,
            borderTop: `2px solid ${c.bright}`,
            borderRadius: 5,
            background: COLORS.PAPER_ELEVATED,
            padding: "9px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <span style={{ fontFamily: FONTS.MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: c.deep }}>
            {s.label}
          </span>
          <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 11.5, lineHeight: 1.25, color: COLORS.INK }}>
            {s.quote}
          </span>
        </div>
      );
    })}
  </div>
);

/** Two-column before/after comparison. */
export const CompareColumns: React.FC<{
  leftTitle: string;
  left: readonly string[];
  rightTitle: string;
  right: readonly string[];
  leftAccent: string;
  rightAccent: string;
}> = ({ leftTitle, left, rightTitle, right, leftAccent, rightAccent }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 22 }}>
    {[
      { title: leftTitle, items: left, accent: leftAccent },
      { title: rightTitle, items: right, accent: rightAccent },
    ].map((col) => (
      <div key={col.title}>
        <div
          style={{
            fontFamily: FONTS.MONO,
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: col.accent,
            borderBottom: `1.5px solid ${col.accent}`,
            paddingBottom: 5,
            marginBottom: 8,
          }}
        >
          {col.title}
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
          {col.items.map((it, i) => (
            <li key={i} style={{ display: "flex", gap: 7 }}>
              <span aria-hidden style={{ color: col.accent, fontFamily: FONTS.MONO, fontSize: 10, lineHeight: 1.5 }}>
                —
              </span>
              <span style={{ fontFamily: FONTS.SANS, fontSize: 10.5, lineHeight: 1.4, color: COLORS.INK }}>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

/** "from" → "to" reframe rows. */
export const ReframeList: React.FC<{
  rows: ReadonlyArray<{ from: string; to: string }>;
  accent: string;
}> = ({ rows, accent }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {rows.map((r) => (
      <div key={r.to} style={{ display: "grid", gridTemplateColumns: "1fr 22px 1fr", alignItems: "center", columnGap: 8 }}>
        <span style={{ fontFamily: FONTS.SERIF, fontStyle: "italic", fontSize: 13, color: COLORS.INK_MUTED, textAlign: "right" }}>
          {r.from}
        </span>
        <span aria-hidden style={{ color: accent, fontSize: 14, textAlign: "center" }}>
          →
        </span>
        <span style={{ fontFamily: FONTS.MONO, fontSize: 11, fontWeight: 700, color: accent }}>{r.to}</span>
      </div>
    ))}
  </div>
);

/** A mono code / receipt panel on the dark ground. */
export const CodePanel: React.FC<{
  caption: string;
  code: string;
  accent: string;
  style?: React.CSSProperties;
}> = ({ caption, code, accent, style }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
    <div style={{ fontFamily: FONTS.MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>
      {caption}
    </div>
    <pre
      style={{
        margin: 0,
        background: COLORS.GROUND,
        color: COLORS.ON_DARK,
        border: `0.5pt solid ${COLORS.HAIRLINE_STRONG}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 5,
        padding: "12px 14px",
        fontFamily: FONTS.MONO,
        fontSize: 8.2,
        lineHeight: 1.5,
        whiteSpace: "pre",
        overflow: "hidden",
      }}
    >
      {code}
    </pre>
  </div>
);

/** k / v fact grid. */
export const FactGrid: React.FC<{
  facts: ReadonlyArray<{ k: string; v: string }>;
  accent: string;
}> = ({ facts, accent }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
    {facts.map((f) => (
      <div key={f.k} style={{ border: `0.5pt solid ${COLORS.HAIRLINE}`, borderLeft: `2.5px solid ${accent}`, borderRadius: 4, padding: "8px 10px" }}>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.12em", color: COLORS.INK_MUTED }}>{f.k}</div>
        <div style={{ fontFamily: FONTS.MONO, fontSize: 10.5, fontWeight: 600, color: COLORS.INK, marginTop: 2 }}>{f.v}</div>
      </div>
    ))}
  </div>
);

/** Threshold / verdict bands (range · verb · detail). */
export const BandRows: React.FC<{
  bands: ReadonlyArray<{ range: string; verb: string; detail: string; tone: Hue }>;
}> = ({ bands }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    {bands.map((b) => {
      const c = hue(b.tone);
      return (
        <div
          key={b.verb}
          style={{
            display: "grid",
            gridTemplateColumns: "0.9in auto 1fr",
            alignItems: "center",
            columnGap: 12,
            border: `0.5pt solid ${COLORS.HAIRLINE}`,
            borderLeft: `3px solid ${c.bright}`,
            borderRadius: 5,
            background: COLORS.PAPER_ELEVATED,
            padding: "8px 12px",
          }}
        >
          <span style={{ fontFamily: FONTS.MONO, fontSize: 11, fontWeight: 700, color: COLORS.INK, fontVariantNumeric: "tabular-nums" }}>
            {b.range}
          </span>
          <span style={{ fontFamily: FONTS.MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", color: c.deep }}>
            {b.verb}
          </span>
          <span style={{ fontFamily: FONTS.SANS, fontSize: 10, color: COLORS.INK_MUTED }}>{b.detail}</span>
        </div>
      );
    })}
  </div>
);
