/**
 * Emscripten / Embind bindings exposing NeuralNet classification to
 * JavaScript. Built only when CMake is configured with an Emscripten
 * toolchain (see the top-level CMakeLists.txt).
 *
 * Design notes:
 *   - Weights arrive as a Uint8Array from fetch('model.weights.bin').
 *     We copy the bytes into a std::string container because Embind's
 *     val<->vector<uint8_t> path is awkward; std::string roundtrips
 *     cleanly and is used as an opaque byte buffer here.
 *   - Pixels arrive as a plain Array<number> or Float32Array. We read
 *     them through val and convert to Matrix's double storage.
 *   - classify() returns a plain JS object matching the existing
 *     PredictionResponse shape (prediction, confidence, hidden,
 *     input_grad) so the TS fallback glue is near-trivial.
 */

#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "fast_mnist/Matrix.h"
#include "fast_mnist/NeuralNet.h"

namespace {

using emscripten::val;

// Helper: convert a JS array-like (Array, Float32Array, Uint8Array of
// numbers ...) into a contiguous std::vector<double>. Uses the generic
// val::as<std::vector<T>>() path which Embind wires for all
// number-like typed arrays.
std::vector<double> jsToPixels(const val& pixelsJs) {
    // The VectorFromJSArray helper returned by Embind accepts both
    // plain Array and typed arrays. It copies into a new vector of
    // doubles; for the 784-pixel path this is a negligible one-time
    // copy.
    return emscripten::vecFromJSArray<double>(pixelsJs);
}

val toFloatArray(const std::vector<double>& src) {
    val arr = val::array();
    for (std::size_t i = 0; i < src.size(); ++i) {
        arr.set(i, src[i]);
    }
    return arr;
}

/*
 * Adaptive micro-timing: run `fn` until at least `minTotalMs` of wall
 * time has accumulated (or `maxIters`), never fewer than `minIters`
 * runs, and report the mean per-iteration milliseconds plus the count.
 * Single-shot timing at sub-millisecond scale is dominated by timer
 * quantization and scheduling noise; a bounded mean is stable enough
 * for a live readout while keeping the per-stroke budget ~10ms.
 */
struct TimedMean {
    double meanMs;
    int iters;
};

template <typename F>
TimedMean timeMeanMs(F&& fn, int minIters, int maxIters, double minTotalMs) {
    using clock = std::chrono::steady_clock;
    const auto t0 = clock::now();
    int iters = 0;
    double elapsed = 0.0;
    while (iters < minIters || (elapsed < minTotalMs && iters < maxIters)) {
        fn();
        ++iters;
        elapsed =
            std::chrono::duration<double, std::milli>(clock::now() - t0)
                .count();
    }
    return {elapsed / iters, iters};
}

/*
 * Scalar reference forward pass with loop vectorization explicitly
 * disabled. This reference runs the same math with vector lanes off
 * (scalar unrolling and every other -O3 optimization stay enabled).
 * Timing the two on the same input, same weights, same machine isolates
 * exactly what SIMD buys — mirroring apps/server.cpp's
 * baseline_gemv_sigmoid, which is "intentionally NOT optimized to
 * provide a fair comparison".
 *
 * This used to say the regular path is "LLVM-autovectorized to wasm
 * simd128". It is not, and the whole landing page argues the opposite:
 * LLVM declines this reduction loop, which is why the kernel is
 * hand-written. src/NeuralNet.cpp:28 selects `__wasm_simd128__` and
 * line 238 dispatches to `dot_wasm128_rowvec` — the hand-written
 * dual-accumulator f64x2 kernel. The module does compile with
 * -O3 -msimd128, which is what lets that kernel's intrinsics exist;
 * that is not the same as the compiler having vectorized the loop.
 * Corrected 2026-08-13. It mattered because the page's own comments
 * send a skeptical reader to this file.
 */
void novec_gemv_sigmoid(const Matrix& W, const Matrix& b,
                        const std::vector<double>& x,
                        std::vector<double>& y) {
    const std::size_t m = W.height(), n = W.width();
    for (std::size_t i = 0; i < m; ++i) {
        double s = 0.0;
#pragma clang loop vectorize(disable) interleave(disable)
        for (std::size_t k = 0; k < n; ++k) {
            s += W[i][k] * x[k];
        }
        s += b[i][0];
        y[i] = 1.0 / (1.0 + std::exp(-s));
    }
}

/*
 * Which vector ISA this module was built for. Compile-time, mirroring
 * the AVX-512 / AVX2 / NEON selection in src/NeuralNet.cpp.
 */
std::string buildInfo() {
#if defined(__wasm_simd128__)
    return "simd128";
#else
    return "wasm scalar";
#endif
}

} // namespace

/**
 * Thin JS-facing shim around a NeuralNet. The class is default
 * constructed with the canonical 784->100->10 topology; loadBinary
 * then rebuilds the layer sizes, biases, and weights to match the
 * payload. This keeps construction cheap (no weight init) and lets
 * the JS side treat model loading as an async one-shot step.
 */
class WasmClassifier {
  public:
    WasmClassifier() : net_({784, 100, 10}) {}

