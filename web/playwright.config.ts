import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 12_000,
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'on',
  },
  webServer: {
    // Build with the WASM classifier enabled so e2e exercises the real
    // in-browser simd128 benchmark path (what production ships), not the
    // JS demo fallback. The wasm artifacts live in public/wasm/.
    command: `VITE_ENABLE_WASM=true npm run build && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    /*
     * 1024 is the width this project is actually reviewed at, and until now
     * nothing ran there: every project was 1440 or 1920. A layout defect
     * gated between 1024 and 1440 was invisible to the whole suite while
     * being the first thing a human saw. 648 rather than a round number is
     * the measured inner height of that browser, so the fold assertions
     * here describe a real viewport instead of an idealised one.
     */
    {
      name: 'laptop',
      use: {
        viewport: { width: 1024, height: 648 },
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'desktop-tall',
      use: {
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: 'wide',
      use: {
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'reduced-motion-desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      },
    },
  ],
});
