import { expect, type Page } from '@playwright/test';

/*
 * Horizontal-overflow detection that can actually fail, and proves it on every
 * run.
 *
 * Two tests here were named "no horizontal overflow" and neither could detect
 * any. Both compared `documentElement.scrollWidth` against `clientWidth`, and
 * the element that swallows in-page overflow is `.page { overflow-x: clip }`
 * (LandingPage.module.css) — NOT `body`, which also sets clip but demonstrably
 * does not stop the document reporting a wider scrollWidth: with a probe
 * appended to `body`, scrollWidth read 975 against a clientWidth of 375. With
 * the same probe inside a section, the difference was 0. Fix this from the
 * wrong element and you fix nothing.
 *
 * Walking element rects finds real geometry, but the exclusions are where it
 * goes wrong, and the first version of this file got them exactly backwards:
 * it forgave any ancestor matching /hidden|clip|auto|scroll/. `body` sets
 * `overflow-x: clip`, so EVERY element under `body *` had a forgiving
 * ancestor and the walk returned an empty list unconditionally — including
 * for a deliberately planted element 1648px wide in a 375px viewport. It was
 * as vacuous as the assertion it replaced.
 *
 * The distinction that matters is reachability, not containment:
 *
 *   - `auto` / `scroll` — the reader can scroll to it. A sideways rail or a
 *     code block extending past the fold is doing its job. Skip it.
 *   - `clip` / `hidden` — the overhang is destroyed and unreachable. That is
 *     the defect. Do NOT skip it, however deliberate the clip looks.
 *   - `position: fixed` — placed against the viewport rather than the flow,
 *     so off-canvas is a placement decision. Skip it.
 *   - zero-area and hidden elements have no geometry to spill. Skip them.
 *   - an overhang of `DECORATIVE_BLEED_PX` or less is a deliberate edge bleed.
 *     This is a number on purpose: the version that pardoned "decorative"
 *     elements by their shape excused a third of the page, including the
 *     ledger bars and softmax fills that encode values in their length.
 *
 * The exclusion list is also the standing risk: each entry is a way for this
 * to stop seeing anything while still returning an empty list that reads as
 * success. So callers use `expectNoHorizontalOverflow`, which plants an
 * oversized element and REQUIRES the walk to find it before any clean result
 * is believed. That control is what caught the backwards version above — it
 * refused to certify rather than reporting a page it had not inspected.
 *
 * TWO BOUNDS ON WHAT THIS PROMISES, both measured rather than assumed:
 *
 * 1. A card bled 2px to the edge loses its entire right border and both right
 *    corner radii, reads as an open broken box, and is PARDONED — the same
 *    card at 3px is caught, and screenshots of the two are indistinguishable.
 *    The threshold is kept at 2 anyway: across 29 viewport widths from 320 to
 *    2560 and 6 device pixel ratios, the only things ever inside `0 < over <=
 *    2` are `.lanes` and `.lanesLit`, at exactly 2.000 every time. Nothing
 *    real is hidden today, and the cost of 0 is changing a deliberate visual.
 *    If something bordered ever needs to bleed here, change the element.
 * 2. `getBoundingClientRect` excludes `outline` and `box-shadow`, so a control
 *    sitting flush at the edge can have its focus ring visibly sheared and
 *    this reports nothing — at ANY threshold, including 0. A clipped focus
 *    ring is structurally invisible to a rect walk. That is the honest edge of
 *    what a geometry check can see, not a bug to be fixed by tuning.
 *
 * (Also measured, so nobody rediscovers it as a page defect: `body { zoom }`
 * rescales the -2px inset and pushes the lanes to 3. Real browser zoom is a
 * device-pixel-ratio change plus a smaller CSS viewport, which the sweep
 * above covers and which leaves the overhang at exactly 2.)
 */

export interface Offender {
  over: number;
  tag: string;
  cls: string;
  id: string;
  left: number;
  right: number;
}

/**
 * Overhang, in px, that is treated as a deliberate edge bleed rather than a
 * defect. `.lanes` / `.lanesLit` sit at `inset: -2px` so the repeating lane
 * gradient has no visible seam, and 2px of a 4.5%-opacity gradient being
 * clipped destroys nothing a reader could perceive.
 *
 * Keep this small and keep it a number. Raising it is a decision someone can
 * read in a diff; the alternative — pardoning by what an element "is" —
 * silently widened to a third of the page. If a new element needs more than
 * this, change the element, not the threshold.
 */
const DECORATIVE_BLEED_PX = 2;

