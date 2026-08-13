/*
 * Display data for the landing page.
 *
 * Benchmark figures are NOT typed here. They are derived, at build time, from
 * `benchRuns.generated.ts` — which `tools/gen_web_facts.py` writes out of
 * the Google Benchmark JSON committed in `docs/benchmarks/runs/`, and which CI
 * regenerates and diffs on every push. If a run record changes and this page
 * is not rebuilt from it, the build goes red.
 *
 * That machinery exists because the alternative failed. Until 2026-08-13 every
 * number below was a hand-typed copy of a December 2025 MacBook Air run, and
 * it stayed that way for months after `docs/benchmarks/ENVIRONMENT.md` named a
 * different machine as the repository's reference — quietly leaving the
 * most-visited surface on the record where threading looks best.
 *
 * The display run is now the reference: the 2026-08-02 Apple M1 Pro pair, ten
 * repetitions per case, medians. Shipped artifact sizes are measured off the
 * committed files in `web/public/wasm/`, and source-derived facts (lane widths,
 * intrinsics) come from `src/NeuralNet.cpp`. Nothing on the page may claim a
 * number that is not reproducible from the repository.
 */

import {
  caseRow,
  caseRows,
  december,
  dot20x,
  formatGflops,
  formatImagesPerSecond,
  formatKb,
  formatNs,
  formatRunDate,
  formatSlowdown,
  formatSpeedup,
  gflops,
  imagesPerSecond,
  parseCase,
  reference,
  shippedArtifacts,
  simdCensus,
  speedup,
  winRecord,
} from './benchDerive';

export { reference as referenceRun, december as decemberRun, dot20x as dot20xRun };
export { simdCensus };

export const architectureMetrics = {
  topology: '784 -> 100 -> 10',
  accuracy: '97.01% test accuracy',
  inputPixels: '784 pixels',
  hiddenUnits: '100 hidden units',
  outputs: '10 outputs',
} as const;

/** Every sized matrix case in the reference run, in family/size order. */
export const referenceRows = caseRows(reference);

/** How threading does across the whole matrix suite: 4 wins, 8 losses of 12. */
export const referenceRecord = winRecord(reference);

/** The same tally on the December Air, which is kinder to threading: 6 of 12. */
export const decemberRecord = winRecord(december);

/** `axpy 1024` is the case that changes sign between the two machines. */
export const signFlip = {
  op: 'axpy 1024',
  caseKey: 'benchAxpy/1024',
  december: formatSpeedup(speedup(december.cases['benchAxpy/1024'])),
  reference: formatSlowdown(speedup(reference.cases['benchAxpy/1024'])),
} as const;

/*
 * Kernel cards. IMPORTANT LABELING: the "baseline" config is single-threaded
 * WITHOUT -march=native, but the hand-written SIMD kernels (NEON on the M1 Pro
 * that produced this run) are compiled in for BOTH configs — so these ratios
 * measure threading + native codegen on top of SIMD, not SIMD vs scalar. The
 * rows are labeled accordingly. The scalar-vs-SIMD comparison is the live one
 * in the workbench (wasm simd128 kernel vs vectorization-disabled scalar).
 *
 * The three cases are chosen to span the result, not to flatter it: the two
 * largest wins and the case that loses. `axpy 1024` was a 2.01× win on the
 * December Air and is a loss here — it is on the page because it changed sign,
 * not in spite of it.
 */
const CARD_CASES = ['benchDot/256', 'benchTranspose/1024', 'benchAxpy/1024'] as const;

const CARD_NOTES: Record<(typeof CARD_CASES)[number], string> = {
  'benchDot/256':
    'Threading pays once the matrix is large enough to amortize thread startup. This is the headline, and it is the steadiest number in the suite.',
  'benchTranspose/1024':
    'Memory-bound, but the working set is large enough that cache-friendly blocking still outruns the fork-join cost.',
  'benchAxpy/1024':
    'Bandwidth-bound: every lane waits on memory, so more threads add scheduling and no arithmetic. A 2.01× win on the December Air, a loss here — same code, different machine.',
};

