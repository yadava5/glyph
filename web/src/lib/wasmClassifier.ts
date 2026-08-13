/**
 * Browser-side WASM classifier. Lazily loads the Emscripten-emitted
 * module + the compact binary weights file on first use, caches the
 * live instance, and exposes a single classify() function that
 * returns a PredictionResponse-shaped object.
 *
 * Everything in this file is deliberately dynamic-typed: Embind-
 * generated APIs don't have a static shape TypeScript can reason
 * about without hand-rolled declarations, and writing those by hand
 * gets out of sync the moment wasm_bindings.cpp changes. We keep the
 * surface tiny and type-check the boundary values instead.
 */

import type { PredictionResponse } from '../api/predict';
import { classifyWithJsFallback } from './jsFallbackClassifier';

const WASM_ENABLED = import.meta.env.VITE_ENABLE_WASM === 'true';

/**
 * Live instance produced by Embind. We treat it as opaque and only
 * ever call the two methods we bound in wasm_bindings.cpp:
 *   - loadWeightsFromBinary(Uint8Array)
 *   - classify(number[])
 */
interface WasmClassifierInstance {
  loadWeightsFromBinary: (bytes: Uint8Array) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classify: (pixels: number[]) => any;
}

/**
 * Opaque factory type for the Emscripten MODULARIZE=1 export. The
 * runtime shape is richer than this (emval helpers, HEAP views, etc)
 * but we only need the WasmClassifier constructor the Embind macro
 * attaches.
 */
interface WasmFactory {
  (opts?: { locateFile?: (path: string) => string }): Promise<{
    WasmClassifier: new () => WasmClassifierInstance;
    buildInfo: () => string;
  }>;
}

interface WasmModuleHandle {
  classifier: WasmClassifierInstance;
  /** Compile-time ISA of the module, e.g. "simd128". */
  build: string;
}

let modulePromise: Promise<WasmModuleHandle> | null = null;

/** Guards the fallback log so it fires once, not once per stroke. */
let wasmFailureReported = false;

/**
 * First caller kicks off the download + instantiation; subsequent
 * callers await the same promise. The promise resolves to an object
 * whose `classifier` member is the live WasmClassifier instance with
 * weights already loaded.
 */
export function ensureWasm(): Promise<WasmModuleHandle> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // Dynamic import so the generated .js file (+ its .wasm side-
      // car) is not pulled into the LCP critical path. The `/* @vite-
      // ignore */` comment tells the bundler that the specifier is
      // an absolute public-path URL, not a module it should attempt
      // to resolve at build time. We launder the specifier through a
      // local variable so tsc treats it as a plain `any` dynamic
      // import; TypeScript cannot statically check a public-path
      // URL and we do not want to invent synthetic type decls for
      // Emscripten-generated glue.
      const wasmUrl = '/wasm/fast_mnist.js';
      const mod: { default: WasmFactory } = await import(/* @vite-ignore */ wasmUrl);
      const factory = mod.default;
      const instance = await factory({
        // Rewrite the relative `fast_mnist.wasm` URL into the
        // absolute public path the Emscripten runtime should fetch.
        locateFile: (path: string) => `/wasm/${path}`,
      });

      const weightsResp = await fetch('/wasm/model.weights.bin');
      if (!weightsResp.ok) {
        throw new Error(`model.weights.bin fetch failed: ${weightsResp.status}`);
      }
      const weightsBytes = new Uint8Array(await weightsResp.arrayBuffer());

      const classifier: WasmClassifierInstance = new instance.WasmClassifier();
      classifier.loadWeightsFromBinary(weightsBytes);
      const build = typeof instance.buildInfo === 'function' ? instance.buildInfo() : 'wasm';
      return { classifier, build };
    })().catch((err) => {
      // Reset the cache on failure so a later retry can re-attempt.
      modulePromise = null;
      throw err;
    });
  }
  return modulePromise;
}

/**
 * Convert a raw JS array-like returned by Embind (a number[] or
 * JS-side Float32Array) into a plain JS array so downstream consumers
 * don't need to handle both shapes.
 */
function toNumberArray(v: unknown): number[] {
  if (Array.isArray(v)) return v as number[];
  if (v instanceof Float32Array || v instanceof Float64Array) {
    return Array.from(v);
  }
  return [];
}

/**
 * Execute a forward pass entirely in the browser. WASM is attempted
 * only when VITE_ENABLE_WASM is explicitly true; otherwise this uses
 * the labeled JS demo fallback without probing absent artifacts.
 */
export async function classifyInBrowser(pixels: number[]): Promise<PredictionResponse> {
  if (!WASM_ENABLED) {
    return classifyWithJsFallback(pixels);
  }

  try {
    const { classifier, build } = await ensureWasm();
    const result = classifier.classify(pixels);

    // Timings come from C++ (adaptive-mean, forward pass only —
    // marshalling and the saliency backward pass are excluded).
    // baseline = the same math with vectorization disabled; optimized =
    // the hand-written wasm simd128 kernel. See wasm/wasm_bindings.cpp.
    return {
      prediction: Number(result.prediction),
      confidence: toNumberArray(result.confidence),
      baseline_time_ms: Number(result.baseline_time_ms) || 0,
      optimized_time_ms: Number(result.optimized_time_ms) || 0,
      // How many times the harness actually ran each variant to produce
      // those means. The module has always reported these and this layer
      // has always thrown them away, which left the page describing a
      // mean of dozens of kernel runs as a single sample.
      timing_iters_simd: Number(result.timing_iters_simd) || 0,
      timing_iters_scalar: Number(result.timing_iters_scalar) || 0,
      hidden_activations: toNumberArray(result.hidden_activations),
      input_grad: toNumberArray(result.input_grad),
      source: 'browser-wasm',
      build,
    };
  } catch (error) {
    // Falling back is right for the visitor; falling back SILENTLY is
    // what let a production defect live unnoticed. The CSP shipped in
    // web/vercel.json permits 'wasm-unsafe-eval' but not new Function,
    // so an Embind glue built by a toolchain that reaches new Function
    // made this factory throw EvalError for every visitor — while the
    // page kept serving the JS stub and said nothing. `void error`
    // stood here, and it would have hidden the next cause too.
    //
    // Once per session, not per stroke: a draw pad classifies on every
    // pointer move, and an error logged per classification is noise
    // nobody reads.
    if (!wasmFailureReported) {
      wasmFailureReported = true;
      console.error(
        '[glyph] WASM classifier unavailable — serving the JS fallback. ' +
          'Predictions remain correct but the reported timings are not the ' +
          'simd128 kernel. Cause:',
        error,
      );
    }
    return classifyWithJsFallback(pixels);
  }
}
