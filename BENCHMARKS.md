# Benchmarks

All numbers in this document are reproducible. Benchmarks are driven by
[Google Benchmark](https://github.com/google/benchmark) via
`benchmarks/bench_matrix.cpp`, orchestrated by `tools/run_benchmarks.py`,
and published as JSON + CSV + SVG under `docs/benchmarks/`.

## Methodology

- **Harness.** Google Benchmark auto-selects iteration counts so each case
  runs for at least 0.5 s of CPU time. Reported numbers are the mean
  wall-clock nanoseconds per iteration across that window. Variance is
  small enough (sub-percent on a quiet machine) that we don't publish
  confidence intervals today; see *Continuous benchmarking* below for the
  plan.
- **Warm-up.** Google Benchmark's default pre-roll is sufficient for these
  cache-resident workloads. The largest working set (a 1024×1024 float
  matrix pair, ~8 MiB) exceeds L2 on M2; the smallest (32×32) fits in L1.
- **Workloads.** `benchDot`, `benchTranspose`, and `benchAxpy` operate on
  square matrices at N ∈ {32, 64, 128, 256, 512, 1024} using 64-byte
  aligned storage and a padded leading dimension. `benchLearn` and
  `benchClassify` exercise the full forward/backward path on a
  784 → 30 → 10 network with deterministic input values (so any regression
  is a real regression, not a sampling artefact).
- **Release builds only.** Debug builds are never benchmarked.
- **Three configurations.** baseline (no `-march=native`, no OpenMP),
  `native` (`-march=native`, no OpenMP), and `openmp+native`. Each is a
  clean CMake configure + build, not an incremental rebuild.

## Reproducing

```sh
python3 tools/run_benchmarks.py --openmp --native
```

This runs all three configurations end-to-end, writes JSON into
`docs/benchmarks/runs/`, appends a summary row to `bench_summary.csv`, and
regenerates the SVG charts under `docs/benchmarks/charts/`. The Python
driver shells out to CMake and Google Benchmark — no extra dependencies
beyond the toolchain and `tqdm` (auto-installed).

**CI note.** Continuous integration intentionally runs benchmarks *without*
`--native` to keep numbers reproducible across runner generations. The
tables below were produced on a local M2. CI numbers will differ; treat
local runs as the canonical reference.

## Environment

```
Run:       20251226-154121
OS:        macOS 15.5 arm64 Mach-O
Arch:      arm64
CPU:       Apple M2
Compiler:  Apple clang 17.0.0 (clang-1700.0.13.5)
Build:     -O3, OpenMP on/off, -march=native on/off
```

Full per-run metadata is pinned in
[`docs/benchmarks/bench_env.md`](docs/benchmarks/bench_env.md).

## Headline results

### Matrix ops (ns/op, lower is better)

| Case            | baseline  | native    | openmp+native |
| --------------- | --------- | --------- | ------------- |
| dot 32          | 6,165     | 6,229     | 6,287         |
| dot 64          | 65,252    | 57,222    | 89,130        |
| dot 128         | 575,281   | 587,767   | **374,400**   |
| dot 256         | 4,835,360 | 4,759,132 | **1,379,835** |
| transpose 128   | 5,441     | 5,292     | 23,662        |
| transpose 256   | 23,098    | 22,104    | 31,108        |
| transpose 512   | 198,735   | 178,676   | **87,914**    |
| transpose 1024  | 978,383   | 861,078   | **502,426**   |
| axpy 128        | 3,486     | 3,477     | 23,917        |
| axpy 256        | 13,886    | 13,896    | 26,335        |
| axpy 512        | 55,848    | 55,441    | **35,846**    |
| axpy 1024       | 230,626   | 229,230   | **114,910**   |

### Training and inference throughput (img/s, higher is better)

| Case       | baseline | native  | openmp+native |
| ---------- | -------- | ------- | ------------- |
| learn step | 48,755   | 49,399  | 48,636        |
| classify   | **81,628** | 80,712 | 69,994      |

## Analysis

**OpenMP is a scale story.** At N=32–128 the parallel variants are slower
than scalar, sometimes by 3–7×. Thread wake-up, fork-join bookkeeping, and
false-sharing around the accumulator dominate the arithmetic. Past the
crossover — 128 for `dot`, 512 for `axpy`, 128–512 for `transpose` — the
openmp+native variant pulls ahead and stays ahead. At dot 256 the parallel
version is **3.5× faster** than baseline. The `learn()` and `classify()`
workloads sit in the slow regime by design (784 × 100 × 10 weights), which
is why the scalar `classify` is actually the fastest number in the final
table — OpenMP overhead is pure loss at that scale.

**`-march=native` alone barely moves the needle.** Comparing baseline to
native, the uplift is typically single-digit percent — the hand-written
intrinsic kernels are already selected for the widest SIMD the target
supports at compile time, so giving the autovectorizer more ISA doesn't
help it catch up.
Where `native` does help is in the *non*-kernel code (bounds checks,
serialization glue), which matters for the end-to-end `learn`/`classify`
numbers more than for isolated ops.

**The kernels are the bottleneck we chose.** The decision to hand-roll
AVX-512/AVX2/NEON instead of linking OpenBLAS or Eigen is documented in
[`docs/adr/0001-hand-rolled-simd-over-bundled-blas.md`](docs/adr/0001-hand-rolled-simd-over-bundled-blas.md).
OpenBLAS would likely win on large `dot` by another 2–3×; we trade that
for reproducibility, binary size, and the ability to read every
optimization in `src/`.

### Scaling charts

<p align="center">
  <img src="docs/benchmarks/charts/dot-light.svg#gh-light-mode-only" width="760"
       alt="Dot scaling">
  <img src="docs/benchmarks/charts/dot-dark.svg#gh-dark-mode-only" width="760"
       alt="Dot scaling">
</p>

<p align="center">
  <img src="docs/benchmarks/charts/transpose-light.svg#gh-light-mode-only"
       width="760" alt="Transpose scaling">
  <img src="docs/benchmarks/charts/transpose-dark.svg#gh-dark-mode-only"
       width="760" alt="Transpose scaling">
</p>

<p align="center">
  <img src="docs/benchmarks/charts/axpy-light.svg#gh-light-mode-only" width="760"
       alt="Axpy scaling">
  <img src="docs/benchmarks/charts/axpy-dark.svg#gh-dark-mode-only" width="760"
       alt="Axpy scaling">
</p>

<p align="center">
  <img src="docs/benchmarks/charts/throughput-compare-light.svg#gh-light-mode-only"
       width="760" alt="Throughput comparison">
  <img src="docs/benchmarks/charts/throughput-compare-dark.svg#gh-dark-mode-only"
       width="760" alt="Throughput comparison">
</p>

## Continuous benchmarking

Committed numbers drift. Phase 5 of the roadmap wires
[CodSpeed](https://codspeed.io/) into CI so every PR reports per-case
performance deltas against `main`, with a fail-the-build threshold for
regressions larger than a stated envelope. Until that lands, we treat
local M2 numbers as the source of truth and rely on reviewers noticing
unexplained movement in the summary CSV during PR review.

## Raw runs

Committed JSON lives under [`docs/benchmarks/runs/`](docs/benchmarks/runs/):

- `bench-20251226-154121-baseline.json`
- `bench-20251226-154121-native.json`
- `bench-20251226-154121-openmp-native.json`

Aggregated summary: [`docs/benchmarks/bench_summary.csv`](docs/benchmarks/bench_summary.csv).
