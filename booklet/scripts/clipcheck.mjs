/**
 * Dev-only layout auditor: for every .page, flag
 *  (a) descendants whose border-box escapes the page box (right/bottom/left/top)
 *  (b) elements whose text is clipped by their own overflow (scrollW/H > clientW/H)
 *  (c) SVG <text> nodes whose bbox escapes the svg viewBox box
 * Usage: BOOKLET_URL=http://localhost:PORT node scripts/clipcheck.mjs
 */
import puppeteer from "puppeteer";

const URL = process.env.BOOKLET_URL ?? "http://localhost:5182";
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--font-render-hinting=none"] });
const page = await browser.newPage();
await page.setViewport({ width: 840, height: 1080, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
await page.evaluate(async () => { await document.fonts.ready; });
await new Promise((r) => setTimeout(r, 500));

const report = await page.evaluate(() => {
  const out = [];
  const pages = [...document.querySelectorAll(".page")];
  const snip = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
  pages.forEach((pg, i) => {
    const pr = pg.getBoundingClientRect();
    const issues = [];
    for (const el of pg.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el);
      // (a) escapes page box (ignore elements inside overflow:hidden ancestors that clip them silently — still report the ancestor clip via (b))
      const eps = 1.5;
      if (r.right > pr.right + eps || r.bottom > pr.bottom + eps || r.left < pr.left - eps || r.top < pr.top - eps) {
        // walk up: if any ancestor (below page) has overflow hidden and contains it, the page box escape is moot
        issues.push({ kind: "escapes-page", tag: el.tagName, txt: snip(el), dr: Math.round(r.right - pr.right), db: Math.round(r.bottom - pr.bottom), dl: Math.round(pr.left - r.left), dt: Math.round(pr.top - r.top) });
      }
      // (b) own-overflow text clip
      if (el.children.length === 0 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
        const ox = cs.overflowX, oy = cs.overflowY;
        if (ox !== "visible" || oy !== "visible") {
          issues.push({ kind: "self-clip", tag: el.tagName, txt: snip(el), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
        }
      }
      // (c) svg text outside its svg box
      if (el.tagName === "text") {
        const svg = el.ownerSVGElement;
        if (svg) {
          const sr = svg.getBoundingClientRect();
          if (r.right > sr.right + 0.5 || r.left < sr.left - 0.5 || r.bottom > sr.bottom + 0.5 || r.top < sr.top - 0.5) {
            issues.push({ kind: "svg-text-out", txt: snip(el), dr: +(r.right - sr.right).toFixed(1), dl: +(sr.left - r.left).toFixed(1), db: +(r.bottom - sr.bottom).toFixed(1), dt: +(sr.top - r.top).toFixed(1) });
          }
        }
      }
    }
    if (issues.length) out.push({ page: i + 1, issues: issues.slice(0, 12) });
  });
  return out;
});

if (report.length === 0) console.log("[clipcheck] CLEAN — no escapes/clips detected");
for (const p of report) {
  console.log(`\n[clipcheck] PAGE ${p.page}`);
  for (const it of p.issues) console.log("  ", JSON.stringify(it));
}
await browser.close();
