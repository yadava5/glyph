/**
 * Glyph System Card — copy + verified data (self-contained).
 *
 * Every number here is verified against the Glyph repo and carries a
 * SOURCE note with a file:line rail. Nothing is invented. Two deliberate
 * scoping calls, grounded in the code rather than a single ambiguous
 * "speedup":
 *
 *   · NATIVE speedups (3.54× matmul-256, etc.) are `openmp+native` vs
 *     `single-thread`. The hand-written SIMD is compiled into ALL THREE
 *     configs (NEON on the M1 Pro that produced the reference run), so these
 *     bars measure threading + native codegen ON TOP OF SIMD — not SIMD vs
 *     scalar. (benchmarkData.ts:17-24; LandingPage.tsx:385-387)
 *   · The SIMD-vs-scalar figure is the LIVE one: the wasm-simd128 kernel
 *     raced against the same math with vector lanes off, timed in C++ on the
 *     visitor's own machine. No fixed number is committed — the badge shows
 *     the session p50 (useMnistDemoController.ts:163). The ~1.7× printed here
 *     is labeled a *typical median*, not a benchmark constant.
 *
 * Reference machine for the NATIVE table: Apple M1 Pro, Apple clang 21, run
 * 2026-08-02. The December 2025 M2 (Air) runs are history, not the reference
 * — see docs/benchmarks/ENVIRONMENT.md:112-136. One row flips between the
 * two, and this card prints the reference value: `axpy 1024` was a 2.01× win
 * on the Air and is a 0.92× LOSS on the reference machine.
 *
 * Kernel excerpts are verbatim from src/NeuralNet.cpp (via benchmarkData.ts).
 */

import type { SectionKey } from "./theme";

// ---------------------------------------------------------------------------
// Brand / masthead
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "Glyph",
  subtitle:
    "A course C++ digit classifier, hand-vectorized across four instruction sets — and benchmarked live in your browser.",
  author: "Ayush Yadav",
  contributor: "Shree Chaturvedi",
  year: "2026",
  liveUrl: "getglyph.vercel.app",
  qrTarget: "https://getglyph.vercel.app",
} as const;

export const MASTHEAD = {
  volume: "Vol. 01 · System Card",
  kicker:
    "A scalar MLP, four hand-written SIMD kernels, and a wasm128 port that races scalar on your own silicon.",
  colophonLines: [
    "© 2026 · Ayush Yadav",
    "hand-written SIMD · AVX-512 / AVX2 / NEON / wasm128",
    "in-browser benchmark · C++ → Emscripten → React",
  ],
} as const;

// ---------------------------------------------------------------------------
// Welcome / endpaper — ≤ 80 words.
// ---------------------------------------------------------------------------

export const ABSTRACT = {
  greeting: "Welcome.",
  body:
    "Glyph starts where the coursework ended: a from-scratch C++ MLP that classifies handwritten digits — running scalar, one multiply at a time. The dot-product hot loop is the whole cost, and the compiler declines to vectorize it. So the kernel is hand-written four times — AVX-512, AVX2, NEON, and a wasm128 port that executes in this page. It hits 97.01% on 10,000 test digits, and it benchmarks itself live, on your machine.",
} as const;

// ---------------------------------------------------------------------------
// Chapter TOC
// ---------------------------------------------------------------------------

export const CHAPTERS = [
  { num: "01", name: "WHY", pages: "04 – 07", sectionKey: "01_WHY" as const },
  { num: "02", name: "HOW", pages: "08 – 13", sectionKey: "02_HOW" as const },
  { num: "03", name: "INSIDE", pages: "14 – 17", sectionKey: "03_INSIDE" as const },
  { num: "04", name: "PROOF", pages: "18 – 22", sectionKey: "04_PROOF" as const },
  { num: "05", name: "BUILD", pages: "23 – 27", sectionKey: "05_BUILD" as const },
] as const;

