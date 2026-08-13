import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installConsoleFilters } from './lib/consoleFilters';
import { GeistSans } from './lib/fonts';
import './index.css';
import App from './App.tsx';

installConsoleFilters();

// Apply the Geist sans class to <html> so the font takes effect site-wide.
//
// There used to be a second line here:
//
//   document.documentElement.style.setProperty(GeistMono.variable, 'var(--font-geist-mono)');
//
// `GeistMono.variable` IS the string `--font-geist-mono`, so that set an inline
// `--font-geist-mono: var(--font-geist-mono)` on <html> — a custom property
// referencing itself. Per spec that is invalid at computed-value time, so the
// token resolved to the guaranteed-invalid value; and being an inline style it
// beat the `:root` rule that lib/fonts.ts injects with the real stack. Tailwind's
// `--font-mono: var(--font-geist-mono)` inherited the emptiness, and every
// `font-family: var(--font-mono)` on the site silently fell back to Geist Sans.
//
// Geist Mono therefore never rendered a single glyph, and the font file was never
// even fetched (`document.fonts` reported it `unloaded`). Ninety-nine CSS rules
// were inert. Removing the line is the whole fix — lib/fonts.ts already defines
// the token correctly.
document.documentElement.classList.add(GeistSans.className);

// Opt into the scroll-reveal enhancement. The matching CSS keeps every
// [data-reveal] block visible by default and only hides-then-animates when
// this class is present AND (prefers-reduced-motion: no-preference). Setting
// it here — before React commits and paints — means no-JS, crawlers, and
// reduced-motion users always render the content visible, with no flash.
document.documentElement.classList.add('js-reveal');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
