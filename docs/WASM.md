# Browser-native inference via WebAssembly

Glyph ships the same C++ classifier to both a native HTTP backend
**and** to the browser as a WebAssembly module.
The web demo tries the backend first and falls back to the WASM path
when the server is unavailable, so the site runs on any static host.
If generated WASM artifacts are not present, the frontend uses a small
browser-only template classifier as a demo fallback instead of breaking.

## Artifacts

Sizes below are **measured from the committed artifacts**, not estimated. kB is
decimal (bytes ÷ 1000). Gzip figures are the canonical stream a web server
sends — no filename in the header; `gzip -9 -c <file>` reports 14–18 bytes more
than these because it stores the original filename, which is header, not
payload.

`tools/readme_facts.py --check` now reads these three files off disk and fails
CI if any figure below disagrees. It did not until 2026-08-13, and two of the
three rows had drifted from an earlier build — the glue bundle was stated at
44.9 kB against an actual 47.8 kB, and the wasm module at 46.5 kB against an
actual 43.8 kB. The sentence above claiming they were measured had been true
once.

| File                                     | Size (measured) | Purpose                                        |
| ---------------------------------------- | -------------- | ---------------------------------------------- |
| `web/public/wasm/fast_mnist.js`          | 47.8 kB (47,839 B) · 12.6 kB gzipped | Emscripten ES-module glue (factory function). |
| `web/public/wasm/fast_mnist.wasm`        | 43.8 kB (43,751 B) · 22.8 kB gzipped | Compiled `Matrix` + `NeuralNet` + Embind shim. |
| `web/public/wasm/model.weights.bin`      | 318.1 kB raw (318,064 B) / 299.1 kB gzipped | Binary weights blob (float32). |

### Digests

`benchmarks/mnist_eval.json` records a sha256 for `model.weights` — the 800,678-byte
ASCII checkpoint the native evaluator reads. **The browser does not fetch that
file.** It fetches `model.weights.bin`, the 318,064-byte float32 export produced
by `apps/export_weights.cpp`, and until 2026-08-13 no digest for it was
committed anywhere. So the one artifact a visitor actually downloads was the one
artifact they could not check.

| File | sha256 |
| ---- | ------ |
| `web/public/wasm/fast_mnist.js` | `c47050c579d0bc1f9dec6f8b77153a0372a3425d265f8aff716ee3f169dc63e7` |
| `web/public/wasm/fast_mnist.wasm` | `e681d2f76d41305aa3b8c250799f898bd1139497f60580ed59000d49cf5d6360` |
| `web/public/wasm/model.weights.bin` | `cbbb2b7b57120fff98982510423d3894a3dceeb3db0f005d040b7389ad442786` |

Check any of them with `shasum -a 256 web/public/wasm/<file>`. These are also
gated by `tools/readme_facts.py --check`, so a rebuilt artifact that is not
re-recorded fails CI rather than silently invalidating the table.

`web/public/wasm/` **is** checked into git: git-driven Vercel builds must ship
the real simd128 artifacts rather than fall back to the JS classifier, so the
three files above are tracked. They remain reproducible via
`tools/build_wasm.sh`, and the `.github/workflows/wasm.yml` workflow also
uploads them as a CI artifact on every change.

The weights blob barely compresses (318 kB → 299 kB, ~6%): it is dense
float32, so there is little redundancy for DEFLATE to find. An earlier
revision of this table claimed ~100 kB gzipped, which was never measured.
The JS fallback is intentionally separate from the C++ performance path; it
exists only to keep zero-cost previews interactive before WASM artifacts are
staged.

## Building locally

```bash
# one-time: install emsdk somewhere persistent
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk && ./emsdk install 3.1.64 && ./emsdk activate 3.1.64

# every build session:
source ~/emsdk/emsdk_env.sh

# produce the native export_weights first (the WASM toolchain can't
# run it itself)
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target export_weights

# then build + stage the WASM artifacts
cd /path/to/glyph
./tools/build_wasm.sh
```

The script stages `fast_mnist.{js,wasm}` into `web/public/wasm/`
and, if it finds a native `build/export_weights`, regenerates
`web/public/wasm/model.weights.bin` from the current ASCII
`model.weights` in the repo root.

## File format: `model.weights.bin`

Little-endian binary, produced by `apps/export_weights.cpp`,
consumed by `NeuralNet::loadBinary` and the Embind `WasmClassifier`:

```
offset  size    field
------  ----    -----
0       4       uint32  magic      = 'FMNN' (0x464D4E4E)
4       4       uint32  version    = 1
8       4       uint32  layerCount (e.g. 3 for 784->100->10)
12      4*L     uint32  layerSizes[layerCount]
...     4*Nb    float32 biases  : for each layer l>=1, layerSizes[l] values
...     4*Nw    float32 weights : for each layer l>=1, layerSizes[l] * layerSizes[l-1] values
```

Weights are stored row-major per layer (each output neuron's
incoming weights contiguous). The format intentionally uses float32
even though the internal C++ storage is `double`.

That used to be followed by an assertion that the round-trip error "is well
below the precision at which a sigmoid MLP's predictions change" — plausible,
and nobody had measured it. It has now been measured, and it holds:

- **Zero prediction changes in 10,000.** Loading the shipped `.bin` and
  evaluating gives 9,701 / 10,000 — the same label on every single image as the
  double checkpoint. `benchmarks/mnist_f32_flips.json` records the run.
- All **79,510** parameters in the `.bin` equal `static_cast<double>(static_cast<float>(w))`
  of the ASCII value, with zero mismatches, so the export layout is verified too.
