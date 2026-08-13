/*
 * GENERATED FILE — do not edit by hand.
 *
 * Written by `tools/gen_web_facts.py` from the Google Benchmark JSON in
 * `docs/benchmarks/runs/` and the shipped WebAssembly artifacts in
 * `web/public/wasm/`. Every benchmark number below is a `real_time` median
 * read straight out of one of those files, every artifact size is `len()` of
 * the file on disk, and every figure the page displays is derived from these
 * by `benchDerive.ts` — so a displayed number cannot drift from the artifact
 * it claims to come from.
 *
 * Regenerate:  python3 tools/gen_web_facts.py
 * CI gate:     python3 tools/gen_web_facts.py --check
 *
 * `ns` values are wall-clock nanoseconds per iteration. `cv*` values are the
 * coefficient of variation as a percentage, reported by Google Benchmark for
 * repeated runs; a single-repetition record has no spread and reports null.
 */

export interface BenchCase {
  /** Wall-clock ns/op, no `-march=native`, no OpenMP. */
  baselineNs: number;
  /** `-march=native`, no OpenMP. Only the December run measured this config. */
  nativeNs: number | null;
  /** `-march=native` + OpenMP. */
  ompNs: number;
  /** Coefficient of variation, %, baseline config. */
  cvBaseline?: number;
  /** Coefficient of variation, %, openmp+native config. */
  cvOmp?: number;
}

export interface BenchRun {
  id: string;
  /** Run stamp — the filename infix under docs/benchmarks/runs/. */
  stamp: string;
  dateISO: string;
  /** From ENVIRONMENT.md; the JSON records cores and caches but not the model. */
  machine: string;
  cores: number;
  /** Google Benchmark repetitions per case. */
  reps: number;
  /** 1/5/15-minute load average at the start of the run, if recorded. */
  loadAvg: number[] | null;
  l1dBytes: number | null;
  l2Bytes: number | null;
  benchmarkVersion: string | null;
  configs: string[];
  /** Repo-relative paths a reader can open to check any number here. */
  artifacts: string[];
  cases: Record<string, BenchCase>;
}

export const referenceRun: BenchRun = {
  id: "reference",
  stamp: "20260802-aggregated",
  dateISO: "2026-08-02T21:01:44-04:00",
  machine: "Apple M1 Pro \u00b7 MacBook Pro 16\u2033",
  cores: 10,
  reps: 10,
  loadAvg: [9.8, 7.6, 5.15],
  l1dBytes: 65536,
  l2Bytes: 4194304,
  benchmarkVersion: "v1.9.1",
  configs: [
    "baseline",
    "openmp-native"
  ],
  artifacts: [
    "docs/benchmarks/runs/bench-20260802-aggregated-baseline.json",
    "docs/benchmarks/runs/bench-20260802-aggregated-openmp-native.json"
  ],
  cases: {
    "benchAxpy/1024": {
      baselineNs: 273175.1,
      nativeNs: null,
      ompNs: 296140.3,
      cvBaseline: 3.9,
      cvOmp: 0.58
    },
    "benchAxpy/128": {
      baselineNs: 3762.8,
      nativeNs: null,
      ompNs: 40364.3,
      cvBaseline: 1.54,
      cvOmp: 0.79
    },
    "benchAxpy/256": {
      baselineNs: 14920.2,
      nativeNs: null,
      ompNs: 49397.6,
      cvBaseline: 4.27,
      cvOmp: 0.95
    },
    "benchAxpy/512": {
      baselineNs: 60556.6,
      nativeNs: null,
      ompNs: 68558.3,
      cvBaseline: 2.54,
      cvOmp: 0.38
    },
    benchClassify: {
      baselineNs: 14226.1,
      nativeNs: null,
      ompNs: 14299.5,
      cvBaseline: 1.64,
      cvOmp: 1.63
    },
    "benchDot/128": {
      baselineNs: 610624.3,
      nativeNs: null,
      ompNs: 406369.6,
      cvBaseline: 0.19,
      cvOmp: 2.58
    },
    "benchDot/256": {
      baselineNs: 4897084.2,
      nativeNs: null,
      ompNs: 1371684.1,
      cvBaseline: 0.35,
      cvOmp: 1.55
    },
    "benchDot/32": {
      baselineNs: 6400.2,
      nativeNs: null,
      ompNs: 6489.9,
      cvBaseline: 0.89,
      cvOmp: 1.55
    },
    "benchDot/64": {
      baselineNs: 56801.9,
      nativeNs: null,
      ompNs: 120384.6,
      cvBaseline: 0.29,
      cvOmp: 0.66
    },
    benchLearn: {
      baselineNs: 22756.1,
      nativeNs: null,
      ompNs: 22770.7,
      cvBaseline: 1.06,
      cvOmp: 1.27
    },
    "benchTranspose/1024": {
      baselineNs: 876146.8,
      nativeNs: null,
      ompNs: 223513.2,
      cvBaseline: 4.0,
      cvOmp: 0.49
    },
    "benchTranspose/128": {
      baselineNs: 5720.2,
      nativeNs: null,
      ompNs: 44967.6,
      cvBaseline: 0.31,
      cvOmp: 1.41
    },
    "benchTranspose/256": {
      baselineNs: 23614.5,
      nativeNs: null,
      ompNs: 56503.5,
      cvBaseline: 0.19,
      cvOmp: 0.23
    },
    "benchTranspose/512": {
      baselineNs: 112172.7,
      nativeNs: null,
      ompNs: 79477.4,
      cvBaseline: 0.71,
      cvOmp: 0.66
    }
  }
};

