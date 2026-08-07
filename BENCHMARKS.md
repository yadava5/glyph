# Benchmarks

All numbers in this document are reproducible. Benchmarks are driven by
[Google Benchmark](https://github.com/google/benchmark) via
`benchmarks/bench_matrix.cpp`, orchestrated by `tools/run_benchmarks.py`,
and published as JSON + CSV + SVG under `docs/benchmarks/`.

## Methodology

- **Harness.** Google Benchmark auto-selects iteration counts so each case
  runs for at least 0.5 s of CPU time. Reported numbers are wall-clock
  nanoseconds per iteration.
- **Variance — measured, not assumed.** This bullet used to read *"variance is
  small enough (sub-percent on a quiet machine) that we don't publish
  confidence intervals today."* Nothing supported that. `tools/run_benchmarks.py`
  passed no `--benchmark_repetitions`, so every committed run recorded
  `"repetitions": 1` with no aggregates — there was no stddev in the record to
  check the claim against.

  Measured on 2026-08-02. The claim turns out to be **right about the kernels
  it matters for and wrong as a blanket statement**, which is the sort of thing
  only a measurement can tell you.

  At **20 repetitions**, the `dot` family — where the headline result lives — is
  comfortably sub-percent, and stays there on a machine reporting `load_avg`
  4.70:

  | case | baseline | omp+native | ratio |
  |---|---|---|---|
  | `benchDot/32` | 0.1% | 0.4% | 1.001× |
  | `benchDot/64` | 0.9% | 0.2% | 0.482× |
  | `benchDot/128` | 0.2% | 0.1% | 1.524× |
  | **`benchDot/256`** | **0.2%** | **0.3%** | **3.536×** |

  At **10 repetitions across all 14 cases**, the spread is wider and the blanket
  claim breaks: `benchAxpy/256` reaches **4.3%**, `benchTranspose/1024` 4.0%.
  Those are small or memory-bound cases where scheduler noise dominates, and
  they should be read as indicative only.

  So: sub-percent for `dot`, not for everything. The headline is the tight one,
  which is why **3.5×** survives three independent measurements taken on
  different machines with different repetition counts — 3.504× (Dec, 1 rep),
  3.570× (10 rep), 3.536× (20 rep).

  Aggregated records with mean/median/stddev are committed at
  `docs/benchmarks/runs/bench-20260802-aggregated-*.json`, and the machine and
  its uncontrolled conditions are recorded in `docs/benchmarks/ENVIRONMENT.md`.
  `tools/run_benchmarks.py` now defaults to ten repetitions so a record without
  aggregates cannot be produced by accident again.
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
`--native` to keep numbers reproducible across runner generations. CI numbers
will differ; treat local runs as the reference.

**Which local run is the reference.** The tables in this section are the
December 2025 run, produced on a **MacBook Air (M2, ~4 performance cores,
fanless)**. They are **history, not the reference**. The reference is the
2026-08-02 run on an **Apple M1 Pro** (8 performance + 2 efficiency cores,
actively cooled), recorded in
[`docs/benchmarks/ENVIRONMENT.md`](docs/benchmarks/ENVIRONMENT.md). The
headline OpenMP scaling figure to cite is **3.536× (dot 256, 20 repetitions)**;
see ENVIRONMENT.md:103. One row *changes sign* between the two machines —
`axpy 1024` is a 2.007× win in the December table below and a **0.922× loss**
on the reference machine — so read the tables below as the Air's numbers only.

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
false-sharing around the accumulator dominate the arithmetic. For `dot`, past
a crossover around 128 the openmp+native variant pulls ahead and stays ahead:
at dot 256 the parallel version is **3.54× faster** than baseline on the
reference machine.

**But "past the crossover it pulls ahead and stays ahead" is not true in
general, and `axpy` is the counter-example.** An earlier revision of this
paragraph claimed a crossover at 512 for `axpy`; on the M1 Pro reference run
`axpy` never crosses over at any benchmarked size:

| `axpy` (n×n) | elements | omp+native vs baseline |
| --- | ---: | ---: |
| 128 | 16,384 | 0.093× |
| 256 | 65,536 | 0.302× |
| 512 | 262,144 | 0.883× |
| 1024 | 1,048,576 | 0.922× |

Every one of those is already past the `if (rows_ * cols_ >= 4096)` gate in
`Matrix::axpy` (`src/Matrix.cpp:491`), so the gate fires in all four cases and
loses in all four. `axpy` is memory-bandwidth-bound — spreading a streaming
read-modify-write across cores adds synchronisation without adding bandwidth.
The 4096 threshold is a reasonable heuristic for the compute-bound matmul path
(`src/Matrix.cpp:381`), not a proof that parallelism pays past a size.

The `learn()` and `classify()` workloads sit in the slow regime by design —
the benchmark harness builds `NeuralNet net({784, 30, 10})`
(`benchmarks/bench_matrix.cpp:72,84`), roughly 24K parameters, which is
*smaller* than the shipped 784 × 100 × 10 model — which is why the scalar
`classify` is the fastest number in the final table. On the reference machine
that margin is only 0.5% (70,295 vs 69,957 img/s), against 17% in the December
table below.

**`-march=native` alone barely moves the needle — and on arm64 it cannot.**
The kernels are selected at COMPILE time by `#if` on `__AVX512F__` /
`__AVX2__` / `__ARM_NEON`; there is no runtime dispatch anywhere in the
library. On an Apple-silicon host the `baseline` and `native` binaries come
out **byte-identical** (same md5), because `-march=native` is an x86 flag
clang does not act on there — so the baseline-to-native delta in the tables
above is run-to-run noise on that platform, not a measurement of intrinsics
versus the autovectorizer. On x86 the two binaries do differ and the
single-digit reading is real.
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
regressions larger than a stated envelope. Until that lands, we treat the
**2026-08-02 M1 Pro run** as the source of truth (per
[`docs/benchmarks/ENVIRONMENT.md`](docs/benchmarks/ENVIRONMENT.md)) and rely
on reviewers noticing unexplained movement in the summary CSV during PR
review.

## Raw runs

Committed JSON lives under [`docs/benchmarks/runs/`](docs/benchmarks/runs/):

Reference — Apple M1 Pro, 2026-08-02 (10 repetitions; the `dot20x` pair is 20):

- `bench-20260802-aggregated-baseline.json`
- `bench-20260802-aggregated-openmp-native.json`
- `bench-20260802-dot20x-baseline.json`
- `bench-20260802-dot20x-openmp-native.json`

History — MacBook Air (M2), 2025-12-26 (single repetition, no aggregates):

- `bench-20251226-154121-baseline.json`
- `bench-20251226-154121-native.json`
- `bench-20251226-154121-openmp-native.json`

Aggregated summary: [`docs/benchmarks/bench_summary.csv`](docs/benchmarks/bench_summary.csv).
