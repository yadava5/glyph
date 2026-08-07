import puppeteer from "puppeteer";
const urls = process.argv.slice(2);
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
for (const url of urls) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  const res = await page.evaluate(() => ({
    pjs400: document.fonts.check('400 16px "Plus Jakarta Sans"'),
    pjs700: document.fonts.check('700 16px "Plus Jakarta Sans"'),
    serif: document.fonts.check('400 16px "Instrument Serif"'),
    mono: document.fonts.check('400 16px "Monaspace Neon"'),
    loaded: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family + " " + f.weight).slice(0, 30),
  }));
  console.log(url, JSON.stringify(res, null, 1));
  await page.close();
}
await browser.close();