export const dot20xRun: BenchRun = {
  id: "dot20x",
  stamp: "20260802-dot20x",
  dateISO: "2026-08-02T21:28:35-04:00",
  machine: "Apple M1 Pro \u00b7 MacBook Pro 16\u2033",
  cores: 10,
  reps: 20,
  loadAvg: [4.7, 5.03, 4.48],
  l1dBytes: 65536,
  l2Bytes: 4194304,
  benchmarkVersion: "v1.9.1",
  configs: [
    "baseline",
    "openmp-native"
  ],
  artifacts: [
    "docs/benchmarks/runs/bench-20260802-dot20x-baseline.json",
    "docs/benchmarks/runs/bench-20260802-dot20x-openmp-native.json"
  ],
  cases: {
    "benchDot/128": {
      baselineNs: 602286.0,
      nativeNs: null,
      ompNs: 395094.4,
      cvBaseline: 0.22,
      cvOmp: 0.13
    },
    "benchDot/256": {
      baselineNs: 4818901.4,
      nativeNs: null,
      ompNs: 1362717.1,
      cvBaseline: 0.16,
      cvOmp: 0.28
    },
    "benchDot/32": {
      baselineNs: 6415.9,
      nativeNs: null,
      ompNs: 6412.4,
      cvBaseline: 0.13,
      cvOmp: 0.4
    },
    "benchDot/64": {
      baselineNs: 56740.9,
      nativeNs: null,
      ompNs: 117711.7,
      cvBaseline: 0.89,
      cvOmp: 0.23
    }
  }
};

export const decemberRun: BenchRun = {
  id: "december",
  stamp: "20251226-154121",
  dateISO: "2025-12-26T15:41:22-05:00",
  machine: "Apple M2 \u00b7 MacBook Air (fanless)",
  cores: 8,
  reps: 1,
  loadAvg: [3.64, 3.88, 3.18],
  l1dBytes: 65536,
  l2Bytes: 4194304,
  benchmarkVersion: "v1.9.1",
  configs: [
    "baseline",
    "native",
    "openmp-native"
  ],
  artifacts: [
    "docs/benchmarks/runs/bench-20251226-154121-baseline.json",
    "docs/benchmarks/runs/bench-20251226-154121-native.json",
    "docs/benchmarks/runs/bench-20251226-154121-openmp-native.json"
  ],
  cases: {
    "benchAxpy/1024": {
      baselineNs: 230626.4,
      nativeNs: 229230.0,
      ompNs: 114909.6
    },
    "benchAxpy/128": {
      baselineNs: 3486.0,
      nativeNs: 3477.2,
      ompNs: 23916.7
    },
    "benchAxpy/256": {
      baselineNs: 13886.0,
      nativeNs: 13896.1,
      ompNs: 26335.3
    },
    "benchAxpy/512": {
      baselineNs: 55847.8,
      nativeNs: 55441.4,
      ompNs: 35845.5
    },
    benchClassify: {
      baselineNs: 12250.8,
      nativeNs: 12389.7,
      ompNs: 14287.0
    },
    "benchDot/128": {
      baselineNs: 575280.7,
      nativeNs: 587767.2,
      ompNs: 374400.2
    },
    "benchDot/256": {
      baselineNs: 4835359.6,
      nativeNs: 4759131.8,
      ompNs: 1379834.7
    },
    "benchDot/32": {
      baselineNs: 6164.7,
      nativeNs: 6229.3,
      ompNs: 6286.8
    },
    "benchDot/64": {
      baselineNs: 65252.1,
      nativeNs: 57221.6,
      ompNs: 89130.1
    },
    benchLearn: {
      baselineNs: 20510.5,
      nativeNs: 20243.2,
      ompNs: 20560.9
    },
    "benchTranspose/1024": {
      baselineNs: 978383.0,
      nativeNs: 861078.1,
      ompNs: 502426.0
    },
    "benchTranspose/128": {
      baselineNs: 5440.9,
      nativeNs: 5291.8,
      ompNs: 23661.8
    },
    "benchTranspose/256": {
      baselineNs: 23097.5,
      nativeNs: 22104.3,
      ompNs: 31108.0
    },
    "benchTranspose/512": {
      baselineNs: 198735.4,
      nativeNs: 178676.2,
      ompNs: 87913.6
    }
  }
};

