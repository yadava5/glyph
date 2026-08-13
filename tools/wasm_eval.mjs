#!/usr/bin/env node
/**
 * Run the SHIPPED WebAssembly module over the whole MNIST test set and
 * diff its predictions against the committed native run.
 *
 * Why this exists
 * ---------------
 * benchmarks/mnist_eval.json records 9701/10000 = 97.01%, measured by
 * apps/eval_model.cpp with the native double checkpoint. The landing
 * page wants to re-run that claim in the visitor's browser. Two earlier
 * measurements narrowed the gap but did not close it:
 *
 *   - benchmarks/mnist_f32_flips.json showed the float32 weight export
 *     changes zero of the 10,000 predictions. That is the QUANTISATION
 *     difference, and it is nil.
 *   - It explicitly did not cover the other two divergences, because
 *     both of its columns ran through the same native kernel: reduction
 *     order (arm64 NEON reduces two lanes, wasm simd128 reduces four)
 *     and FMA contraction (NEON's vfmaq_f64 never rounds a product,
 *     wasm simd128 has no FMA and rounds every one).
 *
 * Only running the actual wasm kernel captures those two. This script
 * does that, and it does it against the exact bytes the browser fetches
 * -- web/public/wasm/fast_mnist.{js,wasm} and model.weights.bin are read
 * read-only and never rebuilt, so nothing that is digest-gated moves.
 *
 * The shipped Embind binding is usable as-is for bulk work: its
 * timeMeanMs(fn, 3, 60, 5.0) budget is 5 MILLISECONDS (the duration is
 * std::milli), not 5 seconds, and it caps at 60 iterations, so a call
 * costs single-digit milliseconds and the full set runs in ~90 s. The
 * prediction is read from the untimed classifyWithHidden() pass inside
 * that binding, which shares gemv_rowplusbias_sigmoid with the timed
 * classify() calls -- same kernel, same values.
 *
 * Usage:
 *   node tools/wasm_eval.mjs [--out PATH] [--limit N] [--perturb-bias6 D]
 *
 *   --perturb-bias6 D   positive control. Adds D to the class-6 output
 *                       bias in an IN-MEMORY copy of model.weights.bin
 *                       (the file on disk is never touched) so the
 *                       disagreement path can be shown to fire. D=0.01
 *                       is expected to flip exactly index 9858, 8 -> 6.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

// emsdk version the shipped module was built at. Pinned in
// .github/workflows/wasm.yml, which rebuilds and byte-compares.
const EMSDK_PIN = '3.1.64';

const CLASSES = 10;

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};
// resolve(), not join(): an absolute --out must stay absolute rather than
// being pasted under the repo root.
const outPath = resolve(REPO, arg('--out', 'benchmarks/mnist_eval_wasm.json'));
const limit = Number(arg('--limit', '0')) || 0;
const perturbBias6 = Number(arg('--perturb-bias6', '0')) || 0;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const digest = (rel) => {
  const buf = readFileSync(join(REPO, rel));
  return { path: rel, bytes: buf.length, sha256: sha256(buf) };
};

/**
 * Parse an ASCII P2 PGM into normalized doubles, mirroring loadPGM() in
 * apps/eval_model.cpp exactly: the reciprocal is computed once and
 * MULTIPLIED in (1/maxVal is not exactly representable, so v*inv and
 * v/maxVal are not the same double). Every file in data/TestingSet was
 * verified to be `P2 28 28 255` with 788 whitespace-separated tokens and
 * no `#` comment, so a plain tokenizer matches the C++ comment-skipping
 * parser token for token.
 */
function loadPGM(absPath) {
  const tokens = readFileSync(absPath, 'latin1').split(/\s+/);
  let t = 0;
  while (tokens[t] === '') t++;
  if (tokens[t] !== 'P2') throw new Error(`unsupported PGM: ${absPath}`);
  const width = +tokens[t + 1];
  const height = +tokens[t + 2];
  const maxVal = +tokens[t + 3];
  const nPix = width * height;
  const inv = 1.0 / maxVal;
  const px = new Array(nPix);
  for (let i = 0; i < nPix; i++) px[i] = +tokens[t + 4 + i] * inv;
  return px;
}