export const TOC = {
  chapterTaglines: {
    WHY: "the compiler leaves the speed on the floor",
    HOW: "one dot product, four instruction sets",
    INSIDE: "the wasm128 kernel · the live bench · the net",
    PROOF: "scoped speedups · 97.01% · 37 + 57 tests",
    BUILD: "C++ → Emscripten → React · the journey",
  } as Record<string, string>,
  chapterGlyphs: {
    WHY: "∿",
    HOW: "⋮⋮",
    INSIDE: "◧",
    PROOF: "✓",
    BUILD: "⛭",
  } as Record<string, string>,
  audience: [
    { key: "Systems folk", val: "read the four kernels + the dispatch on p.09." },
    { key: "ML / research", val: "the net anatomy + the live bench live on 14–17." },
    { key: "Skeptics", val: "every figure is scoped, sourced, and re-runnable." },
  ],
  readingPaths: [
    { key: "Skim · 5 min", val: "the cover, the ISA rail, the speedup receipts." },
    { key: "Deep · 20 min", val: "cover to cover — built for one sitting." },
    { key: "Diagrams only", val: "the ISA lanes (p.09), the net (p.17)." },
  ],
  atAGlance: [
    { key: "4 ISAs", val: "AVX-512 · AVX2 · NEON · wasm-simd128." },
    { key: "97.01%", val: "9,701 / 10,000 MNIST test digits." },
    { key: "live bench", val: "wasm128 vs scalar, timed on your machine." },
  ],
  glossary: [
    { term: "SIMD", def: "one instruction, many lanes of data at once." },
    { term: "gemv", def: "matrix × vector — the forward-pass hot loop." },
    { term: "ISA", def: "instruction set: AVX-512, NEON, wasm128…" },
    { term: "FMA", def: "fused multiply-add — one rounding, two ops." },
    { term: "p50", def: "the median — the defensible middle of a run." },
    { term: "wasm128", def: "WebAssembly's 128-bit SIMD, f64x2 lanes." },
  ],
  colophon: [
    "© 2026 · Ayush Yadav",
    "Glyph · System Card Vol. 01",
    "contributor · Shree Chaturvedi",
  ],
  teaser:
    "A printed walkthrough of a hand-vectorized classifier — the why, the four kernels, and the receipts. Read it with the live bench open.",
} as const;

// ---------------------------------------------------------------------------
// The four ISA kernels — reused across HOW / INSIDE. Widths are doubles per
// SIMD register; the kernels run two independent accumulators, so the inner
// loop retires 2× that per iteration. Source · src/NeuralNet.cpp (guards
// :22-32; kernels 49-73 / 95-123 / 146-164 / 195-215; dispatch :231-242).
// ---------------------------------------------------------------------------

export const ISAS = [
  {
    id: "avx512",
    n: "1",
    label: "AVX-512",
    kernel: "dot512_rowvec",
    guard: "__AVX512F__",
    reg: "__m512d",
    lanes: 8,
    perIter: 16,
    fma: true,
    where: "x86-64 servers / workstations",
    accentKey: "03_INSIDE" as SectionKey,
    note: "Two __m512d accumulators, _mm512_fmadd_pd — 16 doubles retired per iteration, the widest lane in the set.",
  },
  {
    id: "avx2",
    n: "2",
    label: "AVX2",
    kernel: "dot256_rowvec",
    guard: "__AVX2__",
    reg: "__m256d",
    lanes: 4,
    perIter: 8,
    fma: true,
    where: "most x86-64 laptops",
    accentKey: "03_INSIDE" as SectionKey,
    note: "The fallback for chips without AVX-512: 256-bit registers, FMA-fused, four doubles wide.",
  },
  {
    id: "neon",
    n: "3",
    label: "NEON",
    kernel: "dot_neon_rowvec",
    guard: "__ARM_NEON",
    reg: "float64x2_t",
    lanes: 2,
    perIter: 4,
    fma: true,
    where: "Apple silicon / ARM (the M-series)",
    accentKey: "03_INSIDE" as SectionKey,
    note: "The kernel that produced the reference M1 Pro run — 128-bit ARM vectors, two f64 lanes, dual accumulators.",
  },
  {
    id: "wasm128",
    n: "4",
    label: "wasm-simd128",
    kernel: "dot_wasm128_rowvec",
    guard: "__wasm_simd128__",
    reg: "v128_t (f64x2)",
    lanes: 2,
    perIter: 4,
    fma: false,
    where: "the browser — this page",
    accentKey: "03_INSIDE" as SectionKey,
    note: "The fourth ISA, hand-written for WebAssembly: wasm_f64x2_mul/add on two accumulators. This is what executes when you run the bench.",
  },
] as const;

