import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Apply the project's `reducedMotion` setting to the page, and PROVE it landed.
 *
 * `playwright.config.ts` declares `use: { reducedMotion: 'reduce' }` on the
 * `reduced-motion-desktop` project, and under @playwright/test 1.59.1 that
 * option does not reach the browser context here. Measured three ways, with
 * positive controls that both work:
 *
 *     runner sees it:      testInfo.project.use.reducedMotion === 'reduce'
 *     page reports:        matchMedia('(prefers-reduced-motion: reduce)') === false
 *     page.emulateMedia:   → true      (control: emulation works)
 *     browser.newContext:  → true      (control: the option itself works)
 *
 * So the project that exists to test reduced motion has never once run under
 * it, and the one reduced-motion-gated test — the only source of this suite's
 * four skips — has been asserting against normal motion in a project named for
 * the opposite. A test that runs in the wrong environment is the same defect
 * as a test that does not run: green either way, meaningless either way.
 *
 * This forces the emulation and then reads the media query back. If the
 * emulation ever stops working, the assertion fails loudly rather than the
 * suite quietly testing the wrong thing again. Call it from `beforeEach`,
 * before the first navigation, so the page never observes the wrong value.
 */
export async function applyProjectMotionPreference(page: Page, testInfo: TestInfo): Promise<void> {
  const declared = testInfo.project.use.reducedMotion ?? 'no-preference';
  await page.emulateMedia({ reducedMotion: declared });

  const applied = await page.evaluate(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  expect(
    applied,
    `project "${testInfo.project.name}" declares reducedMotion: "${declared}", but the page ` +
      `reports prefers-reduced-motion: reduce = ${applied}. The emulation is not reaching the ` +
      `browser, so this project is testing the wrong environment.`,
  ).toBe(declared === 'reduce');
}
