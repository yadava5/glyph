import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = new URL('../dist/assets/', import.meta.url);

// The redesigned landing ships a single entry chunk: no WebGL, no three.js.
// The old page lazy-loaded a ~2.6MB three-vendor chunk for a hero scene;
// the current budget exists to keep that class of dependency from creeping
// back into the page.
// Raised from 460 to 472 KiB raw on 2026-08-13. The page stopped carrying
// hand-typed benchmark figures and started carrying the run records they are
// derived from (benchRuns.generated.ts, ~7 KiB of medians read out of
// docs/benchmarks/runs/). That is the cost of a number that cannot go stale,
// and it is worth paying. The gzip budget — what a visitor actually
// downloads — is unchanged and remains the binding constraint at 145.9/150.
const budgets = [
  {
    label: 'entry bundle',
    match: /^index-.*\.js$/,
    maxRawKb: 472,
    maxGzipKb: 150,
  },
];

// Chunks that must NOT exist in the build output anymore.
const forbidden = [
  { label: 'three vendor chunk', match: /^three-vendor-.*\.js$/ },
  { label: 'three module chunk', match: /three\.module/ },
];

function sizeKb(bytes) {
  return bytes / 1024;
}

let failed = false;
const assets = readdirSync(assetsDir);

for (const budget of budgets) {
  const candidates = assets.filter((file) => budget.match.test(file));
  if (candidates.length !== 1) {
    console.error(`${budget.label}: expected one matching asset, found ${candidates.length}.`);
    failed = true;
    continue;
  }

  const filePath = join(assetsDir.pathname, candidates[0]);
  const rawBytes = statSync(filePath).size;
  const gzipBytes = gzipSync(readFileSync(filePath)).length;
  const rawKb = sizeKb(rawBytes);
  const gzipKb = sizeKb(gzipBytes);

  console.log(`${budget.label}: ${rawKb.toFixed(1)} KiB raw / ${gzipKb.toFixed(1)} KiB gzip`);

  if (rawKb > budget.maxRawKb || gzipKb > budget.maxGzipKb) {
    console.error(
      `${budget.label} exceeds budget: max ${budget.maxRawKb} KiB raw / ${budget.maxGzipKb} KiB gzip.`,
    );
    failed = true;
  }
}

for (const rule of forbidden) {
  const hits = assets.filter((file) => rule.match.test(file));
  if (hits.length > 0) {
    console.error(`${rule.label}: must not ship, found ${hits.join(', ')}.`);
    failed = true;
  }
}

// The entry rule above could not fail for anything that is code-split. The
// charts live in a lazy `PerfViz-*.js` chunk, so a heavy charting library
// imported there would have landed in a chunk no rule looked at and the gate
// would have reported success. Budget the whole of the shipped JavaScript, and
// print every chunk so a jump is attributable rather than just over.
const TOTAL_JS_RAW_KB = 500;
const TOTAL_JS_GZIP_KB = 165;

const jsChunks = assets
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const filePath = join(assetsDir.pathname, file);
    const raw = statSync(filePath).size;
    return { file, rawKb: sizeKb(raw), gzipKb: sizeKb(gzipSync(readFileSync(filePath)).length) };
  })
  .sort((a, b) => b.rawKb - a.rawKb);

const totalRawKb = jsChunks.reduce((sum, c) => sum + c.rawKb, 0);
const totalGzipKb = jsChunks.reduce((sum, c) => sum + c.gzipKb, 0);

console.log(`all JS (${jsChunks.length} chunks): ${totalRawKb.toFixed(1)} KiB raw / ${totalGzipKb.toFixed(1)} KiB gzip`);
for (const c of jsChunks) {
  console.log(`  ${c.file}: ${c.rawKb.toFixed(1)} KiB raw / ${c.gzipKb.toFixed(1)} KiB gzip`);
}

if (totalRawKb > TOTAL_JS_RAW_KB || totalGzipKb > TOTAL_JS_GZIP_KB) {
  console.error(
    `all JS exceeds budget: max ${TOTAL_JS_RAW_KB} KiB raw / ${TOTAL_JS_GZIP_KB} KiB gzip.`,
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}