export const kernelBenchmarks = CARD_CASES.map((key) => {
  const id = parseCase(key)!;
  const row = caseRow(reference, id);
  return {
    id: key.toLowerCase().replace('bench', '').replace('/', '-'),
    operation: id.family === 'matmul' ? `matmul ${id.size}×${id.size}` : id.label,
    /** The Google Benchmark case name, so the figure is findable in the JSON. */
    caseKey: key,
    baselineLabel: 'single thread',
    optimizedLabel: 'openmp + native',
    baseline: formatNs(row.baselineNs),
    optimized: formatNs(row.ompNs),
    baselineMs: row.baselineNs / 1e6,
    optimizedMs: row.ompNs / 1e6,
    speedupValue: row.speedup,
    wins: row.wins,
    /* A loss is stated as the ratio a reader can act on — 0.92× is arithmetic,
     * "1.08× slower" is the finding. The two parts are separate so the card can
     * set the figure at display size and the qualifier at label size, rather
     * than rendering the word "slower" three centimetres tall. */
    speedup: row.wins
      ? formatSpeedup(row.speedup)
      : formatSlowdown(row.speedup).replace(' slower', ''),
    speedupQualifier: row.wins ? null : 'slower',
    spread: row.cvOmp === null ? null : `±${row.cvOmp.toFixed(1)}% over ${reference.reps} runs`,
    gflops:
      id.family === 'matmul'
        ? `${gflops(id.size, row.baselineNs).toFixed(1)} → ${formatGflops(id.size, row.ompNs)}`
        : null,
    note: CARD_NOTES[key],
  };
});

/*
 * The crossover: below a per-op size threshold, OpenMP actively LOSES. These
 * are the two worst cases in the reference run, picked by ratio rather than by
 * hand, so the page names the losses it would least like to name.
 */
export const crossoverLosses = [...referenceRows]
  .sort((a, b) => a.speedup - b.speedup)
  .slice(0, 2)
  .map((row) => ({
    op: row.label,
    single: formatNs(row.baselineNs),
    omp: formatNs(row.ompNs),
    factor: formatSlowdown(row.speedup).replace('slower', 'worse'),
  }));

/** Verbatim from src/Matrix.cpp — the tuned threshold in the code. */
export const crossoverPragma =
  '#pragma omp parallel for schedule(static) if (rows_ * rhs.cols_ >= 4096)';

/*
 * Whole-network throughput. Images per second is 1e9 ÷ ns/op, the derivation
 * BENCHMARKS.md's throughput table uses. The reference run measured two
 * configs; the December run's third (`native`, no OpenMP) has no counterpart
 * here, so it is not shown rather than quietly carried over from another
 * machine.
 */
export const classifyThroughput = {
  baseline: formatImagesPerSecond(reference.cases.benchClassify.baselineNs),
  openmpNative: formatImagesPerSecond(reference.cases.benchClassify.ompNs),
  /* Stated as a signed word rather than a signed number: "−0.5%" invites a
   * reader to wonder which way it points, and a hyphen-minus in prose reads as
   * a dash. */
  delta: (() => {
    const ratio =
      imagesPerSecond(reference.cases.benchClassify.ompNs) /
      imagesPerSecond(reference.cases.benchClassify.baselineNs);
    const pct = Math.abs(ratio - 1) * 100;
    return `${pct.toFixed(1)}% ${ratio < 1 ? 'slower' : 'faster'}`;
  })(),
  // Bench topology per BENCHMARKS.md — smaller than the shipped model.
  benchTopology: '784 → 30 → 10',
  benchParams: '~24K parameters',
  conclusion: 'Classify is small enough that OpenMP buys nothing',
} as const;

export const benchMethodology = [
  'Google Benchmark',
  '≥0.5s CPU per case',
  `${reference.reps} repetitions · median ns/op`,
  `${reference.configs.length} clean Release configs`,
  `run ${reference.stamp}`,
  `${reference.machine}, load_avg ${reference.loadAvg?.[0] ?? '—'}`,
].join(' · ');