    /**
     * Replace the network's weights and biases with the contents of
     * the supplied binary payload. The string is used purely as a
     * byte container (Embind marshals JS Uint8Array to std::string
     * cleanly when the string overload is selected).
     */
    void loadWeightsFromBinary(const std::string& bytes) {
        if (bytes.empty()) {
            throw std::runtime_error("weights buffer is empty");
        }
        net_.loadBinary(
            reinterpret_cast<const unsigned char*>(bytes.data()),
            bytes.size());
    }

    /**
     * Run forward inference on a 784-long pixel vector and return a
     * JS object matching the HTTP /predict response shape.
     */
    val classify(const val& pixelsJs) {
        std::vector<double> pixels = jsToPixels(pixelsJs);
        if (pixels.size() != 784) {
            throw std::runtime_error(
                "expected 784 pixels, got " + std::to_string(pixels.size()));
        }

        Matrix input(784, 1, Matrix::NoInit{});
        for (std::size_t i = 0; i < 784; ++i) {
            input[i][0] = pixels[i];
        }

        // ── Live SIMD-vs-scalar measurement ──────────────────────────
        // Time ONLY the forward pass (classify), in C++, so the readout
        // excludes Embind marshalling and the saliency backward pass
        // (which is documented below as "not timed"). Two variants run
        // on the same input and weights:
        //   simd   — the module's regular path, i.e. the hand-written
        //            dot_wasm128_rowvec kernel in src/NeuralNet.cpp
        //   scalar — novec_gemv_sigmoid, vector lanes disabled
        double sink = 0.0;
        const TimedMean simd = timeMeanMs(
            [&] {
                Matrix out = net_.classify(input);
                sink += out[0][0];
            },
            3, 60, 5.0);

        const auto& weights = net_.getWeights();
        const auto& biases = net_.getBiases();
        std::vector<double> x(784);
        for (std::size_t i = 0; i < 784; ++i) {
            x[i] = pixels[i];
        }
        std::vector<double> h1(weights[0].height());
        std::vector<double> o1(weights[1].height());
        const TimedMean scalar = timeMeanMs(
            [&] {
                novec_gemv_sigmoid(weights[0], biases[0], x, h1);
                novec_gemv_sigmoid(weights[1], biases[1], h1, o1);
                sink += o1[0];
            },
            3, 60, 5.0);
        (void)sink;

        // Forward pass with hidden-layer capture (untimed). The returned
        // matrix is the post-sigmoid output layer, not raw logits.
        std::vector<double> hidden;
        Matrix outputs = net_.classifyWithHidden(input, hidden);

        // argmax over the raw network outputs. The output layer is
        // sigmoid, so each out[i] is already a per-class score in [0, 1]
        // and the winning class saturates near 0.9999.
        std::vector<double> confidence(outputs.height());
        int prediction = 0;
        double maxVal = outputs[0][0];
        for (std::size_t i = 0; i < outputs.height(); ++i) {
            confidence[i] = outputs[i][0];
            if (outputs[i][0] > maxVal) {
                maxVal = outputs[i][0];
                prediction = static_cast<int>(i);
            }
        }
        // L1-normalize the non-negative sigmoid outputs so the reported
        // distribution sums to 1. Do NOT softmax/exp here: exponentiating
        // already-saturated sigmoids squashes a near-certain prediction
        // toward uniform (a confident digit would read ~0.23 instead of
        // ~0.999), which makes the demo look far less accurate than the
        // model actually is.
        double sum = 0.0;
        for (std::size_t i = 0; i < confidence.size(); ++i) {
            sum += confidence[i];
        }
        if (sum > 0.0) {
            for (double& c : confidence) c /= sum;
        }

        // Saliency: gradient of the predicted-class activation wrt
        // the input pixels. Single pass, not timed -- the UI treats
        // this as an interpretability bonus, not part of the hot
        // inference loop.
        std::vector<double> inputGrad;
        net_.computeInputGradient(input, prediction, inputGrad);

        val result = val::object();
        result.set("prediction", prediction);
        result.set("confidence", toFloatArray(confidence));
        result.set("hidden_activations", toFloatArray(hidden));
        result.set("input_grad", toFloatArray(inputGrad));
        // Forward-only means, measured in C++ (marshalling + saliency
        // excluded). "baseline" = vectorization disabled; "optimized" =
        // the module's simd128 path. Field names match server.cpp's
        // /predict response shape.
        result.set("baseline_time_ms", scalar.meanMs);
        result.set("optimized_time_ms", simd.meanMs);
        result.set("timing_iters_simd", simd.iters);
        result.set("timing_iters_scalar", scalar.iters);
        return result;
    }

  private:
    NeuralNet net_;
};

EMSCRIPTEN_BINDINGS(fast_mnist) {
    emscripten::class_<WasmClassifier>("WasmClassifier")
        .constructor<>()
        .function("loadWeightsFromBinary",
                  &WasmClassifier::loadWeightsFromBinary)
        .function("classify", &WasmClassifier::classify);
    emscripten::function("buildInfo", &buildInfo);
}
