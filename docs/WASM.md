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
even though the internal C++ storage is `double` — the ~1e-7
round-trip error is well below the precision at which a sigmoid
MLP's predictions change.

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