// Serialised into the page by page.evaluate, so it captures NOTHING from this
// module's scope — the threshold has to be passed in, not closed over.
const WALK = (bleedPx: number) => {
  const vw = document.documentElement.clientWidth;
  const out: Offender[] = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const over = Math.max(Math.round(r.right - vw), Math.round(-r.left));
    if (over <= 0) continue;

    let scrollable = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      // `auto` and `scroll` are a PARDON: the container scrolls, so the reader
      // can still reach what extends past it — a sideways-scrolling rail or a
      // code block is doing its job. `clip` and `hidden` are the OPPOSITE: the
      // overhang is destroyed, never reachable, which is the defect this walk
      // exists to find. Forgiving all four is what made the first version of
      // this file vacuous — `body` itself sets `overflow-x: clip`, so every
      // element under `body *` had a clipping ancestor and the walk returned
      // an empty list unconditionally, including for a probe 600px wider than
      // the viewport.
      if (/auto|scroll/.test(getComputedStyle(p).overflowX)) {
        scrollable = true;
        break;
      }
    }
    if (scrollable) continue;

    // The pardon is a NUMBER, not a judgement about what an element is for.
    //
    // This was briefly "excuse purely decorative layers" — no children, no
    // text, no role or label — so `.lanes`/`.lanesLit` could keep their
    // deliberate `inset: -2px` seam-hiding bleed without a test forcing a
    // visual change. That predicate pardoned **523 of 1479 painted elements
    // at 375, 295 of which paint something visible**: 177 `<i>`, 90
    // `_failureZero`, 12 `_ledgerBar`, 3 `.softmax-fill`. The ledger bars and
    // the softmax fills encode their values IN THEIR LENGTH — a third of the
    // page was pardoned and the pardoned set included the data marks.
    //
    // It was defeated concretely, not in theory. Forcing the census ticks to
    // 4px pushed 25 of 89 past the viewport, where `.page`'s clip destroys
    // them: the figure would draw 64 ticks under a caption saying 89. The
    // walk reported zero offenders. Worse, the CSS fix in the same change
    // (`minmax(0, 1fr)` + `min-width: 0`) is what removed the coupling the
    // old test relied on to see that class of defect through the strip's
    // prose siblings — both fixes correct alone, together they opened a hole.
    //
    // A size threshold cannot grow with the DOM. The lanes overhang by
    // exactly 2px at every width measured; the tick shear reached 121px.
    if (over <= bleedPx) continue;

    out.push({
      over,
      tag: el.tagName.toLowerCase(),
      cls: String((el as HTMLElement).className || '').slice(0, 60),
      id: el.id || '',
      left: Math.round(r.left),
      right: Math.round(r.right),
    });
  }
  return out.sort((a, b) => b.over - a.over);
};

export async function horizontalOverflowOffenders(page: Page): Promise<Offender[]> {
  return page.evaluate(WALK, DECORATIVE_BLEED_PX);
}

/**
 * Assert the page has no horizontal overflow — after proving, in the same
 * browser and on the same DOM, that this check is capable of reporting one.
 *
 * The control injects a static element 600px wider than the viewport at the
 * end of `<body>`, which no exclusion above should forgive: it is not fixed,
 * not hidden, has area, and is not inside a scroller. If the walk does not
 * find it, the check has gone blind and we fail there rather than reporting a
 * clean page we never actually inspected.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const CONTROL_ID = '__overflow_control__';

  await page.evaluate((id) => {
    const probe = document.createElement('div');
    probe.id = id;
    probe.textContent = 'overflow control probe';
    probe.style.cssText = `position:static;width:${window.innerWidth + 600}px;height:8px;flex:none`;
    document.body.appendChild(probe);
  }, CONTROL_ID);
  const withProbe = await horizontalOverflowOffenders(page);
  await page.evaluate((id) => document.getElementById(id)?.remove(), CONTROL_ID);
  const caught = withProbe.some((o) => o.id === CONTROL_ID);

  expect(
    caught,
    `${label}: the overflow walk failed to notice an element 600px wider than the viewport, ` +
      `so a clean result from it would mean nothing`,
  ).toBe(true);

  const offenders = await horizontalOverflowOffenders(page);
  expect(
    offenders,
    `${label}: elements extend past the viewport without a scrolling or clipping ancestor:\n` +
      offenders
        .map((o) => `  ${o.tag}.${o.cls}${o.id && `#${o.id}`} over by ${o.over}px`)
        .join('\n'),
  ).toEqual([]);
}
