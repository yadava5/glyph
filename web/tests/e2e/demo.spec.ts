import { expect, test, type Page } from '@playwright/test';
import {
  classifyThroughput,
  kernelBenchmarks,
  wasmRuntimeFacts,
} from '../../src/features/performance/benchmarkData';

/*
 * Benchmark figures are imported, never re-typed. The numbers themselves are
 * gated where they belong — `tools/gen_web_facts.py --check` proves the
 * data layer still matches the committed run records. These assertions prove
 * the page actually renders what the data layer holds, which is the part a
 * unit check cannot see. Hard-coding them here meant that re-sourcing the page
 * onto a different run turned three real tests red for no reason.
 */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rendered = (s: string) => new RegExp(escapeRe(s), 'i');

const matmul256 = kernelBenchmarks.find((k) => k.caseKey === 'benchDot/256')!;
const transpose1024 = kernelBenchmarks.find((k) => k.caseKey === 'benchTranspose/1024')!;
const glueBundleFact = wasmRuntimeFacts.find((f) => f.label === 'Glue bundle')!;
const weightsFact = wasmRuntimeFacts.find((f) => f.label === 'Weights')!;

interface InstrumentedPage extends Page {
  __consoleIssues?: string[];
  __pageErrors?: string[];
  __requestFailures?: string[];
}

async function saveScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: false,
  });
}