/** The run the repository designates canonical — see docs/benchmarks/ENVIRONMENT.md. */
export const referenceRunId = "reference" as const;

export interface ShippedArtifact {
  id: string;
  file: string;
  /** Repo-relative path, so a reader can check the size themselves. */
  path: string;
  what: string;
  bytes: number;
  /** Canonical gzip stream, no filename header — what a server sends. */
  gzipBytes: number;
  /** Digest of the exact bytes the browser fetches, so a visitor can check them. */
  sha256: string;
}

/** The files the browser downloads to run the network, measured on disk. */
export const shippedArtifacts: ShippedArtifact[] = [
  {
    id: "glue",
    file: "fast_mnist.js",
    path: "web/public/wasm/fast_mnist.js",
    what: "Emscripten ES-module glue",
    bytes: 47839,
    gzipBytes: 12580,
    sha256: "c47050c579d0bc1f9dec6f8b77153a0372a3425d265f8aff716ee3f169dc63e7"
  },
  {
    id: "wasm",
    file: "fast_mnist.wasm",
    path: "web/public/wasm/fast_mnist.wasm",
    what: "compiled Matrix + NeuralNet + Embind",
    bytes: 43751,
    gzipBytes: 22816,
    sha256: "e681d2f76d41305aa3b8c250799f898bd1139497f60580ed59000d49cf5d6360"
  },
  {
    id: "weights",
    file: "model.weights.bin",
    path: "web/public/wasm/model.weights.bin",
    what: "float32 weights, exported for the browser",
    bytes: 318064,
    gzipBytes: 299144,
    sha256: "cbbb2b7b57120fff98982510423d3894a3dceeb3db0f005d040b7389ad442786"
  }
];

export interface SimdCensus {
  /** Digest of the exact module this census was taken from. */
  moduleSha256: string;
  totalFunctions: number;
  /** How many of them contain any 128-bit vector instruction. */
  vectorFunctions: number;
  vectorInstructions: number;
  /** The dual-accumulator inner loop, as a mnemonic sequence. */
  signature: string[];
  signatureHits: number;
  opcodes: { op: string; count: number }[];
  /** True at -O3: the module carries no source-level function names. */
  namesStripped: boolean;
}

/**
 * What is actually inside the .wasm the visitor just ran. Counts and opcode
 * shape only — the module is stripped, so nothing here names a source
 * function, and the page must not claim one.
 */
export const simdCensus: SimdCensus = {
  moduleSha256: "e681d2f76d41305aa3b8c250799f898bd1139497f60580ed59000d49cf5d6360",
  totalFunctions: 89,
  vectorFunctions: 5,
  vectorInstructions: 154,
  signature: [
    "v128.load",
    "f64x2.mul",
    "f64x2.add"
  ],
  signatureHits: 12,
  opcodes: [
    {
      op: "v128.load",
      count: 40
    },
    {
      op: "v128.store",
      count: 23
    },
    {
      op: "f64x2.add",
      count: 20
    },
    {
      op: "v128.const",
      count: 17
    },
    {
      op: "f64x2.mul",
      count: 14
    },
    {
      op: "f64x2.extract_lane",
      count: 10
    },
    {
      op: "f64x2.splat",
      count: 7
    },
    {
      op: "f64x2.div",
      count: 4
    },
    {
      op: "i32x4.add",
      count: 4
    },
    {
      op: "f64x2.neg",
      count: 3
    },
    {
      op: "f64x2.replace_lane",
      count: 3
    },
    {
      op: "i8x16.shuffle",
      count: 2
    },
    {
      op: "v128.load64_zero",
      count: 2
    },
    {
      op: "f64x2.promote_low_f32x4",
      count: 2
    },
    {
      op: "f64x2.sub",
      count: 1
    },
    {
      op: "i32x4.mul",
      count: 1
    },
    {
      op: "i32x4.extract_lane",
      count: 1
    }
  ],
  namesStripped: true
};