export const ISA_META = {
  count: 4,
  dispatch:
    "Compile-time dispatch: the widest supported kernel is selected by preprocessor guard; a plain-C++ path is the fallback.",
  source: "source · src/NeuralNet.cpp:22-32 (guards) · :231-242 (dispatch)",
} as const;

// ---------------------------------------------------------------------------
// Section 01 — WHY
// ---------------------------------------------------------------------------

export const WHY = {
  divider: { subtitle: "the compiler leaves the speed on the floor" },

  scalar: {
    eyebrow: "§01 · THE STARTER",
    headline: "The classifier arrived as coursework.",
    pullQuote:
      "A from-scratch C++ MLP we did not write — correct, framework-free, and running one multiply at a time.",
    body: [
      "Glyph did not begin as a performance project. It began as a course assignment: a C++ multilayer perceptron that learns to read handwritten digits by backpropagation.",
      "The forward pass is a stack of matrix-times-vector products. In the starter, each output is a plain loop that multiplies one weight by one activation, adds, and moves on — one lane of the CPU doing arithmetic while the rest sit idle.",
    ],
    coda:
      "Correctness first. But the machine underneath is built to do eight of these at once — and the starter never asks it to.",
    signals: [
      { label: "COURSEWORK", hue: "steel", quote: "“a C++ MLP we did not write”" },
      { label: "SCALAR", hue: "steel", quote: "one multiply, one add, repeat" },
      { label: "CORRECT", hue: "green", quote: "97.01% before a single kernel" },
      { label: "IDLE LANES", hue: "amber", quote: "7 of 8 doing nothing" },
    ],
  },

  floor: {
    eyebrow: "§01 · THE FLOOR",
    headline: "The compiler won't vectorize it.",
    lede:
      "You might hope `-O3` fixes this for free. For this loop, it does not: the auto-vectorizer declines exactly the shape that would make it fast.",
    beforeTitle: "WHAT THE STARTER DOES",
    withTitle: "WHAT THE SILICON CAN DO",
    before: [
      "One f64 multiply, then one add — a single scalar lane busy.",
      "A dependency chain: each add waits on the last, no overlap.",
      "The auto-vectorizer sees the chain and declines the loop.",
      "Wider registers exist on the chip but go unused.",
      "The hot dot-product loop runs at a fraction of peak.",
    ],
    with: [
      "Eight f64 multiplies in one AVX-512 instruction.",
      "Two independent accumulators, so the adds overlap.",
      "A hand-written kernel — the shape LLVM won't emit itself.",
      "The full vector width, put to work every iteration.",
      "The same math, the same result, a lane-parallel loop.",
    ],
    gate: "The speed was never missing. It was left on the floor, one idle lane at a time.",
  },

  hotloop: {
    eyebrow: "§01 · THE REFRAME",
    headline: "The whole cost is one dot product.",
    body: [
      "Reframe the program. A digit classifier sounds like a lot of code, but almost all of the wall-clock time lives in one place: the dot product inside the matrix-vector multiply that drives each layer. Speed that loop and you speed the network.",
      "So the task is narrow and concrete. Not “optimize the MLP” — hand-write the inner `row · x` reduction so it uses the CPU's vector lanes, on every instruction set the model might run on. Everything else in the program can stay exactly as the course wrote it.",
    ],
    thesis:
      "If you make the dot product lane-parallel, you make the whole network fast — and you change nothing else.",
    reframe: [
      { from: "“optimize the network”", to: "vectorize one hot loop" },
      { from: "“trust the compiler”", to: "hand-write the kernel" },
      { from: "“pick one target”", to: "one loop, four ISAs" },
    ],
    handoff: "So: how do you hand-vectorize one loop four times? Turn the page.",
  },
} as const;

// ---------------------------------------------------------------------------
// Section 02 — HOW
// ---------------------------------------------------------------------------