/*
 * Shipped artifact sizes, measured off the committed files in web/public/wasm/
 * by tools/gen_web_facts.py. These were typed by hand until 2026-08-13 and two
 * of the three were wrong: the glue bundle was stated at 43.6 kB against an
 * actual 47.8 kB, and the wasm module at 40.0 kB against an actual 43.8 kB —
 * drift from an earlier build that nobody could have caught by reading, since
 * nothing tied the prose to the file. kB is decimal, matching docs/WASM.md.
 *
 * The float32 weights barely compress. That stays on the page: a 6% saving on
 * the largest download is the honest number, not an embarrassing one.
 */
const artifact = (id: string) => shippedArtifacts.find((a) => a.id === id)!;

export const wasmRuntimeFacts = [
  { label: 'Glue bundle', value: formatKb(artifact('glue').bytes) },
  { label: 'WASM module', value: formatKb(artifact('wasm').bytes) },
  {
    label: 'Weights',
    value: `${formatKb(artifact('weights').bytes)} raw / ${formatKb(artifact('weights').gzipBytes)} gz`,
  },
  { label: 'Warm forward pass', value: '~0.02ms (measured live)' },
  { label: 'Parallelism', value: 'no threads — f64x2 simd128' },
] as const;

export const benchmarkMethodology = [
  'Google Benchmark drives the matrix kernels and full classify workload.',
  `Runs are Release builds across ${reference.configs.join(' and ')} configurations.`,
  `The display source is the reference run — ${reference.machine}, ${formatRunDate(reference.dateISO)}.`,
] as const;

export const reproduceBenchmarkCommand = 'python3 tools/run_benchmarks.py --openmp --native';

/*
 * THE SAME NUMBER, MEASURED THREE TIMES. matmul 256 is the headline, so it is
 * the one figure the repository has measured on two machines at three
 * repetition counts. The values agree to within 2%, which is the actual
 * argument that it is a property of the code rather than of one afternoon.
 */
export const headlineConvergence = [
  { id: 'december', run: december },
  { id: 'reference', run: reference },
  { id: 'dot20x', run: dot20x },
].map(({ id, run }) => {
  const value = speedup(run.cases['benchDot/256']);
  return {
    id,
    run,
    label: `${run.machine.split(' · ')[0]} · ${run.reps} rep${run.reps === 1 ? '' : 's'}`,
    value,
    display: formatSpeedup(value),
  };
});

/*
 * The AVX-512 kernel, verbatim from src/NeuralNet.cpp (dot512_rowvec).
 * The same dual-accumulator shape is ported to NEON and — new — to
 * wasm simd128, which is what executes in this page.
 */
export const kernelSource = `static inline __attribute__((target("avx512f,fma"))) double
dot512_rowvec(const double* __restrict row, const double* __restrict x,
              std::size_t n) {
    std::size_t k = 0, n16 = n & ~std::size_t(15);
    __m512d acc0 = _mm512_setzero_pd(), acc1 = _mm512_setzero_pd();
    for (; k < n16; k += 16) {
        acc0 = _mm512_fmadd_pd(_mm512_load_pd(row + k),
                               _mm512_load_pd(x + k), acc0);
        acc1 = _mm512_fmadd_pd(_mm512_load_pd(row + k + 8),
                               _mm512_load_pd(x + k + 8), acc1);
    }
    __m512d acc = _mm512_add_pd(acc0, acc1);
    /* ... horizontal reduction ... */
    for (; k < n; ++k)
        sum += row[k] * x[k]; // tail
    return sum;
}`;

/*
 * The scalar problem, stated in lanes. A double is 64 bits; the widest
 * vector register on the x86 server (AVX-512) is 512 bits — eight f64
 * lanes. A scalar loop lights exactly one of them per instruction, so on
 * AVX-512 seven of eight lanes sit idle. Widths verified against the
 * kernels in src/NeuralNet.cpp (n16/n8/n4/n2 strides → 8/4/2 f64 lanes).
 */
export const scalarIdle = {
  widestLanes: 8, // AVX-512, 512-bit / 64-bit f64
  usedByScalar: 1,
  headline: '1 of 8',
  caption: 'f64 lanes a scalar loop uses on AVX-512 — seven sit idle',
} as const;