/** Parse "TestingSet/digit_<ordinal>_<label>.pgm" -> label. */
function labelOf(relPath) {
  const base = relPath.slice(relPath.lastIndexOf('/') + 1);
  const u2 = base.lastIndexOf('_');
  const label = base.charCodeAt(u2 + 1) - 48;
  if (label < 0 || label > 9) throw new Error(`cannot parse label: ${relPath}`);
  return label;
}

const round = (v, n = 12) => Number(v.toFixed(n));

// ---------------------------------------------------------------------------
// native reference: reconstruct all 10,000 predictions from the committed
// artifact. Every image not in `misclassified` was predicted correctly, so
// its prediction IS its true label. This uses the committed record itself
// as the reference rather than a fresh run, which is the point.
// ---------------------------------------------------------------------------

const nativeEvalRel = 'benchmarks/mnist_eval.json';
const nativeEval = JSON.parse(readFileSync(join(REPO, nativeEvalRel), 'utf8'));
const nativeErrors = new Map(
  nativeEval.misclassified.map((m) => [m.index, m]),
);

// The f32-weights study, used to cross-reference any disagreement against
// the argmax margins that decide one.
const f32Rel = 'benchmarks/mnist_f32_flips.json';
const f32Study = JSON.parse(readFileSync(join(REPO, f32Rel), 'utf8'));
const marginByIndex = new Map(
  f32Study.tightest_margins.records.map((r) => [r.index, r]),
);

// ---------------------------------------------------------------------------
// load the shipped module (read-only) and the shipped weights
// ---------------------------------------------------------------------------

const wasmBinary = readFileSync(join(REPO, 'web/public/wasm/fast_mnist.wasm'));
const { default: createFastMnist } = await import(
  join(REPO, 'web/public/wasm/fast_mnist.js')
);
const Module = await createFastMnist({ wasmBinary });
const buildInfo = Module.buildInfo();

const weights = Buffer.from(
  readFileSync(join(REPO, 'web/public/wasm/model.weights.bin')),
);
if (perturbBias6 !== 0) {
  // header(12) + dims(3*4) + biases_l0(100 f32) + biases_l1[6]
  const off = 24 + 100 * 4 + 6 * 4;
  const before = weights.readFloatLE(off);
  weights.writeFloatLE(before + perturbBias6, off);
  console.error(
    `POSITIVE CONTROL: in-memory output bias[6] ${before} -> ` +
      `${weights.readFloatLE(off)} (file on disk untouched)`,
  );
}

const clf = new Module.WasmClassifier();
clf.loadWeightsFromBinary(weights);

// ---------------------------------------------------------------------------
// walk the test set in list order
// ---------------------------------------------------------------------------

const listRel = 'TestingSetList.txt';
const list = readFileSync(join(REPO, listRel), 'utf8')
  .split('\n')
  .map((s) => s.replace(/[\r\n]+$/, ''))
  .filter((s) => s.length > 0);

const t0 = Date.now();
let total = 0;
let correctWasm = 0;
let agree = 0;
const disagreements = [];
const confusion = Array.from({ length: CLASSES }, () =>
  new Array(CLASSES).fill(0),
);

for (const rel of list) {
  if (limit && total >= limit) break;
  const trueLabel = labelOf(rel);
  const nativeErr = nativeErrors.get(total);
  const nativePred = nativeErr ? nativeErr.pred : trueLabel;

  const res = clf.classify(loadPGM(join(REPO, 'data', rel)));
  const wasmPred = res.prediction;

  confusion[trueLabel][wasmPred]++;
  if (wasmPred === trueLabel) correctWasm++;
  if (wasmPred === nativePred) {
    agree++;
  } else {
    const conf = res.confidence;
    disagreements.push({
      index: total,
      file: rel,
      true: trueLabel,
      pred_native_double: nativePred,
      pred_wasm_f32: wasmPred,
      wasm_confidence_of_native_pred: round(conf[nativePred]),
      wasm_confidence_of_wasm_pred: round(conf[wasmPred]),
      wasm_margin_l1: round(conf[wasmPred] - conf[nativePred]),
      native_double_margin:
        marginByIndex.get(total)?.margin_double ?? null,
      native_error_record: nativeErr
        ? {
            pred_activation: nativeErr.pred_activation,
            true_activation: nativeErr.true_activation,
          }
        : null,
      verdict:
        wasmPred === trueLabel
          ? 'helpful'
          : nativePred === trueLabel
            ? 'harmful'
            : 'neutral',
    });
  }
  total++;
  if (total % 1000 === 0) {
    process.stderr.write(
      `  ${total} / ${list.length}  (${Date.now() - t0} ms)\n`,
    );
  }
}
const elapsedMs = Date.now() - t0;

