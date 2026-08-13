/*
 * Display data for the landing page. Every number here is copied from
 * the committed benchmark run (BENCHMARKS.md, run 20251226-154121,
 * local Apple M2, clang 17, Release builds via Google Benchmark) or
 * from `ls -l web/public/wasm/` on the shipped artifacts. Nothing on
 * the page may claim a number that is not reproducible from the repo.
 */

export const architectureMetrics = {
  topology: '784 -> 100 -> 10',
  accuracy: '97.01% test accuracy',
  inputPixels: '784 pixels',
  hiddenUnits: '100 hidden units',
  outputs: '10 outputs',
} as const;

/*
 * Kernel cards. IMPORTANT LABELING: the committed "baseline" config is
 * single-threaded WITHOUT -march=native, but the hand-written SIMD
 * kernels (NEON on the M2 that produced this run) are compiled in for
 * ALL THREE configs — so these speedups measure threading + native
 * codegen on top of SIMD, not SIMD vs scalar. The rows are labeled
 * accordingly. The scalar-vs-SIMD comparison is the live one in the
 * workbench (wasm simd128 kernel vs vectorization-disabled scalar).
 */
export const kernelBenchmarks = [
  {
    id: 'matmul-256',
    operation: 'matmul 256×256',
    baselineLabel: 'single thread',
    optimizedLabel: 'openmp + native',
    baseline: '4.835ms',
    optimized: '1.380ms',
    baselineMs: 4.835,
    optimizedMs: 1.38,
    speedup: '3.50x',
    gflops: '6.9 → 24.3 GFLOP/s',
    note: 'OpenMP wins once the matrix is large enough to amortize thread startup.',
  },
  {
    id: 'transpose-1024',
    operation: 'transpose 1024',
    baselineLabel: 'single thread',
    optimizedLabel: 'openmp + native',
    baseline: '978µs',
    optimized: '502µs',
    baselineMs: 0.978,
    optimizedMs: 0.502,
    speedup: '1.95x',
    gflops: null,
    note: 'Memory-bound: cache-friendly blocking amortizes thread overhead at this size.',
  },
  {
    id: 'axpy-1024',
    operation: 'axpy 1024',
    baselineLabel: 'single thread',
    optimizedLabel: 'openmp + native',
    baseline: '231µs',
    optimized: '115µs',
    baselineMs: 0.231,
    optimizedMs: 0.115,
    speedup: '2.01x',
    gflops: null,
    note: 'Vector lanes and larger buffers make the parallel path useful.',
  },
] as const;

/*
 * The crossover: below a per-op size threshold, OpenMP actively LOSES.
 * Committed numbers, single-thread vs openmp+native. This is the
 * threshold-tuning story — the pragma below is the receipt.
 */
export const crossoverLosses = [
  { op: 'transpose 128', single: '5.4µs', omp: '23.7µs', factor: '4.3× worse' },
  { op: 'axpy 256', single: '13.9µs', omp: '26.3µs', factor: '1.9× worse' },
] as const;

/** Verbatim from src/Matrix.cpp — the tuned threshold in the code. */
export const crossoverPragma =
  '#pragma omp parallel for schedule(static) if (rows_ * rhs.cols_ >= 4096)';

export const classifyThroughput = {
  baseline: '81,628 img/s',
  native: '80,712 img/s',
  openmpNative: '69,994 img/s',
  // Bench topology per BENCHMARKS.md — smaller than the shipped model.
  benchTopology: '784 → 30 → 10',
  benchParams: '~24K parameters',
  conclusion: 'Classify is small enough that OpenMP hurts',
} as const;

export const benchMethodology =
  'Google Benchmark · ≥0.5s CPU per case · mean ns/op · 3 clean Release configs · run 20251226-154121 · Apple M2, clang 17';

/*
 * Shipped artifact sizes, measured with ls -l / gzip -c | wc -c on the
 * staged build. The float32 weights barely compress — say so rather
 * than pretend otherwise.
 */
export const wasmRuntimeFacts = [
  { label: 'Glue bundle', value: '43.6KB' },
  { label: 'WASM module', value: '40.0KB' },
  { label: 'Weights', value: '318KB raw / 299KB gz' },
  { label: 'Warm forward pass', value: '~0.02ms (measured live)' },
  { label: 'Parallelism', value: 'no threads — f64x2 simd128' },
] as const;

export const benchmarkMethodology = [
  'Google Benchmark drives the matrix kernels and full classify workload.',
  'Runs are Release builds across baseline, native, and openmp+native configurations.',
  'The committed local M2 run is the display source for this frontend pass.',
] as const;

