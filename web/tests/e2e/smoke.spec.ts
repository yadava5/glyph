import { expect, test, type Page } from '@playwright/test';

/**
 * Interaction smoke for the redesigned landing. Complements demo.spec.ts
 * (which pins copy + verified numbers) by proving the *controls* still do
 * something real: nav/anchor links scroll, the live wasm benchmark runs
 * and emits a measured number, the draw pad classifies, every CTA and the
 * /system-card link resolve, the command palette navigates to sections
 * that exist, and 375px has no horizontal overflow — all with a clean
 * console.
 *
 * The webServer is built with VITE_ENABLE_WASM=true (see
 * playwright.config.ts), so the workbench answers via the real simd128
 * kernel, exactly as production does.
 */

interface Instrumented extends Page {
  __consoleIssues?: string[];
  __pageErrors?: string[];
}

function instrument(page: Page) {
  const p = page as Instrumented;
  p.__consoleIssues = [];
  p.__pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      p.__consoleIssues?.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => p.__pageErrors?.push(e.message));
}

function assertClean(page: Page) {
  const p = page as Instrumented;
  expect(p.__consoleIssues ?? [], 'console should be free of errors/warnings').toEqual([]);
  expect(p.__pageErrors ?? [], 'no uncaught page errors').toEqual([]);
}

/**
 * Poll until section `id` has been scrolled into the upper portion of the
 * viewport — proving the anchor/CTA had a real navigational effect. We
 * don't pin the exact offset: reveal animations and the workbench's
 * auto-run grow content while the smooth scroll settles, so the resting
 * top drifts. "Start of the section is in the top ~60% of the viewport"
 * cleanly separates a working jump from a no-op (which leaves the target
 * thousands of px below).
 */
async function expectScrolledTo(page: Page, id: string) {
  await expect
    .poll(
      () =>
        page.evaluate((target) => {
          const el = document.getElementById(target);
          if (!el) return Number.POSITIVE_INFINITY;
          const r = el.getBoundingClientRect();
          // Distance of the section's top edge from the top of the
          // viewport, as a fraction of viewport height (can be negative
          // if the section starts just above the fold).
          return r.top / window.innerHeight;
        }, id),
      { message: `should scroll ${id} into view`, timeout: 8_000 },
    )
    .toBeLessThan(0.6);
}

