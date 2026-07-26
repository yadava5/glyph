<p align="center">
  <img src="docs/branding/readme-light.svg#gh-light-mode-only" width="700"
       alt="Glyph">
  <img src="docs/branding/readme-dark.svg#gh-dark-mode-only" width="700"
       alt="Glyph">
</p>

---

A course-provided C++ MNIST network, hand-optimized: AVX-512 / AVX2 /
NEON / wasm simd128 kernels behind a 97.01%-accuracy classifier, with a
live in-browser scalar-vs-SIMD benchmark, real activation heatmaps, and
input saliency — on a monochrome, WebGL-free landing page.

[![ci][ci-badge]][ci-url]
[![license][license-badge]][license-url]
[![release][release-badge]][release-url]
[![web app][web-badge]][web-url]
[![system card][systemcard-badge]][systemcard-url]
[![openssf scorecard][scorecard-badge]][scorecard-url]

## Web demo

**Live: https://getglyph.vercel.app** — draw a digit; the hand-written
simd128 kernel races scalar on your machine, in your browser.

Draw a digit, see the prediction, rotate the network, and inspect the
activation pipeline. See [`web/README.md`](web/README.md) for the deploy and
run commands.

> The public deployment target is Vercel Hobby with root directory `web`. It
> calls a C++ `/predict` API only when `VITE_API_BASE_URL` is configured. Static
> deployments use staged browser WASM when `VITE_ENABLE_WASM=true`, otherwise
> they use the clearly-labeled browser JS demo classifier.

## Demo preview

<img src="web/public/hero-poster.svg" width="760"
     alt="Glyph animated web demo preview">

Draw a digit, load the sample through the command palette, inspect real
softmax and saliency output, and scroll through the animated 784 -> 100 -> 10
pipeline stage.

## What it is

A C++17 core library that implements a two-layer multilayer perceptron
(784 → 100 → 10) from the ground up. Matrix primitives — `dot`, `transpose`,
`axpy` — are hand-written with AVX-512, AVX2, NEON, and WebAssembly simd128
intrinsics, with a scalar fallback and OpenMP parallelism above
empirically-tuned element-count thresholds. After ~30 epochs on MNIST the network reaches ~97% test accuracy.

The library ships as three deployables. A CLI (`fast_mnist_cli`) trains and
evaluates from the terminal. An HTTP server (`fast_mnist_server`, built on
cpp-httplib + nlohmann/json) exposes `/health` and `/predict`. An Emscripten
build compiles the same core to WebAssembly with `-msimd128`. The frontend uses
that path only when the generated artifacts are staged and explicitly enabled;
otherwise the public static demo falls back to a labeled browser JS classifier.

The frontend is a Vite-bundled React 19 + TypeScript SPA — a monochrome
landing page with the live classifier as the fold visual. It uses Motion v12
for entrances, Tailwind v4 tokens for the design system, and self-hosted
Geist / Geist Mono / Instrument Serif. Drawing uses perfect-freehand over an
SVG canvas, with MNIST-style preprocessing (bounding-box crop, 20x20 fit,
center-of-mass centering) before inference. The activation heatmap and
saliency panels are real, not decorative — they read `hidden_activations`
and `input_grad` from the classifier response. No WebGL ships: the page is a
single ~134KB-gzip bundle.

## Quickstart

```sh
python3 tools/run.py
```

Downloads MNIST, configures a Release build, compiles the C++ core, and runs
a training pass. `python3 tools/run.py --help` for flags.

## Benchmarks

Full methodology, reproduction command, and charts live in
[`BENCHMARKS.md`](BENCHMARKS.md). Teaser, Apple M2 / Apple clang 17 / Release:

| Case           | baseline  | native   | openmp+native |
| -------------- | --------- | -------- | ------------- |
| dot 256        | 4,835,360 | 4,759,132 | **1,379,835** |
| transpose 1024 | 978,383   | 861,078   | **502,426**   |
| axpy 1024      | 230,626   | 229,230   | **114,910**   |
| classify       | **81,628 img/s** | 80,712 img/s | 69,994 img/s |

Matrix ops in ns/op (lower is better); classify in images/second (higher is
better). OpenMP pays off at 128+ for dot, 512+ for axpy, and hurts on small
sizes — see `BENCHMARKS.md` for the full story and scaling charts.