export const HOW = {
  divider: { subtitle: "one dot product · four instruction sets" },

  dispatch: {
    eyebrow: "§02 · THE DISPATCH",
    headline: "Four instruction sets, one loop.",
    lede:
      "The same `row · x` reduction is written four times — once per SIMD instruction set the model might meet — plus a scalar fallback. The build picks the widest one the target supports, at compile time.",
    body:
      "There is no runtime branch in the hot loop: preprocessor guards select the kernel when the code is compiled, so the dispatch costs nothing. A server gets AVX-512; a typical laptop gets AVX2; an Apple machine gets NEON; the browser gets the hand-written wasm128 port. If none is present, plain C++ still runs.",
    steps: [
      { n: "1", label: "AVX-512", detail: "__m512d · 8-wide", accept: "x86 servers", accentKey: "03_INSIDE" },
      { n: "2", label: "AVX2", detail: "__m256d · 4-wide", accept: "x86 laptops", accentKey: "03_INSIDE" },
      { n: "3", label: "NEON", detail: "float64x2 · 2-wide", accept: "Apple / ARM", accentKey: "03_INSIDE" },
      { n: "4", label: "wasm128", detail: "v128 f64x2 · 2-wide", accept: "the browser", accentKey: "03_INSIDE" },
    ],
    source: "source · src/NeuralNet.cpp:22-32 (guards) · :231-242 (kernel dispatch)",
  },

  // Per-ISA detail pages pull from ISAS above.
  avx: {
    eyebrow: "§02 · x86 · WIDE LANES",
    headline: "AVX-512 and AVX2.",
    body: [
      "On x86-64 the widest kernel is `dot512_rowvec`: two `__m512d` accumulators, each holding eight doubles, folded with fused multiply-add (`_mm512_fmadd_pd`). Sixteen doubles are multiplied and accumulated per loop iteration, then reduced once at the end.",
      "Not every x86 chip has AVX-512, so `dot256_rowvec` is the fallback: the identical shape on 256-bit `__m256d` registers, four doubles wide, still FMA-fused. Both keep two accumulators so the add chains overlap instead of stalling.",
    ],
    stat: { value: "16", label: "AVX-512 · doubles / iteration" },
    stat2: { value: "2×", label: "accumulators · adds overlap" },
    note: "FMA folds a multiply and an add into one instruction with a single rounding — twice the arithmetic, once the latency.",
  },
  neon: {
    eyebrow: "§02 · ARM · THE M-SERIES",
    headline: "NEON — the kernel behind the run.",
    body: [
      "On Apple silicon and other ARM chips the kernel is `dot_neon_rowvec`: 128-bit `float64x2_t` vectors, two doubles per lane, two accumulators, FMA where the chip supports it. It is the exact kernel that produced this card's reference benchmark run, on an Apple M1 Pro.",
      "NEON is only two doubles wide — narrower than AVX — but the same dual-accumulator shape keeps the pipeline full, and on the M1 Pro it feeds a memory system fast enough that the vectorized loop is no longer the bottleneck.",
    ],
    stat: { value: "float64x2", label: "128-bit ARM vector · 2 lanes" },
    stat2: { value: "M1 Pro", label: "the reference run's silicon" },
    note: "Narrow lanes, full pipeline: the win is not just width — it is two independent accumulators hiding add latency.",
  },
  wasm: {
    eyebrow: "§02 · THE 4TH ISA",
    headline: "wasm128 — hand-written for the web.",
    body: [
      "WebAssembly has its own 128-bit SIMD, and it is the fourth target. `dot_wasm128_rowvec` carries the same design across: two `v128_t` accumulators, `wasm_f64x2_mul` and `wasm_f64x2_add`, four doubles retired per iteration, a two-lane horizontal reduction, and a scalar tail.",
      "This is the kernel that runs when you open the demo — the model is compiled to WebAssembly with `-msimd128`, and this hand-written loop is what the browser executes. It is exactly the shape the auto-vectorizer declined to emit, written out by hand for the one runtime the whole world can reach.",
    ],
    stat: { value: "f64x2", label: "wasm SIMD · 2 lanes · dual acc" },
    stat2: { value: "-msimd128", label: "the Emscripten flag that arms it" },
    note: "The same dual-accumulator shape, ported to WebAssembly — new in v1.0, and the one that runs in front of you.",
  },

  threads: {
    eyebrow: "§02 · THE SECOND AXIS",
    headline: "OpenMP — a scale story, honestly told.",
    lede:
      "SIMD is one axis of speed; threads are another. OpenMP parallelizes the large matrix kernels — but it is not a free win, and the code says so.",
    body:
      "On big compute-bound operations, spreading work across cores helps: `matmul 256×256` runs 3.54× faster with `openmp+native` than single-thread, and `transpose 1024` 3.92× faster. On small ones it hurts badly — thread startup costs more than the work saved, so `transpose 128` gets 7.9× worse. And on `axpy` it never helps at all, at any size measured.",
    bands: [
      { range: "big matmul", verb: "PARALLELIZE", tone: "green", detail: "matmul 256×256 → 3.54×; transpose 1024 → 3.92×." },
      { range: "axpy · any size", verb: "STAY SERIAL", tone: "amber", detail: "0.09× / 0.30× / 0.88× / 0.92× — never crosses 1.0." },
      { range: "tiny net", verb: "SKIP THREADS", tone: "steel", detail: "classify: baseline still edges omp+native." },
    ],
    loopNote:
      "The size gate is real — `if (rows_ * cols_ >= 4096)` — but it is a heuristic, not a proof. Every benched `axpy` is already past it, and every one still loses.",
    source: "source · src/Matrix.cpp:381 (matmul gate) · :491 (axpy gate) · docs/benchmarks/runs/bench-20260802-aggregated-*",
  },
} as const;

