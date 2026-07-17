import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
// The landing redesign is WebGL-free: no three.js, no manual vendor
// chunking. scripts/check-bundle-budget.mjs guards the entry size and
// fails the build if a three-vendor chunk ever reappears.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Keep unprefixed modern properties (backdrop-filter) in the output:
    // the default conservative target rewrote the nav's glass blur to a
    // -webkit- only rule, silently shipping no blur to Chromium/Firefox.
    cssTarget: ['chrome111', 'safari16', 'firefox128'],
  },
});