test.describe('Landing interaction smoke', () => {
  test.beforeEach(({ page }) => instrument(page));

  test('nav anchor links scroll to each act', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.getByRole('heading', { name: /Handed a neural network/i })).toBeVisible();

    const nav = page.locator('header nav[aria-label="Sections"]');
    for (const id of ['problem', 'solution', 'build', 'classifier', 'proof']) {
      const label = id === 'classifier' ? 'live bench' : id;
      await nav.getByRole('button', { name: label, exact: true }).click();
      await expectScrolledTo(page, id);
    }
    assertClean(page);
  });

  test('hero CTAs resolve: read the proof scroll + system card link', async ({ page }) => {
    await page.goto('/index.html');

    // Primary CTA scrolls to the proof section — the bench itself already
    // sits on the fold, so there is nothing left to "fire".
    await page
      .getByRole('button', { name: /Read the proof/i })
      .first()
      .click();
    await expectScrolledTo(page, 'proof');

    // The System Card CTA points at the canonical path and renders there.
    const cardLink = page.getByRole('link', { name: /Read the System Card/i }).first();
    await expect(cardLink).toHaveAttribute('href', '/system-card');
    assertClean(page);
  });

  test('the live wasm benchmark runs and emits a measured number', async ({ page }) => {
    await page.goto('/index.html');

    // Deterministic path: click the canvas toolbar's reload-sample button,
    // which loads strokes and fires a real classify through the wasm module.
    await page.getByRole('button', { name: /reload sample digit/i }).click();

    // A numeric verdict must appear.
    const verdict = page.getByTestId('verdict-digit');
    await expect(verdict).toBeVisible({ timeout: 15_000 });
    await expect(verdict).toHaveText(/^[0-9]$/);

    // The prediction must have run through the real wasm kernel, not the
    // JS demo fallback (the build enables wasm).
    await expect(page.getByLabel(/Prediction source:/i)).toHaveText(/wasm/i);

    // The live proof-line readout — on the fold with the bench, not the
    // titlebar — must show a measured timing (a real number with a ms/µs
    // unit), proving the in-browser benchmark actually produced a figure
    // rather than sitting idle. `Live kernel comparison` is the stable
    // aria-label prefix; anchor on it rather than the numbers it carries.
    const readout = page.locator('[aria-label*="kernel comparison" i]').first();

    // These assertions must be able to FAIL on an idle bench. The obvious
    // pair — /\d/ and /simd|ms|µs/i — cannot: the idle line still renders
    // "scalar —→simd128 ——awaiting ink", whose "simd128" satisfies both.
    // A check that passes whether or not the thing under test happened is
    // not a check. Anchor instead on strings the idle branch cannot
    // produce: it renders aria-label "Live kernel comparison, idle" and
    // captions itself "awaiting ink".
    await expect(readout).not.toHaveAttribute('data-idle', /.*/);
    await expect(readout).toHaveAttribute(
      'aria-label',
      /Live kernel comparison: scalar .+ versus simd .+, [\d.]+ times faster/i,
    );

    // And the provenance caption must report a real run count. "p50" is
    // deliberately NOT asserted — it is absent at n=1 by design, because a
    // median of one sample is not a median.
    await expect(readout.locator('small')).toHaveText(/^[\d,]+ timed runs · /);
    assertClean(page);
  });

  test('drawing on the pad classifies the ink', async ({ page }) => {
    await page.goto('/index.html');

    const pad = page.locator('#classifier .drawing-canvas').first();
    await pad.scrollIntoViewIfNeeded();
    await expect(pad).toBeVisible();

    // Clear whatever the auto-run/sample left, then draw a rough vertical
    // stroke (a "1") with real pointer moves.
    const box = await pad.boundingBox();
    if (!box) throw new Error('draw pad has no box');
    const cx = box.x + box.width / 2;
    await page.mouse.move(cx, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(cx, box.y + box.height * 0.45, { steps: 6 });
    await page.mouse.move(cx, box.y + box.height * 0.8, { steps: 6 });
    await page.mouse.up();

    // Fresh ink must yield a numeric verdict from the wasm path.
    const verdict = page.getByTestId('verdict-digit');
    await expect(verdict).toBeVisible({ timeout: 15_000 });
    await expect(verdict).toHaveText(/^[0-9]$/);
    await expect(page.getByLabel(/Prediction source:/i)).toHaveText(/wasm/i);
    assertClean(page);
  });

  test('/system-card returns 200 and renders', async ({ page, request }) => {
    // The canonical (linked) path must serve the card, not the SPA.
    const res = await request.get('/system-card');
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/System Card/i);

    await page.goto('/system-card');
    await expect(page).toHaveTitle(/System Card/i);
    // The card is its own React app — assert it actually mounted content.
    await expect(page.locator('#root')).not.toBeEmpty();
    assertClean(page);
  });

  test('command palette navigates to sections that exist (no dead targets)', async ({ page }) => {
    await page.goto('/index.html');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    const dialog = page.getByRole('dialog', { name: /command palette/i });
    await expect(dialog).toBeVisible();

    // The stale actions that pointed at removed sections must be gone
    // (match their full former labels/details, not loose substrings).
    for (const gone of [
      /Go to forward pass/i,
      /Go to runtime paths/i,
      /Go to reproducibility/i,
      /3D inference cockpit/i,
    ]) {
      await expect(dialog.getByText(gone)).toHaveCount(0);
    }

    // A live navigation action must actually move the page.
    await dialog.getByText(/Go to the proof/i).click();
    await expect(dialog).toBeHidden();
    await expectScrolledTo(page, 'proof');
    assertClean(page);
  });

  test('no horizontal overflow at 375px, and the live gauge fits', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    await expect(page.getByRole('heading', { name: /Handed a neural network/i })).toBeVisible();

    // Walk the whole page; at no scroll position may the document scroll
    // horizontally, and nothing may spill past the viewport unless it sits
    // inside its own overflow-scroll container (code blocks).
    for (const id of ['hero', 'problem', 'solution', 'build', 'classifier', 'proof', 'try']) {
      await page.evaluate((target) => {
        document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }, id);
      const report = await page.evaluate(() => {
        const de = document.documentElement;
        const iw = window.innerWidth;
        const uncontained: string[] = [];
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          const r = el.getBoundingClientRect();
          if (!r.width || r.right <= iw + 1) continue;
          let n = el.parentElement;
          let contained = false;
          while (n) {
            const o = getComputedStyle(n).overflowX;
            if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') {
              contained = true;
              break;
            }
            n = n.parentElement;
          }
          if (!contained)
            uncontained.push((el.textContent ?? '').trim().slice(0, 30) || el.tagName);
        }
        return { overflowX: de.scrollWidth - de.clientWidth, uncontained };
      });
      expect(report.overflowX, `#${id} page must not scroll horizontally`).toBeLessThanOrEqual(1);
      expect(report.uncontained, `#${id} has content spilling past the viewport`).toEqual([]);
    }

    // The "one live number" gauge row must fit the mobile column.
    const gauge = page.locator('[class*="liveInstrument"]').first();
    const gbox = await gauge.boundingBox();
    expect(gbox?.width ?? 999).toBeLessThanOrEqual(375);
    assertClean(page);
  });
});