// ---------------------------------------------------------------------------
// Section 03 — INSIDE
// ---------------------------------------------------------------------------

export const INSIDE = {
  divider: { subtitle: "the wasm128 kernel · the live bench · the network" },

  wasm: {
    eyebrow: "§03 · THE KERNEL IN THE PAGE",
    headline: "The loop the browser runs.",
    body:
      "The model ships to the web as WebAssembly, compiled from the same C++ with Emscripten and `-msimd128`. Inside, `dot_wasm128_rowvec` is the hot loop: two f64x2 accumulators, `wasm_f64x2_mul` then `wasm_f64x2_add`, four doubles per iteration, extract-and-sum reduction, scalar tail for the remainder. No threads — pure f64x2 SIMD.",
    codeCaption: "src/NeuralNet.cpp · dot_wasm128_rowvec (verbatim)",
    facts: [
      { k: "MODULE", v: "46.5 KB wasm · 44.9 KB JS glue" },
      { k: "WEIGHTS", v: "318 KB raw · 299 KB gzipped" },
      { k: "PARALLELISM", v: "none — f64x2 simd128, single thread" },
      { k: "WARM PASS", v: "~0.02 ms · measured live" },
    ],
    source: "source · benchmarkData.ts:100-159 · src/NeuralNet.cpp:195-215 · web/public/wasm/ (measured)",
  },

  bench: {
    eyebrow: "§03 · THE LIVE BENCHMARK",
    headline: "It benchmarks itself, on your machine.",
    lede:
      "The page's thesis is rendered as an instrument, not a claim. When you open the demo it times two kernels on your own silicon and shows you the ratio.",
    body:
      "One path is `novec_gemv_sigmoid` — the same math with `#pragma clang loop vectorize(disable)`, the vector lanes deliberately switched off. The other is the hand-written `dot_wasm128_rowvec`. Both are timed in C++ over many iterations, forward pass only, and the badge reports the session median — `scalar → simd  r×  p50 · n`.",
    readout: {
      scalarLabel: "scalar · lanes off",
      simdLabel: "simd128 · hand-written",
      ratio: "~1.7×",
      ratioNote: "typical median — your run may differ",
    },
    honest:
      "No in-browser number is committed to the repo — the figure is computed live, per visitor. The ~1.7× above is a representative median.",
    source: "source · wasm/wasm_bindings.cpp:96-109 (novec scalar) · useMnistDemoController.ts:163 (p50)",
  },

  anatomy: {
    eyebrow: "§03 · THE NETWORK",
    headline: "784 → 100 → 10.",
    body: [
      "The network the kernel serves is deliberately plain: 784 inputs (a 28×28 digit, flattened), one hidden layer of 100 units, and 10 outputs — one per digit. Both layers apply a sigmoid; the prediction is the arg-max over the output activations.",
      "That is 79,510 parameters in all, trained by the course's own from-scratch backpropagation with Xavier initialization and plain SGD. Small enough to ship as a single weights file and run a full forward pass in hundredths of a millisecond.",
    ],
    layers: [
      { name: "input", units: "784", detail: "28×28 pixels, flattened" },
      { name: "hidden", units: "100", detail: "sigmoid activation" },
      { name: "output", units: "10", detail: "sigmoid · arg-max → digit" },
    ],
    stat: { value: "79,510", label: "parameters · trained by backprop" },
    stat2: { value: "sigmoid", label: "both layers · Xavier init · SGD" },
    source: "source · benchmarkData.ts:9-15 · Workbench.tsx:238-239 · src/NeuralNet.cpp:224-246 (gemv)",
  },
} as const;