async function openCommandPalette(page: Page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const dialog = page.getByRole('dialog', { name: /command palette/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function scrollToId(page: Page, id: string) {
  await page.evaluate((targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, left: 0, behavior: 'auto' });
  }, id);
  await page.waitForTimeout(180);
}

async function getReducedMotionHeroSnapshot(page: Page) {
  return page.evaluate(() => {
    const rectFor = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    return {
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      scrollY: Math.round(window.scrollY),
      heading: rectFor('#hero h1'),
      metrics: rectFor('#hero dl'),
      subhead: (document.querySelector('#hero p')?.textContent ?? '').trim().slice(0, 80),
    };
  });
}

/** The fold visual is the live draw pad — assert it renders at a usable size. */
async function waitForReadableDrawPad(page: Page) {
  const pad = page.locator('#classifier .drawing-canvas').first();

  await expect
    .poll(
      async () => {
        if ((await pad.count()) === 0) return 0;
        const box = await pad.boundingBox();
        return Math.min(box?.width ?? 0, box?.height ?? 0);
      },
      {
        message: 'draw pad should settle before measuring its rendered size',
        timeout: 12_000,
      },
    )
    .toBeGreaterThan(160);

  return pad;
}

test.describe('Glyph landing experience', () => {
  test.beforeEach(async ({ page }) => {
    const instrumentedPage = page as InstrumentedPage;
    instrumentedPage.__consoleIssues = [];
    instrumentedPage.__pageErrors = [];
    instrumentedPage.__requestFailures = [];

    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        instrumentedPage.__consoleIssues?.push(`${message.type()}: ${message.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      instrumentedPage.__pageErrors?.push(error.message);
    });

    page.on('requestfailed', (request) => {
      instrumentedPage.__requestFailures?.push(
        `${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`,
      );
    });
  });

  test.afterEach(async ({ page }) => {
    const instrumentedPage = page as InstrumentedPage;
    expect(instrumentedPage.__consoleIssues ?? []).toEqual([]);
    expect(instrumentedPage.__pageErrors ?? []).toEqual([]);
    expect(instrumentedPage.__requestFailures ?? []).toEqual([]);
  });

  test('@visual @artifacts renders the hero with verified metrics and no WebGL', async ({
    page,
  }) => {
    await page.goto('/index.html');

    await expect(page.getByRole('heading', { name: /Handed a neural network/i })).toBeVisible();
    await expect(
      page.getByText(rendered('a hand-written simd128 kernel, timed on your silicon')).first(),
    ).toBeVisible();
    await expect(page.getByText(/97\.01% \/ 10,000/i)).toBeVisible();
    await expect(page.getByText(rendered(classifyThroughput.baseline)).first()).toBeVisible();

    // The redesign is WebGL-free: no three.js canvas may exist in the hero.
    await expect(page.locator('#hero canvas')).toHaveCount(0);

    // The live workbench (the product) must be present with the draw pad.
    await expect(page.locator('#classifier .drawing-canvas')).toHaveCount(1);

    await saveScreenshot(page, 'landing-hero');
  });

  test('@visual @artifacts keeps the command palette and sample classifier path usable', async ({
    page,
  }) => {
    await page.goto('/index.html');

    const dialog = await openCommandPalette(page);
    await expect(dialog.getByText(/Load sample digit/i)).toBeVisible();
    await saveScreenshot(page, 'command-palette');

    await dialog.getByText(/Load sample digit/i).click();
    await scrollToId(page, 'classifier');

    await expect(page.getByTestId('verdict-digit')).toBeVisible();
    await expect(page.getByTestId('verdict-digit')).toHaveText(/^[0-9]$/);
    await expect(page.getByLabel(/Prediction source:/i)).toHaveText(
      /wasm|js demo fallback|native/i,
    );
    await expect(page.locator('.softmax-bars')).toBeVisible();
    await expect(page.locator('.activation-panel')).toHaveCount(2);

    await saveScreenshot(page, 'classifier-sample');
  });

  test('does not expose the removed light-theme control', async ({ page }) => {
    await page.goto('/index.html');

    const dialog = await openCommandPalette(page);

    await expect(dialog.getByText(/toggle theme/i)).toHaveCount(0);
    await expect(dialog.getByText(/light/i)).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  });

  test('static mode skips localhost backend and labels the fallback truthfully', async ({
    page,
  }) => {
    const backendRequests: string[] = [];
    page.on('request', (request) => {
      if (/^http:\/\/(localhost|127\.0\.0\.1):8080\//.test(request.url())) {
        backendRequests.push(request.url());
      }
    });

    await page.goto('/index.html');
    await page.waitForTimeout(250);
    expect(backendRequests).toEqual([]);

    const dialog = await openCommandPalette(page);
    await dialog.getByText(/Load sample digit/i).click();
    await scrollToId(page, 'classifier');

    await expect(page.getByTestId('verdict-digit')).toBeVisible();
    // Without a configured backend the browser path answers; the badge
    // must say which browser path did (never "native server").
    await expect(page.getByLabel(/Prediction source:/i)).toHaveText(/wasm|js demo fallback/i);
    expect(backendRequests).toEqual([]);
  });

  test('@visual walks the narrative acts', async ({ page }) => {
    await page.goto('/index.html');
    await scrollToId(page, 'problem');

    for (const pattern of [
      /Seven eighths of the/i,
      /Write the lanes/i,
      /four instruction sets/i,
      /Measured, not promised/i,
    ]) {
      const heading = page.getByRole('heading', { name: pattern });
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      await expect(heading).toBeVisible();
    }

    await expect(page.getByText(/79,510/).first()).toBeVisible();
    await expect(page.getByText(/matmul 256×256/i).first()).toBeVisible();
    await expect(page.getByText(rendered(matmul256.speedup)).first()).toBeVisible();
    await saveScreenshot(page, 'chapters');
  });

  test('@perf shows benchmark-backed performance and runtime boundaries', async ({ page }) => {
    await page.goto('/index.html');
    await scrollToId(page, 'proof');

    await expect(page.getByText(rendered(matmul256.baseline)).first()).toBeVisible();
    await expect(page.getByText(rendered(matmul256.optimized)).first()).toBeVisible();
    await expect(page.getByText(rendered(transpose1024.baseline)).first()).toBeVisible();
    await expect(page.getByText(rendered(transpose1024.optimized)).first()).toBeVisible();
    await expect(page.getByText(rendered(classifyThroughput.baseline)).first()).toBeVisible();
    await expect(page.getByText(rendered(classifyThroughput.openmpNative)).first()).toBeVisible();
    await expect(page.getByText(rendered(classifyThroughput.conclusion)).first()).toBeVisible();

    await scrollToId(page, 'build');
    await expect(page.getByRole('heading', { name: /four instruction sets/i })).toBeVisible();
    await expect(page.getByText(rendered(glueBundleFact.value)).first()).toBeVisible();
    await expect(page.getByText(rendered(weightsFact.value)).first()).toBeVisible();
  });

  test('the failure wall fetches its pack and actually draws all 299 specimens', async ({
    page,
  }) => {
    await page.goto('/index.html');

    // Both halves of the record are requested only when 4.7 scrolls in, and
    // the wall needs BOTH: the manifest for the verdicts, the pack for the
    // ink. Watch the requests so "the wall is missing" can be attributed to
    // a fetch that never fired versus one whose result was dropped.
    const got = new Set<string>();
    page.on('response', (r) => {
      const u = r.url();
      if (/misclassified\.(json|bin)$/.test(u) && r.status() === 200) {
        got.add(u.endsWith('.bin') ? 'bin' : 'json');
      }
    });

    await scrollToId(page, 'proof-accuracy');

    const wall = page.getByTestId('failure-wall');
    await expect(wall).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => got.size, { timeout: 20_000, message: 'both halves of the pack must load' })
      .toBe(2);

    // scrollToId parks the CHAPTER's top at the viewport top, and the wall is
    // the last block in it — about 1,160px further down, i.e. off-screen at
    // every viewport this suite runs. The develop pass is gated on an
    // IntersectionObserver by design, so the canvas correctly stays at its
    // default 300×150 and paints nothing until it is actually seen. Playwright's
    // toBeVisible() means "has a box and is not display:none", NOT "in the
    // viewport", so without this line the assertion below reads a canvas that
    // was never asked to paint and the test can never pass — the inverse of the
    // defect it guards against, and it failed identically on all five projects.
    await wall.scrollIntoViewIfNeeded();

    // The defect this test exists for produced a perfectly valid, perfectly
    // empty exhibit: the manifest resolving cancelled the in-flight pack, so
    // the confusion grid rendered and the wall silently never mounted. A
    // presence check passes through that. Count actual non-transparent
    // pixels — the wall is only real if there is ink on it.
    //
    // Polled, not read once: scrollIntoViewIfNeeded resolves when the scroll
    // lands, but the develop pass is rAF-driven over roughly 900ms, so a
    // single read at that instant sees a 300×150 canvas with nothing on it.
    // Measured ramp at 1024×648: 0 at the scroll, 7,727 at +100ms, 49,770 at
    // +500ms, settling at 66,119. Polling rather than sleeping keeps both
    // failure modes sharp — never mounts (toBeVisible trips first) and mounts
    // blank (polls to timeout) — without pinning a machine-dependent delay.
    const inkPixels = () =>
      wall.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        if (c.width === 0 || c.height === 0) return -1;
        // Read through a throwaway copy, never the page's own context.
        // Chromium warns "Multiple readback operations using getImageData"
        // after repeated reads on ONE context, this describe's afterEach
        // fails any test that logs a warning, and polling means many reads —
        // so the naive version of this poll would fail itself. A fresh canvas
        // has no context yet, so willReadFrequently is actually honoured here
        // (passing it to a canvas that already has a context is ignored), and
        // each context is read exactly once.
        const off = document.createElement('canvas');
        off.width = c.width;
        off.height = c.height;
        const octx = off.getContext('2d', { willReadFrequently: true });
        if (!octx) return -1;
        octx.drawImage(c, 0, 0);
        const { data } = octx.getImageData(0, 0, off.width, off.height);
        let lit = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 8) lit += 1;
        return lit;
      });

    await expect
      .poll(inkPixels, {
        timeout: 15_000,
        message: 'the failure wall must actually draw its specimens, not just mount',
      })
      .toBeGreaterThan(5_000);
  });

  /*
   * The "no horizontal overflow" half of this test is a KNOWN BLIND SPOT —
   * see the longer note in smoke.spec.ts. `body { overflow-x: clip }` makes
   * scrollWidth unable to exceed clientWidth, so that assertion cannot fail
   * on a layout defect. The clipped-controls and draw-pad halves are real.
   */
  test('@perf has no horizontal overflow, clipped visible controls, or a blank draw pad', async ({
    page,
  }) => {
    await page.goto('/index.html');

    const pad = await waitForReadableDrawPad(page);
    const padBox = await pad.boundingBox();
    expect(padBox?.width ?? 0).toBeGreaterThan(160);
    expect(padBox?.height ?? 0).toBeGreaterThan(160);

    for (const id of ['hero', 'classifier', 'problem', 'solution', 'build', 'proof', 'try']) {
      await scrollToId(page, id);
      const layout = await page.evaluate((targetId) => {
        const root = document.getElementById(targetId);
        const overflow =
          document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const visible = Array.from(root?.querySelectorAll('h1,h2,h3,button') ?? [])
          .map((node) => {
            const rect = node.getBoundingClientRect();
            const styles = window.getComputedStyle(node);
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            return {
              text: (node.textContent ?? '').slice(0, 60),
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              visible:
                styles.visibility !== 'hidden' &&
                styles.display !== 'none' &&
                rect.bottom > 0 &&
                rect.top < window.innerHeight &&
                centerX >= 0 &&
                centerX <= window.innerWidth &&
                centerY >= 0 &&
                centerY <= window.innerHeight &&
                rect.width > 0 &&
                rect.height > 0,
            };
          })
          .filter((item) => item.visible);
        return { overflow, visible, width: window.innerWidth, height: window.innerHeight };
      }, id);

      expect(layout.overflow, `${id} should not overflow horizontally`).toBeLessThanOrEqual(1);
      for (const item of layout.visible) {
        expect(item.left, `${id}: ${item.text} should not clip left`).toBeGreaterThanOrEqual(-2);
        expect(item.right, `${id}: ${item.text} should not clip right`).toBeLessThanOrEqual(
          layout.width + 2,
        );
      }
    }
  });

  test('@visual reduced-motion hero remains stable across idle time', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes('reduced-motion'), 'reduced-motion projects only');

    await page.goto('/index.html');
    await expect(page.getByRole('heading', { name: /Handed a neural network/i })).toBeVisible();
    await page.waitForTimeout(900);

    const first = await getReducedMotionHeroSnapshot(page);
    await page.waitForTimeout(500);
    const second = await getReducedMotionHeroSnapshot(page);

    expect(first).toEqual(second);
  });
});