export const reproduceBenchmarkCommand = 'python3 tools/run_benchmarks.py --openmp --native';

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
    note: 'Two doubles per register. This is the rung the M2 run used.',
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
 * FULL CROSSOVER SERIES — every committed matmul / transpose / axpy size,
 * expressed as single-thread ÷ openmp+native speedup. Values are computed
 * directly from the two committed runs:
 *   docs/benchmarks/runs/bench-20251226-154121-baseline.json      (single thread)
 *   docs/benchmarks/runs/bench-20251226-154121-openmp-native.json (openmp+native)
 * speedup = single_ns / omp_ns. A value BELOW 1.0 means OpenMP actively
 * LOSES at that size — the honest crossover the page keeps on the record.
 * This is the source for the crossover scatter/line on the landing.
 */
export const crossoverSeries = [
  {
    id: 'matmul',
    label: 'matmul N×N',
    unit: 'N',
    accent: 'sky',
    points: [
      { size: 32, singleNs: 6164.7, ompNs: 6286.8, speedup: 0.98 },
      { size: 64, singleNs: 65252.1, ompNs: 89130.1, speedup: 0.73 },
      { size: 128, singleNs: 575280.7, ompNs: 374400.2, speedup: 1.54 },
      { size: 256, singleNs: 4835359.6, ompNs: 1379834.7, speedup: 3.5 },
    ],
  },
  {
    id: 'transpose',
    label: 'transpose',
    unit: 'rows',
    accent: 'amber',
    points: [
      { size: 128, singleNs: 5440.9, ompNs: 23661.8, speedup: 0.23 },
      { size: 256, singleNs: 23097.5, ompNs: 31108.0, speedup: 0.74 },
      { size: 512, singleNs: 198735.4, ompNs: 87913.6, speedup: 2.26 },
      { size: 1024, singleNs: 978383.0, ompNs: 502426.0, speedup: 1.95 },
    ],
  },
  {
    id: 'axpy',
    label: 'axpy',
    unit: 'len',
    accent: 'steel',
    points: [
      { size: 128, singleNs: 3486.0, ompNs: 23916.7, speedup: 0.15 },
      { size: 256, singleNs: 13886.0, ompNs: 26335.3, speedup: 0.53 },
      { size: 512, singleNs: 55847.8, ompNs: 35845.5, speedup: 1.56 },
      { size: 1024, singleNs: 230626.4, ompNs: 114909.6, speedup: 2.01 },
    ],
  },
] as const;

/*
 * GFLOP/s SLOPE for the matmul kernel. A matmul of N×N is 2·N³ FLOPs, so
 * GFLOP/s = 2·N³ / real_time_ns (FLOPs per ns == GFLOP/s). single = baseline
 * run, omp = openmp+native run, both from the committed JSONs above. The
 * story: single-thread throughput is flat/cache-bound (~7–10), while
 * openmp+native climbs to 24.3 GFLOP/s once the matrix is large enough to
 * amortize thread startup. Same run as the 3.50× matmul card.
 */
export const gflopsSeries = {
  op: 'matmul N×N',
  flops: '2·N³ FLOPs',
  peak: '24.3 GFLOP/s',
  points: [
    { size: 32, single: 10.63, omp: 10.42 },
    { size: 64, single: 8.03, omp: 5.88 },
    { size: 128, single: 7.29, omp: 11.2 },
    { size: 256, single: 6.94, omp: 24.32 },
  ],
} as const;

/*
 * PER-ISA LANE SCALE — the same dual-accumulator dot product, and how many
 * f64 lanes each target lights per instruction. scalar = 1 (the problem);
 * the four hand-written SIMD rungs carry 2/2/4/8. Widths + lane counts are
 * verified against src/NeuralNet.cpp (see isaLadder). The "×" is literal:
 * lanes = f64 multiply-adds retired per vector instruction. Drives the
 * sequential lane-scale comparison on the landing.
 */
export const laneScale = [
  {
    id: 'scalar',
    name: 'scalar loop',
    lanes: 1,
    width: '64-bit',
    tone: 'idle',
    where: 'the starting point',
  },
  {
    id: 'wasm',
    name: 'wasm-simd128',
    lanes: 2,
    width: '128-bit',
    tone: 'live',
    where: 'your browser',
  },
  { id: 'neon', name: 'NEON', lanes: 2, width: '128-bit', tone: 'simd', where: 'arm64 · this run' },
  { id: 'avx2', name: 'AVX2', lanes: 4, width: '256-bit', tone: 'simd', where: 'x86-64' },
  {
    id: 'avx512',
    name: 'AVX-512',
    lanes: 8,
    width: '512-bit',
    tone: 'simd',
    where: 'x86-64 server',
  },
] as const;

/*
 * ACCURACY WAFFLE — the 97.01% test result drawn honestly as ten thousand
 * MNIST test digits: 9,701 classified correctly, 299 missed. Not a confusion
 * matrix (the repo commits no per-class breakdown, so the page invents
 * none) — just the one verified figure, made countable.
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