// ---------------------------------------------------------------------------
// Section 04 — PROOF
// ---------------------------------------------------------------------------

export const PROOF = {
  divider: { subtitle: "scoped speedups · 97.01% · 37 + 57 tests" },

  speedups: {
    eyebrow: "§04 · THE RECEIPTS",
    headline: "Two speedups, each scoped.",
    lede:
      "There is no single headline “speedup” here — that would be dishonest, because two different things are being measured. Both are labeled to exactly what they compare.",
    native: {
      value: "3.54×",
      scope: "openmp+native vs single-thread",
      workload: "matmul 256×256 · Apple M1 Pro · clang 21",
      detail: "4.819 ms → 1.363 ms · 7.0 → 24.6 GFLOP/s",
      caveat:
        "SIMD is compiled into all three configs — so this measures threading + native codegen on top of SIMD, not SIMD vs scalar.",
    },
    browser: {
      value: "~1.7×",
      scope: "wasm-simd128 vs scalar (vector lanes off)",
      workload: "forward pass · the visitor's own machine",
      detail: "session p50 median · computed live, not committed",
      caveat:
        "This is the true SIMD-vs-scalar comparison — but it runs live, so ~1.7× is a typical median, not a fixed benchmark number.",
    },
    crossover:
      "And the honest counter-example: threading is not free. On small ops OpenMP loses badly (transpose 128 → 7.9× worse), `axpy` loses at every size measured — including the 2.01× “win” the December machine reported — and on the tiny classify net the plain baseline still edges openmp+native.",
    source:
      "source · runs/bench-20260802-dot20x-* (3.54×, 20 reps) · benchmarkData.ts:36 · useMnistDemoController.ts:163 (live p50)",
  },

  accuracy: {
    eyebrow: "§04 · THE NUMBER",
    headline: "97.01% on 10,000 digits.",
    hero: "97.01%",
    heroLabel: "test accuracy · 10,000 MNIST test digits",
    body:
      "The optimization changes how fast the network runs, never what it answers — the vectorized kernels return the same doubles the scalar loop would. On the standard 10,000-image MNIST test set the model classifies 9,701 correctly: 97.01%. Training kept the best-scoring epoch on that same set and the repo ships no validation split, so read this as the best epoch rather than a clean held-out estimate.",
    exact: "9,701 / 10,000 = 97.01%",
    receiptLabel: "THE RECEIPT",
    receipt: "$ ./test_model model.weights data 10000\n  # 9701 / 10000 = 97.01%",
    note: "Same weights, same answers — SIMD is a speed change, not a math change.",
    source: "source · benchmarkData.ts:11 · LandingPage.tsx:566-567 · TestingSetList.txt (10000 lines) · model.weights (784 100 10)",
  },

  table: {
    eyebrow: "§04 · THE FULL PICTURE",
    headline: "The whole benchmark, wins and losses.",
    lede:
      "The reference run, in full — including the row that flipped. `axpy 1024` was a 2.01× win on the December M2 Air; on the M1 Pro reference it is a 0.92× loss. It is printed below where it now belongs, not where it flattered.",
    wins: [
      { op: "matmul 256×256", base: "4.819 ms", opt: "1.363 ms", factor: "3.54×", win: true },
      { op: "transpose 1024", base: "876 µs", opt: "224 µs", factor: "3.92×", win: true },
    ],
    losses: [
      { op: "axpy 1024", base: "273 µs", opt: "296 µs", factor: "1.08× worse", win: false },
      { op: "axpy 256", base: "14.9 µs", opt: "49.4 µs", factor: "3.3× worse", win: false },
      { op: "transpose 128", base: "5.7 µs", opt: "45.0 µs", factor: "7.9× worse", win: false },
    ],
    classify:
      "classify throughput: baseline 70,295 img/s still edges openmp+native 69,957 — but by 0.5%, not December's 17%. The net is simply too small for threading to pay either way. (bench topology 784→30→10, ~24K params — smaller than the shipped model.)",
    method:
      "Google Benchmark · ≥0.5 s CPU per case · median ns/op · 10 reps (20 for matmul 256) · run 2026-08-02 · Apple M1 Pro, Apple clang 21.",
    reproduce: "python3 tools/run_benchmarks.py --openmp --native",
    source: "source · benchmarkData.ts:26-93 · docs/benchmarks/runs/bench-20260802-* · ENVIRONMENT.md · BENCHMARKS.md",
  },

  tests: {
    eyebrow: "§04 · THE GUARANTEE",
    headline: "37 C++ tests and 57 in the browser.",
    body:
      "Correctness is enforced, not asserted. The C++ core ships 37 Catch2 test cases — matrix algebra, the network, property-based checks with RapidCheck, and the server API. A clean `ctest` run reports `100% tests passed, 0 tests failed out of 37`. The web app adds 57 passing Playwright end-to-end tests that drive the real demo in a headless browser.",
    stats: [
      { value: "37", label: "C++ tests · Catch2 + RapidCheck", note: "tests/*.cpp · ctest: 37/37" },
      { value: "57", label: "e2e · Playwright · passing", note: "15 tests × 4 projects − 3 skips" },
      { value: "4", label: "ISAs · one shared kernel shape", note: "NeuralNet.cpp" },
    ],
    breakdown: [
      { k: "test_matrix", v: "18 cases · algebra + SIMD parity" },
      { k: "test_neural_net", v: "11 cases · forward pass + train" },
      { k: "test_matrix_properties", v: "5 cases · RapidCheck properties" },
      { k: "test_server_api", v: "3 cases · the inference endpoint" },
    ],
    honest:
      "The 57 is reconciled: 15 e2e tests — 8 in demo.spec.ts, 7 in smoke.spec.ts — across 4 Playwright projects is 60, minus the 3 runs of the reduced-motion visual test that skip outside their own project. 57 pass, 0 fail. An earlier printing said 29, which counted demo.spec.ts alone and silently dropped the smoke suite.",
    handoffQuote:
      "A kernel that changes the speed and not the answer is the only kind worth shipping.",
    source: "source · tests/*.cpp (37 TEST_CASE) · web/playwright.config.ts (4 projects) · web/tests/e2e/{demo,smoke}.spec.ts",
  },
} as const;

