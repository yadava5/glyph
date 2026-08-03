# Benchmark environment

The machine the aggregated runs in `runs/` were measured on. Throughput and
latency are properties of *this* box, not of the code alone, so treat everything
below as part of the result rather than as trivia.

Modelled on `jetpack-compress/benchmarks/ENVIRONMENT.md`, which is the internal
standard for this: it states the conditions it did **not** control, and then
quantifies what that costs. A benchmark record that only lists the flattering
facts is a marketing document.

**Recorded: 2026-08-02.**

## Hardware

| | |
|---|---|
| Model | Apple MacBook Pro (`MacBookPro18,3`) |
| Chip | Apple M1 Pro (arm64) |
| Cores | 10 physical / 10 logical — **8 Performance + 2 Efficiency** |
| Memory | 16 GiB |

## Software

| | |
|---|---|
| macOS | 26.6 (build 25G72) |
| Compiler | Apple clang 21.0.0 (`clang-2100.1.1.101`) |
| CMake | 4.2.1 |
| Google Benchmark | v1.9.1, `release` build |

## Method

```
cmake -S . -B <dir> -DCMAKE_BUILD_TYPE=Release \
      -DFAST_MNIST_ENABLE_BENCHMARKS=ON \
      -DFAST_MNIST_ENABLE_OPENMP=<OFF|ON> -DFAST_MNIST_ENABLE_NATIVE=<OFF|ON> \
      -DBUILD_TESTING=OFF -DFAST_MNIST_ENABLE_SERVER=OFF
cmake --build <dir> --target fast_mnist_benchmarks -j 8
<dir>/fast_mnist_benchmarks --benchmark_repetitions=10 --benchmark_min_time=0.5s \
      --benchmark_format=json
```

**Ten repetitions**, so every case carries a mean, a median and a standard
deviation. The previously committed records were taken with a single repetition
and contain no aggregates at all — see the correction note below.

## What was NOT controlled, and what it costs

Stated plainly, because the numbers are only readable if you know this:

- **No CPU pinning, no `taskset`.** macOS gives no reliable affinity API, and the
  P/E split means a thread can migrate to an efficiency core mid-measurement.
- **No turbo or DVFS disabling.** `cpu_scaling_enabled` reports `false`, which on
  Apple silicon means the OS is not exposing scaling — not that frequency is
  fixed.
- **The machine was not quiet.** Google Benchmark recorded
  `load_avg = [9.80, 7.60, 5.15]` at the start of the run. That is a *busy*
  machine, and it is the honest reason several cases below have multi-percent
  spread.

**Measured consequence**, per-case coefficient of variation over the ten
repetitions:

| | baseline | omp+native |
|---|---|---|
| `benchDot/256` (**the headline**) | **0.4%** | **1.6%** |
| `benchDot/128` | 0.2% | 2.6% |
| `benchTranspose/1024` | 4.0% | 0.5% |
| `benchAxpy/256` | **4.3%** | 1.0% |
| `benchAxpy/1024` | 3.9% | 0.6% |
| `benchLearn` / `benchClassify` | 1.1% / 1.6% | 1.3% / 1.6% |

The spread ranges from **0.2% to 4.3%** depending on the case. The headline
`dot 256` comparison is among the tightest, which is why the 3.5× claim survives
a busy machine — but the small-`axpy` and large-`transpose` cases should be read
as indicative only.

## Correction to the earlier record

`BENCHMARKS.md` previously stated that *"variance is small enough (sub-percent on
a quiet machine) that we don't publish confidence intervals today."* That was
never measured. The committed runs in `runs/bench-20251226-*.json` were produced
by `tools/run_benchmarks.py`, which passed **no** `--benchmark_repetitions`, so
each records `"repetitions": 1` with no aggregate entries — there was no
stddev in the record to support or refute the claim.

Measured here, the claim is **false as a blanket statement** and true only of
some cases. Nothing about the headline result changes: dot 256 medians give
**3.570×**, against 3.504× in the committed December record and 3.520× in a
single-repetition re-run. Three independent measurements, same conclusion.

`tools/run_benchmarks.py` now passes `--benchmark_repetitions` so this cannot
recur silently.

## Which record is canonical, and why it is this one

**The 2026-08-02 runs on the M1 Pro are the reference. The December runs are
history.** This is not about whose machine is nicer — it is that the two are
structurally different in exactly the dimension the headline claim measures.

`runs/bench-20251226-*.json` record `context.host_name = Shrees-MacBook.local`
and an executable path under `/Users/shreebatsa/`, while `BENCHMARKS.md`
described the tables as "produced on a local M2". That was a **MacBook Air**:
fanless, and on Apple silicon the Air configurations carry roughly **4
performance cores** against this machine's **8**.

The headline result is an *OpenMP scaling* number. Measuring it on half the
performance cores, with no fan to sustain them, does not produce a slightly
noisier version of the same figure — it measures a different machine's ceiling.
A sustained parallel benchmark is also precisely where a fanless chassis
throttles and an actively-cooled one does not.

The December runs are kept because they are real measurements and deleting
inconvenient data is how records stop being trustworthy. They are simply no
longer the reference, and this file exists so nobody has to guess which is which.

That both machines land near 3.5× is worth noting rather than hiding: it says
the dot-256 kernel is bound by something other than raw core count at this size.
It does not make an Air a Pro.

## What load does to these numbers

The 20-repetition run above was taken at `load_avg 4.70` and still produced
0.1–0.3% coefficients of variation on the `dot` cases. Load matters less than
expected here, with one asymmetry worth stating: **background load penalises the
parallel configuration more than the single-threaded baseline**, because OpenMP
wants every core and the baseline does not care. Any bias from a busy machine
therefore pushes the measured ratio **down**. The figures here are a floor, not a
best case.
