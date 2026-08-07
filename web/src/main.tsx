import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installConsoleFilters } from './lib/consoleFilters';
import { GeistSans, GeistMono } from './lib/fonts';
import './index.css';
import App from './App.tsx';

installConsoleFilters();

// Apply Geist classes to <html> so the fonts take effect site-wide and so
// `--font-geist-sans` / `--font-geist-mono` are available to every descendant.
document.documentElement.classList.add(GeistSans.className);
document.documentElement.style.setProperty(GeistMono.variable, 'var(--font-geist-mono)');

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
