# ADR-0001: Hand-rolled SIMD kernels instead of Eigen or OpenBLAS

- **Status:** Accepted
- **Date:** 2025-12-26
- **Deciders:** Ayush Yadav
- **Consulted:** —
- **Informed:** contributors

## Context and problem statement

A neural-network library needs fast matrix primitives — `dot`, `transpose`,
`axpy`. The conventional answer is to link a well-tuned BLAS
(OpenBLAS, BLIS, Apple Accelerate) or include a header-only linear algebra
library like Eigen. Those are faster than anything we will write in a
weekend, and they are production-grade.

Glyph has different priorities: it is a showcase project where
every performance claim needs to be auditable from the `src/` tree in one
reading, it ships as a self-contained binary, and it targets three
operating systems plus WebAssembly. How should the core matrix kernels be
implemented?

## Decision drivers

- Readability of the hot path — reviewers should be able to see *why* a
  number is what it is.
- Minimal external dependencies — shorter build times, smaller binaries,
  portable cross-compiles (including Emscripten).
- Reproducible numbers across machines and revisions.
- Educational value: the project exists partly to demonstrate how SIMD and
  OpenMP actually work.
- Performance "good enough" for a 784 × 100 × 10 network, not
  GEMM-on-GPU territory.

## Considered options

1. **Hand-write AVX-512, AVX2, and NEON intrinsics with a scalar fallback.**
2. **Link OpenBLAS** for GEMM/AXPY and call out via a thin wrapper.
3. **Vendor Eigen** as a header-only dependency.
4. **Use a SIMD-wrapping library** like Google Highway or xsimd.

## Decision

Option 1. `Matrix::dot`, `Matrix::transpose`, and `Matrix::axpy` are
implemented with explicit AVX-512 / AVX2 / NEON intrinsics, guarded by
`__AVX512F__` / `__AVX2__` / `__ARM_NEON` feature macros, with a scalar
fallback. OpenMP parallelism sits above the kernels, gated by
empirically-tuned element-count thresholds.

## Consequences

**Good**

- The hot path is 200 lines the reader can audit. Every optimization —
  tiling, FMA fusion, aligned load, bias-add fold — is visible.
- No FFI, no platform-specific dynamic-library search, no ABI mismatches.
  The Emscripten build "just works" by falling through to the scalar path
  with `-msimd128`.
- Release-build numbers are bit-stable across runs on the same machine,
  which makes the benchmark CSV meaningful.
- Binary size stays small (< 1 MiB for the CLI).

**Bad**

- OpenBLAS's hand-tuned GEMM beats our blocked kernel by roughly 2–3× on
  large matrices. For a 784 × 100 × 10 network this is invisible; for
  anything larger it would matter.
- We own one implementation per ISA. Adding RISC-V Vector or SVE means
  writing another kernel, not flipping a flag.
- We do not get OpenBLAS's threading, packing, or cache-blocking
  heuristics for free.

## Alternatives considered and why they were rejected

- **OpenBLAS.** Best raw performance, but introduces a heavyweight native
  dependency that complicates Windows builds, cross-compiles, and
  Emscripten entirely. Defeats the "every performance claim is in `src/`"
  goal.
- **Eigen.** No link-time dependency, but the header surface is enormous,
  compile times balloon, and the generated assembly is hard to explain to
  a reader — the opposite of what this project is selling.
- **Highway / xsimd.** Technically the "right" modern answer for new
  projects. Rejected because abstracting over SIMD hides the kernels we
  specifically want to showcase; the wrapper would be more code than the
  kernels themselves.

## Validation

The `benchmarks/` suite documents the actual performance envelope and the
published numbers in [`BENCHMARKS.md`](../../BENCHMARKS.md) make the
"within 2–3× of OpenBLAS on the sizes we care about" claim inspectable.