// ---------------------------------------------------------------------------
// Section 05 — BUILD
// ---------------------------------------------------------------------------

export const BUILD = {
  divider: { subtitle: "C++ → Emscripten → React · the optimization journey" },

  pipeline: {
    eyebrowLeft: "§05 · THE JOURNEY · LEFT",
    eyebrowRight: "§05 · THE JOURNEY · RIGHT",
    headlineLeft: "From a scalar starter…",
    headlineRight: "…to a kernel in your browser.",
    subLeft:
      "The course MLP runs scalar. Hand-written SIMD vectorizes the dot loop; OpenMP adds a second axis on the large matrix kernels — gated behind a size threshold.",
    subRight:
      "Emscripten compiles the same C++ to WebAssembly with the hand-written wasm128 kernel; the React app loads it and races it against scalar, live, on the client.",
    stages: [
      { n: "1", label: "SCALAR", detail: "the course C++ MLP", accentKey: "01_WHY" },
      { n: "2", label: "SIMD", detail: "AVX-512 / AVX2 / NEON", accentKey: "02_HOW" },
      { n: "3", label: "WASM", detail: "Emscripten · -msimd128", accentKey: "03_INSIDE" },
      { n: "4", label: "BENCH", detail: "live · vs scalar", accentKey: "04_PROOF" },
      { n: "5", label: "WEB", detail: "React 19 · Vercel", accentKey: "05_BUILD" },
    ],
    registry:
      "The wasm module is committed to the repo (web/public/wasm) so Vercel ships the real simd128 artifact — never the JS fallback.",
    source: "source · CMakeLists.txt:332 (-msimd128) · tools/build_wasm.sh · CHANGELOG.md",
  },

  stack: {
    eyebrow: "§05 · THE STACK",
    headline: "What it is built on.",
    lede:
      "A C++17 core where the kernels live; Emscripten to reach the browser; React to render the instrument. Three toolchains, one dot product.",
    rows: [
      { area: "CORE", tech: "C++17 · CMake ≥ 3.20", note: "Matrix + NeuralNet + the 4 kernels" },
      { area: "SIMD", tech: "AVX-512 / AVX2 / NEON / wasm128", note: "hand-written intrinsics, compile-time dispatch" },
      { area: "THREADS", tech: "OpenMP · size-gated", note: "second axis on large matrix ops" },
      { area: "WASM", tech: "Emscripten 3.1.64 · -msimd128", note: "same C++ → WebAssembly SIMD" },
      { area: "WEB", tech: "React 19 · rolldown-vite 7 · Vercel", note: "the live in-browser benchmark" },
      { area: "TESTS", tech: "Catch2 · RapidCheck · Playwright", note: "37 C++ · 57 e2e · Google Benchmark" },
    ],
    source: "source · CMakeLists.txt:1,48 · docs/WASM.md:30 · web/package.json:31,56",
  },

  closing: {
    liveUrl: "getglyph.vercel.app",
    spaceUrl: "dot_wasm128_rowvec · f64x2",
  },
} as const;

