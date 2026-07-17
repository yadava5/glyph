import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = new URL('../dist/assets/', import.meta.url);

// The redesigned landing ships a single entry chunk: no WebGL, no three.js.
// The old page lazy-loaded a ~2.6MB three-vendor chunk for a hero scene;
// the current budget exists to keep that class of dependency from creeping
// back into the page.
const budgets = [
  {
    label: 'entry bundle',
    match: /^index-.*\.js$/,
    maxRawKb: 460,
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

if (failed) {
  process.exit(1);
}
