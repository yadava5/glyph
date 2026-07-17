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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
