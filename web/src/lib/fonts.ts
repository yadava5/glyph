// Vite-compatible Geist font loader.
//
// The upstream `geist/font/sans` and `geist/font/mono` subpath exports only
// work in Next.js because they call into `next/font/local`. To preserve the
// intent (Geist as the site's sans + mono families with `--font-geist-sans`
// and `--font-geist-mono` CSS variables that Tailwind's `@theme` maps to
// `--font-sans` / `--font-mono`), we self-host the variable woff2 files
// (copied into `web/public/fonts/`) and inject the @font-face rules and
// className/variable metadata here.
const SANS_FAMILY = 'GeistVariable';
const MONO_FAMILY = 'GeistMonoVariable';
const SERIF_FAMILY = 'InstrumentSerif';
const STYLE_ID = 'geist-font-face';

function injectFontFaces() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@font-face {
  font-family: '${SANS_FAMILY}';
  src: url('/fonts/Geist-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${MONO_FAMILY}';
  src: url('/fonts/GeistMono-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${SERIF_FAMILY}';
  src: url('/fonts/InstrumentSerif-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${SERIF_FAMILY}';
  src: url('/fonts/InstrumentSerif-Italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
:root {
  --font-geist-sans: '${SANS_FAMILY}', ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: '${MONO_FAMILY}', ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-instrument-serif: '${SERIF_FAMILY}', Georgia, 'Times New Roman', serif;
}
.${SANS_FAMILY.toLowerCase()}-class {
  font-family: var(--font-geist-sans);
}
.${MONO_FAMILY.toLowerCase()}-class {
  font-family: var(--font-geist-mono);
}
`;
  document.head.appendChild(style);
}

injectFontFaces();

export const GeistSans = {
  className: `${SANS_FAMILY.toLowerCase()}-class`,
  variable: '--font-geist-sans',
  style: { fontFamily: `var(--font-geist-sans)` },
};

export const GeistMono = {
  className: `${MONO_FAMILY.toLowerCase()}-class`,
  variable: '--font-geist-mono',
  style: { fontFamily: `var(--font-geist-mono)` },
};

export const InstrumentSerif = {
  variable: '--font-instrument-serif',
  style: { fontFamily: `var(--font-instrument-serif)` },
};