// Re-read the tightest-margin images and record what the wasm module makes
// of them, so a zero-disagreement result is legible as evidence rather than
// as an assertion.
const tightestWatch = f32Study.tightest_margins.records.map((r) => {
  const res = clf.classify(loadPGM(join(REPO, 'data', r.file)));
  const conf = res.confidence;  // already L1-normalized by the binding
  // The activation RATIO is scale-free: L1 normalization divides both
  // terms by the same positive sum, so conf[a]/conf[b] equals the raw
  // ratio the native run computed. Where the committed error record
  // happens to hold exactly this pair of activations, that turns a
  // matching argmax into a quantitative comparison of the activations
  // themselves -- agreement below the decision, not just at it.
  const err = nativeErrors.get(r.index);
  const comparable = err && err.pred === r.top1 && err.true === r.top2;
  const wasmRatio = conf[r.top1] / conf[r.top2];
  const nativeRatio = comparable
    ? err.pred_activation / err.true_activation
    : null;
  return {
    index: r.index,
    file: r.file,
    true: r.true,
    native_double_top1: r.top1,
    native_double_top2: r.top2,
    native_double_margin: r.margin_double,
    wasm_pred: res.prediction,
    wasm_margin_l1_top1_top2: round(conf[r.top1] - conf[r.top2]),
    wasm_ratio_top1_top2: round(wasmRatio),
    native_ratio_top1_top2: nativeRatio === null ? null : round(nativeRatio),
    ratio_rel_delta:
      nativeRatio === null
        ? null
        : Number(Math.abs(wasmRatio / nativeRatio - 1).toExponential(3)),
    ratio_note: comparable
      ? 'native ratio derived from the 6-decimal activations in ' +
        nativeEvalRel + '; rel_delta is bounded below by that precision'
      : 'no comparable native activation pair recorded for this image',
    agrees: res.prediction === r.top1,
  };
});

// ---------------------------------------------------------------------------
// artifact
// ---------------------------------------------------------------------------

const helpful = disagreements.filter((d) => d.verdict === 'helpful').length;
const harmful = disagreements.filter((d) => d.verdict === 'harmful').length;
const neutral = disagreements.filter((d) => d.verdict === 'neutral').length;