// ---------------------------------------------------------------------------
// Try-It page (page 27, recto) — where the reader is sent to the product: the
// QR on its paper card, the live URL, and what the bench does. Folds in the
// former "Run the bench" build-closing so the last leaf can be a pure closing.
// ---------------------------------------------------------------------------

export const TRY_IT = {
  eyebrow: "TRY IT · THE LIVE APP",
  headline: "Run the bench.",
  tagline:
    "Race the hand-written wasm128 kernel against scalar, live, on your own machine — the whole card, made executable.",
  qrTarget: "https://getglyph.vercel.app",
  qrCaption: "scan to open the live app",
  liveUrl: "getglyph.vercel.app",
  hotLoop: "dot_wasm128_rowvec · f64x2",
  steps: [
    { n: "1", k: "open the demo", v: "the wasm128 model loads and warms in-page." },
    { n: "2", k: "it times two kernels", v: "hand-written simd128 vs the same math, lanes off." },
    { n: "3", k: "read the p50", v: "the badge reports your session median — live, per visitor." },
  ],
  readout: {
    scalarLabel: "scalar · lanes off",
    simdLabel: "simd128 · hand-written",
    ratio: "~1.7×",
    tail: "p50 · n",
  },
  isaEcho: [
    { label: "AVX-512", detail: "x86 · 8-wide" },
    { label: "AVX2", detail: "x86 · 4-wide" },
    { label: "NEON", detail: "ARM · 2-wide" },
    { label: "wasm128", detail: "browser · runs here" },
  ],
  alsoLabel: "also waiting in the app",
  alsoCards: [
    { k: "the four kernels", v: "AVX-512 · AVX2 · NEON · wasm128, side by side" },
    { k: "the 97.01% receipt", v: "9,701 / 10,000 MNIST test digits" },
    { k: "the full table", v: "every op — wins and losses — re-runnable" },
  ],
  microNote: "one dot product · four ISAs · timed on your silicon",
} as const;

// ---------------------------------------------------------------------------
// Back cover (page 28) — a PURE closing that mirrors the front cover: the same
// full-bleed digit-lanes field (reseeded to a "7" as a wraparound), a quiet
// closing line, and the colophon. No QR, no CTA — the reader was already sent
// to the product on page 27. A clean bookend to the opening.
// ---------------------------------------------------------------------------

export const BACK_COVER = {
  masthead: "Glyph · System Card",
  volume: "Vol. 01",
  wordmark: "Glyph",
  // Two-tone wordmark split — the back cover tints the "ph" in sky. Kept in
  // content (not hardcoded in the template) so a rename can never strand an
  // old brand string in the TSX.
  wordmarkHead: "Gly",
  wordmarkTail: "ph",
  closingLine: "The speed was always in the silicon.",
  signature: "Ayush Yadav · 2026 · with Shree Chaturvedi",
  edgeNote: "one dot product · four ISAs",
  colophon: ["hand-written SIMD · AVX-512 / AVX2 / NEON / wasm128", "C++ → Emscripten → React · benchmarked live"],
} as const;