/*
 * The ISA ladder — the SAME dual-accumulator dot product, hand-written for
 * four instruction sets. `lanes` = f64 lanes per vector register; every
 * kernel runs two independent accumulators to keep the FMA chain from
 * serializing. Intrinsics + lane strides are verbatim from
 * src/NeuralNet.cpp (dot512/dot256/dotNeon/dot_wasm128 rowvec kernels).
 */
export const isaLadder = [
  {
    id: 'avx512',
    isa: 'AVX-512',
    width: '512-bit',
    lanes: 8,
    intrinsic: '_mm512_fmadd_pd',
    where: 'server · x86-64',
    note: 'Eight doubles per register, fused multiply-add. The widest rung.',
  },
  {
    id: 'avx2',
    isa: 'AVX2',
    width: '256-bit',
    lanes: 4,
    intrinsic: '_mm256_fmadd_pd',
    where: 'server · x86-64',
    note: 'Four doubles per register, FMA — the ubiquitous x86 fallback.',
  },
  {
    id: 'neon',
    isa: 'NEON',
    width: '128-bit',
    lanes: 2,
    intrinsic: 'vfmaq_f64',
    where: 'server · arm64 (M-series)',
    note: 'Two doubles per register. This is the rung the reference run used.',
  },
  {
    id: 'wasm',
    isa: 'wasm-simd128',
    width: '128-bit',
    lanes: 2,
    intrinsic: 'wasm_f64x2_add',
    where: 'browser · Emscripten',
    note: 'The fourth ISA — carries the same optimization into your tab.',
  },
] as const;

/*
 * FULL CROSSOVER SERIES — every sized matmul / transpose / axpy case in the
 * reference run, expressed as single-thread ÷ openmp+native. A value BELOW 1.0
 * means OpenMP actively LOSES at that size, which is true of eight of the
 * twelve. This is the source for the crossover chart on the landing.
 */
const SERIES_ACCENT: Record<string, string> = {
  matmul: 'sky',
  transpose: 'amber',
  axpy: 'steel',
};

const SERIES_UNIT: Record<string, string> = {
  matmul: 'N',
  transpose: 'rows',
  axpy: 'len',
};

export const crossoverSeries = (['matmul', 'transpose', 'axpy'] as const).map((family) => ({
  id: family,
  label: family === 'matmul' ? 'matmul N×N' : family,
  unit: SERIES_UNIT[family],
  accent: SERIES_ACCENT[family],
  points: referenceRows
    .filter((r) => r.family === family)
    .map((r) => ({
      size: r.size,
      singleNs: r.baselineNs,
      ompNs: r.ompNs,
      speedup: r.speedup,
      cvOmp: r.cvOmp,
    })),
}));

/*
 * GFLOP/s SLOPE for the matmul kernel. A matmul of N×N is 2·N³ FLOPs, so
 * GFLOP/s = 2·N³ / real_time_ns (FLOPs per ns == GFLOP/s). The story:
 * single-thread throughput is flat and cache-bound while openmp+native climbs
 * once the matrix is large enough to amortize thread startup.
 */
const matmulRows = referenceRows.filter((r) => r.family === 'matmul');

export const gflopsSeries = {
  op: 'matmul N×N',
  flops: '2·N³ FLOPs',
  peakValue: Math.max(...matmulRows.map((r) => gflops(r.size, r.ompNs))),
  peak: formatGflops(
    matmulRows[matmulRows.length - 1].size,
    matmulRows[matmulRows.length - 1].ompNs,
  ),
  points: matmulRows.map((r) => ({
    size: r.size,
    single: gflops(r.size, r.baselineNs),
    omp: gflops(r.size, r.ompNs),
  })),
};

/*
 * PER-ISA LANE SCALE — the same dual-accumulator dot product, and how many
 * f64 lanes each target lights per instruction. scalar = 1 (the problem);
 * the four hand-written SIMD rungs carry 2/2/4/8. Widths + lane counts are
 * verified against src/NeuralNet.cpp (see isaLadder). The "×" is literal:
 * lanes = f64 multiply-adds retired per vector instruction. Drives the
 * sequential lane-scale comparison on the landing.
 *
 * Ordered widest-first to match the ISA ladder cards directly above it —
 * the two used to run in opposite directions on the same screen. The
 * scalar rung closes the list: after four working ISAs, "and this is
 * where it started" is the punchline, not the premise.
 */