const artifact = {
  $comment: [
    'Does the WebAssembly module the browser actually runs reproduce the committed',
    '97.01% accuracy figure, image for image? This is the third and last of the',
    'native-vs-browser divergences to be measured, and the only one that captures',
    'reduction order and FMA contraction, because it runs the real wasm kernel.',
    '',
    'benchmarks/mnist_eval.json records 9701/10000 from apps/eval_model.cpp with the',
    'double checkpoint. benchmarks/mnist_f32_flips.json showed the float32 weight',
    'export changes none of those 10,000 predictions, but both of its columns ran',
    'through the same native arm64 NEON kernel, so it measured quantisation only.',
    'This run replaces the kernel as well: the wasm simd128 dot product uses two',
    'independent f64x2 accumulators reducing four lanes, where NEON uses one',
    'accumulator reducing two, and wasm simd128 has no FMA so it rounds every',
    'product where vfmaq_f64 rounds none.',
    '',
    'Produced by: node tools/wasm_eval.mjs',
    'It reads web/public/wasm/fast_mnist.{js,wasm} and model.weights.bin read-only',
    'and never rebuilds them, so the digest gates in docs/WASM.md,',
    'docs/benchmarks/wasm-simd-census.json, benchRuns.generated.ts and',
    '.github/workflows/wasm.yml are untouched. Running the shipped bytes rather than',
    'a purpose-built eval module is deliberate: it removes the question of whether a',
    'rebuilt module contains the same kernel. An eval-only module calling just',
    'classify() would drop classifyWithHidden() and computeInputGradient() as dead',
    'code, taking the wasm-simd-census signature count from 12 to 4 -- a benign',
    'difference that would nonetheless make the census gate unusable as a check.',
    '',
    'The native reference is reconstructed from benchmarks/mnist_eval.json rather',
    'than re-run: every image absent from its `misclassified` list was predicted',
    'correctly, so its prediction is its true label. The committed record is thus',
    'the thing being compared against, which is the point.',
    '',
    'LIMITATION -- this is one host (Node, digests below) exercising one wasm',
    'engine. The reason to expect a browser to match is not the specification alone.',
    'Every arithmetic operation on this path is compiled INTO fast_mnist.wasm: both',
    'the simd128 dot-product kernel and the std::exp behind the sigmoid, which is',
    'emscripten libm code inside the module, not a host facility. WebAssembly f64',
    'opcodes are IEEE-754 and deterministic -- no engine may reassociate, contract',
    'or widen them -- and everything else is the same bytes, so a conforming engine',
    'executing this module must produce these bits. The residual risk is engine bugs',
    'and any future rebuild of the module, not arithmetic. Note that nothing',
    'currently gates this artifact against the module digest it records, so a',
    'rebuild of fast_mnist.wasm would make it stale silently.',
    '',
    'Reported activations are L1-normalized because that is what the shipped Embind',
    'binding returns; normalization is division by a positive scalar and cannot',
    'change an argmax. Ratios are unaffected by it, which is why the tightest-margin',
    'watch below compares ratios against the committed native activations.',
  ],
  schema: 'glyph.mnist_eval_wasm/1',
  generator: 'tools/wasm_eval.mjs',
  environment: {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    emsdk_pin: EMSDK_PIN,
    emsdk_pin_source: '.github/workflows/wasm.yml',
    module_build_info: buildInfo,
    wall_ms: elapsedMs,
    note:
      'module_build_info is the module\'s own compile-time report; "simd128" ' +
      'means the hand-written dot_wasm128_rowvec kernel was compiled in. ' +
      'emsdk_pin is TRANSCRIBED from the workflow, not read from the module -- ' +
      'emscripten strips version info at -O3 -- so the wasm sha256 below, not ' +
      'this string, is what actually identifies the binary that was run.',
  },
  artifacts: {
    wasm: digest('web/public/wasm/fast_mnist.wasm'),
    glue: digest('web/public/wasm/fast_mnist.js'),
    weights_float32: digest('web/public/wasm/model.weights.bin'),
    weights_double: digest('model.weights'),
    native_reference: digest(nativeEvalRel),
    quantisation_study: digest(f32Rel),
  },
  dataset: { list: listRel, root: 'data', images: total },
  perturbation:
    perturbBias6 === 0
      ? null
      : {
          note: 'POSITIVE CONTROL RUN -- not a measurement of the shipped weights',
          output_bias_class6_delta: perturbBias6,
        },
  accuracy: {
    native_double: {
      correct: nativeEval.overall.correct,
      total: nativeEval.overall.total,
      accuracy_pct: nativeEval.overall.accuracy_pct,
    },
    wasm_float32: {
      correct: correctWasm,
      total,
      accuracy_pct: Number(((correctWasm / total) * 100).toFixed(4)),
    },
    delta_correct: correctWasm - nativeEval.overall.correct,
  },
  agreement: {
    note: 'per-image comparison of argmax against the committed native run',
    images_compared: total,
    identical_predictions: agree,
    disagreements: disagreements.length,
    helpful,
    harmful,
    neutral,
    indices: disagreements.map((d) => d.index),
    records: disagreements,
  },
  tightest_margin_watch: {
    note:
      'the ten smallest native-double argmax margins in the test set (from ' +
      f32Rel + '), and what the wasm module predicts for each. A reduction-' +
      'order or FMA divergence would land here first.',
    records: tightestWatch,
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');

console.log(`module     : ${buildInfo}  (node ${process.version})`);
console.log(`images     : ${total} in ${elapsedMs} ms`);
console.log(
  `native     : ${nativeEval.overall.correct} correct ` +
    `(${nativeEval.overall.accuracy_pct}%)`,
);
console.log(
  `wasm       : ${correctWasm} correct ` +
    `(${((correctWasm / total) * 100).toFixed(4)}%)`,
);
console.log(
  `agreement  : ${agree} / ${total} identical, ` +
    `${disagreements.length} disagree ` +
    `(helpful ${helpful}, harmful ${harmful}, neutral ${neutral})`,
);
if (disagreements.length) {
  console.log(`indices    : ${disagreements.map((d) => d.index).join(', ')}`);
}
console.log(`wrote ${outPath}`);