- Largest output-activation difference **1.28e-7**, mean **5.4e-10**.
- The tightest decision in the whole test set — index 9858, an 8-vs-6 margin of
  **6.49e-4** — moves by **5.6e-9** under f32. Five orders of magnitude of
  headroom on the closest call there is.

Reproduce with `./build/fast_mnist_eval --f32-weights`, which is opt-in and
writes only the comparison artifact.

**What this does NOT establish.** Quantisation is one of three ways the browser
can disagree with the native evaluator, and it is the one now known to be
harmless. The other two are unmeasured:

1. **Reduction order.** The native arm64 path takes `dot_neon_rowvec` — one
   `f64x2` accumulator, two-lane horizontal reduction. The wasm kernel runs two
   accumulators and reduces four lanes.
2. **FMA contraction.** NEON's `vfmaq_f64` never rounds the intermediate
   product; wasm simd128 has no FMA, so every multiply rounds.

(2) is plausibly the larger of the two, because it changes rounding at every
multiply rather than only in the reduction tree. **So the true browser-versus-native
difference may be larger than the figure above and is not bounded by it.**
Closing that needs the wasm module itself run over the same 10,000 images, which
has not been done. Nothing may claim exact in-browser reproduction until it has.

## What is actually in the module

Every "SIMD made this faster" demo asks to be taken on trust twice: that the
fast path really is vectorised, and that the baseline really is not. This
repository's answer used to be a source comment. It is now a census of the
shipped binary, in `docs/benchmarks/wasm-simd-census.json`, produced by
`tools/wasm_census.py` from `wasm-objdump -d`:

| | |
|---|---|
| Functions in the module | **89** |
| Functions containing any 128-bit vector instruction | **5** |
| Vector instructions in total | **154** |
| `v128.load` → `f64x2.mul` → `f64x2.add` sequences | **12** |

That last row is the dual-accumulator inner loop of `dot_wasm128_rowvec` in
`src/NeuralNet.cpp`, unrolled by the compiler: load a vector of weights,
multiply by a vector of inputs, accumulate — twice over independent chains so
the multiply-add pipeline never waits on itself. The opcode histogram is f64x2
throughout, which is the widest lane WebAssembly has.

**What this cannot say.** Emscripten strips the name section at `-O3`, so the
module carries no source-level function names — only 5 of the 89 functions have
any name at all, and those are minified exports. The census reports function
*indices* and the instruction shape. It never asserts "this count belongs to
`dot_wasm128_rowvec`", because a stripped binary cannot support that claim.

Reproduce it with `brew install wabt && python3 tools/wasm_census.py --write`.
CI runs `--check`, which is stdlib-only: the census records the sha256 of the
module it was taken from, so a rebuilt binary with a stale census fails the
build without putting wabt on the runner.

Together with `.github/workflows/wasm.yml` — which blocks CI unless this module
rebuilds byte-for-byte from source at pinned emsdk on both linux/amd64 and
macOS/arm64 — the chain from source to binary to browser is closed and checked
at every link.

## Platform differences vs native

The same C++ kernels target multiple ISAs via `#if defined(__AVX512F__)`
/ `__AVX2__` / `__ARM_NEON` / scalar fallback. Under Emscripten none
of those predicates match; the compiled wasm uses the scalar fallback
path. To pick up SIMD in the browser we compile with `-msimd128`,
which gives Emscripten's autovectorizer access to WebAssembly's
fixed 128-bit SIMD opcodes. Practical implications:

- **Per-instruction width drops from 512 → 128 bits** (AVX-512 vs
  WASM SIMD) or **256 → 128 bits** (AVX2 vs WASM SIMD). The
  theoretical throughput ceiling is ~4× or ~2× lower respectively.
- **No FMA on WASM SIMD** — the v8 engine schedules separate
  `fmul` / `fadd` sequences internally.
- **No OpenMP in the browser** — the wasm target forces
  `FAST_MNIST_ENABLE_OPENMP=OFF`. The 784→100→10 network's forward
  pass is well below the threshold where OpenMP helped on native
  anyway, so this is a no-op for the demo.

Latency in practice on a recent laptop: **<5 ms per forward pass**
cold, ~1-2 ms warm. That's slower than the native SIMD backend but
imperceptible at the UI level.

## Reference implementations

For prior art and deeper-dive reading on shipping SIMD-aware C++
to the browser:

- **whisper.cpp wasm** — https://github.com/ggerganov/whisper.cpp
  demonstrates `-msimd128` with Emscripten for real-time audio.
- **wllama** — https://github.com/ngxson/wllama ships llama.cpp to
  the browser with Embind bindings similar to this repo.
- **tinygrad browser demo** — the TinyJit path proves small MLPs
  comfortably fit WASM's memory + startup budget.

## Troubleshooting

- **`RuntimeError: table index is out of bounds`** after
  `loadWeightsFromBinary` — your `model.weights.bin` is stale;
  regenerate it with the current `export_weights`.
- **`Cannot find module '/wasm/fast_mnist.js'`** at build time —
  ensure the dynamic import is laundered through a string variable
  as done in `web/src/lib/wasmClassifier.ts`; bundler static
  resolution fails otherwise.
- **404 on `fast_mnist.wasm`** — the Emscripten factory expects
  the `.wasm` to live next to the `.js`. The TS wrapper passes a
  `locateFile` hook that prefixes `/wasm/`; make sure your host
  serves `web/public/wasm/` at that path.
- **No WASM artifacts staged yet** — the UI falls back to
  `web/src/lib/jsFallbackClassifier.ts`. This keeps drawing, command-palette
  demos, confidence bars, and activation panels usable on free static previews,
  but it is not used for benchmark claims.