export const laneScale = [
  {
    id: 'avx512',
    name: 'AVX-512',
    lanes: 8,
    width: '512-bit',
    tone: 'simd',
    where: 'x86-64 server',
  },
  { id: 'avx2', name: 'AVX2', lanes: 4, width: '256-bit', tone: 'simd', where: 'x86-64' },
  { id: 'neon', name: 'NEON', lanes: 2, width: '128-bit', tone: 'simd', where: 'arm64 · this run' },
  {
    id: 'wasm',
    name: 'wasm-simd128',
    lanes: 2,
    width: '128-bit',
    tone: 'live',
    where: 'your browser',
  },
  {
    id: 'scalar',
    name: 'scalar loop',
    lanes: 1,
    width: '64-bit',
    tone: 'idle',
    where: 'the starting point',
  },
] as const;

/*
 * ACCURACY — the 97.01% test result as a count: 9,701 of 10,000 MNIST test
 * digits classified correctly, 299 missed.
 *
 * This used to say the repository "commits no per-class breakdown, so the page
 * invents none". That was wrong on the first half and right on the second.
 * benchmarks/mnist_eval.json commits the complete 10×10 confusion matrix
 * verbatim under `confusion_matrix.rows`, plus per-class precision, recall, F1,
 * tp, fp and fn; benchmarks/mnist_misclassified.csv commits every one of the 299
 * errors with its true label, prediction and both activations.
 *
 * I first claimed to have "reconstructed" the matrix from the per-class counts
 * and the CSV. That reconstruction is real and agrees exactly — row sums equal
 * fn, column sums equal fp, 299 both ways, worst cells 4→9 (16), 2→3 (15),
 * 5→6 (13) — but it is a cross-check, not the source. The matrix was defined in
 * the artifact all along and I found it by deriving it instead of reading it.
 *
 * The page invents nothing, but it is showing far less than it could.
 *
 * The name is historical: the landing card draws the numbers,
 * NOT a waffle grid. The 100-square waffle lives on System Card page 20, where
 * each square is 1% rather than one digit; nothing here has ever drawn ten
 * thousand of anything, and this comment claimed it did until 2026-08-13.
 *
 * NOT "held-out", which this said until 2026-08-13. apps/train_model.cpp
 * assesses the net on this same set every epoch and rewrites the checkpoint
 * only when that score improves, and the repo ships no validation split — so
 * the set that reports the figure also selected the weights. 97.01% is the
 * best epoch, not a clean held-out estimate.
 */
export const accuracyWaffle = {
  total: 10000,
  correct: 9701,
  errors: 299,
  pct: '97.01%',
  note: '9,701 of 10,000 MNIST test digits classified correctly',
} as const;

export const wasmKernelSource = `static inline double
dot_wasm128_rowvec(const double* __restrict row, const double* __restrict x,
                   std::size_t n) {
    std::size_t k = 0, n4 = n & ~std::size_t(3);
    v128_t acc0 = wasm_f64x2_splat(0.0);
    v128_t acc1 = wasm_f64x2_splat(0.0);
    for (; k < n4; k += 4) {
        acc0 = wasm_f64x2_add(acc0,
            wasm_f64x2_mul(wasm_v128_load(row + k),
                           wasm_v128_load(x + k)));
        acc1 = wasm_f64x2_add(acc1,
            wasm_f64x2_mul(wasm_v128_load(row + k + 2),
                           wasm_v128_load(x + k + 2)));
    }
    const v128_t acc = wasm_f64x2_add(acc0, acc1);
    double sum = wasm_f64x2_extract_lane(acc, 0)
               + wasm_f64x2_extract_lane(acc, 1);
    for (; k < n; ++k)
        sum += row[k] * x[k]; // tail
    return sum;
}`;