## Build from source

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build
```

macOS one-liner:

```sh
./tools/bootstrap_macos.sh
```

The build is warning-clean on GCC, Clang, and MSVC. 41 Catch2 tests — unit,
property-based, and HTTP API — live under `tests/` and run via CTest.
`cmake -DFAST_MNIST_ENABLE_DOXYGEN=ON` adds a `docs` target.

## Run the CLI

```sh
./build/fast_mnist_cli data 5000 10 TrainingSetList.txt TestingSetList.txt
```

Arguments: data directory, training set size, epoch count, training list,
test list. `fast_mnist_trainer` dumps the resulting `model.weights` to disk.

## Run the HTTP server

```sh
./build/fast_mnist_server 8080 model.weights
```

Exposes:

| Method | Endpoint   | Description                                             |
| ------ | ---------- | ------------------------------------------------------- |
| GET    | `/health`  | Readiness, model path, model-loaded state, topology     |
| POST   | `/predict` | Classify a digit — `{ "pixels": [784 floats in 0..1] }` |

The server returns the predicted label, full softmax distribution, hidden
activations, and the input-gradient saliency map the frontend uses for
heatmaps. Missing model files are startup errors, and request validation
returns stable JSON errors as `{ "error": { "code": "...", "message": "..." } }`.

## Web app

```sh
cd web
npm install
npm run dev
```

Opens on `localhost:5173`. Set `VITE_API_BASE_URL` only when you want the
frontend to call a running C++ server; leave it unset for static demo mode.
See [`web/README.md`](web/README.md) for Vercel deployment notes.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  C++17 core      Matrix · NeuralNet · SIMD kernels (AVX-512/   │
│                  AVX2/NEON) · OpenMP · Xavier init · SGD       │
└────────────────────────────────────────────────────────────────┘
         │                │                     │
         ▼                ▼                     ▼
   fast_mnist_cli   fast_mnist_server     wasm (emscripten,
   (train/eval)     (cpp-httplib +        -msimd128)
                    nlohmann/json)             │
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                      React 19 + Vite + Motion v12 SPA
                      · perfect-freehand SVG canvas
                      · live 28x28 raster + saliency
                      · Tailwind v4 monochrome tokens
```

## Philosophy

**Goals**

- Transparent: every kernel, every parallel threshold, every serialization
  byte is readable from `src/` in one sitting.
- Reproducible: Release builds are bit-stable, CI pins compilers, and
  benchmark JSON is committed.
- Performant at small scale: a 784 × 100 × 10 network should classify a digit
  in microseconds, not milliseconds.

**Non-goals**

- Training large models. The net fits in L1. That's the point.
- Distributed serving. One process, one model, no coordinator.
- A reusable ML library. `NeuralNet` is hardcoded to two layers by design —
  see [`docs/adr/0002-two-layer-mlp-not-generic-graph.md`](docs/adr/0002-two-layer-mlp-not-generic-graph.md).

Design trade-offs are documented in [`docs/adr/`](docs/adr/).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branching model, commit
convention, and PR template. Security issues: [`SECURITY.md`](SECURITY.md).
Code of conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Authors

- **[Ayush Yadav](https://github.com/yadava5)** — author. C++ core, SIMD
  kernels, build system, and the complete React/TypeScript web frontend and
  application.
- **[Shree Chaturvedi](https://github.com/shreebatsa)** — kernel and
  optimization contributions.

## Acknowledgments

- Michael Nielsen, *Neural Networks and Deep Learning* — the reference
  implementation and pedagogy behind the two-layer MLP.
- [cpp-httplib](https://github.com/yhirose/cpp-httplib),
  [nlohmann/json](https://github.com/nlohmann/json),
  [Catch2](https://github.com/catchorg/Catch2),
  [Google Benchmark](https://github.com/google/benchmark),
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand),
  [Motion](https://motion.dev/),
  [Tailwind CSS](https://tailwindcss.com/).

## License

MIT — see [`LICENSE`](LICENSE).

[ci-badge]: https://github.com/yadava5/fast-mnist-nn/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/yadava5/fast-mnist-nn/actions/workflows/ci.yml
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: LICENSE
[release-badge]: https://img.shields.io/github/v/release/yadava5/fast-mnist-nn?sort=semver
[release-url]: https://github.com/yadava5/fast-mnist-nn/releases
[web-badge]: https://img.shields.io/badge/web-demo-brightgreen
[web-url]: https://getglyph.vercel.app
[scorecard-badge]: https://api.securityscorecards.dev/projects/github.com/yadava5/fast-mnist-nn/badge
[scorecard-url]: https://securityscorecards.dev/viewer/?uri=github.com/yadava5/fast-mnist-nn
[systemcard-badge]: https://img.shields.io/badge/system%20card-read-blue
[systemcard-url]: https://getglyph.vercel.app/system-card
