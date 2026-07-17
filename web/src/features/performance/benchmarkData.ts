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
