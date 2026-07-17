# Fast MNIST Web Demo

React 19 + Vite frontend for the Fast MNIST classifier — a monochrome,
WebGL-free landing page ("HAND / MACHINE") with the live classifier as the
fold visual: draw pad, the exact 28x28 input raster the network receives,
a serif verdict, per-class confidence, saliency, and hidden activations.
Four numbered chapters (network / kernels / runtime / proof) carry the
engineering story with real, reproducible numbers.

## Run Locally

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://127.0.0.1:5173/`.

The app tries prediction in this order:

1. Native C++ HTTP backend only when `VITE_API_BASE_URL` is set.
2. Browser WASM artifacts from `web/public/wasm/` when `VITE_ENABLE_WASM=true`.
3. Browser-only JS demo fallback, so the free static demo remains usable even
   when neither a backend nor staged WASM artifacts are available.

Use `Cmd+K` / `Ctrl+K` to open the command palette, load the sample digit,
jump between sections, or reset the canvas.

Fonts are self-hosted in `public/fonts/`: Geist (body), Geist Mono
(telemetry/labels), and Instrument Serif italic (the "hand" voice —
headline turns and the verdict digit).

## Deploy

Use Vercel Hobby/free with this directory as the project root:

```sh
vercel deploy --prod --yes
```

Build command: `npm run build`. Output directory: `dist`. Leave
`VITE_API_BASE_URL` unset for a static, zero-cost deployment. Leave
`VITE_ENABLE_WASM` unset unless `web/public/wasm/` contains the generated
`fast_mnist.js`, `fast_mnist.wasm`, and `model.weights.bin` artifacts.

## Checks

```sh
npm ci --no-audit --no-fund
npm run format:check
npm run lint
npm run build
npm run bundle:check
npm run test:e2e
npm audit --omit=dev
```
