#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <numeric>
#include <random>
#include <sstream>
#include <stdexcept>
#include <vector>

#include "fast_mnist/Matrix.h"
#include "fast_mnist/NeuralNet.h"

namespace {

// Shim that exposes NeuralNet's protected static helpers so tests can
// validate sigmoid/invSigmoid directly without shelling them through a
// full forward pass.
class NeuralNetSpy : public NeuralNet {
  public:
    using NeuralNet::invSigmoid;
    using NeuralNet::sigmoid;
    NeuralNetSpy() : NeuralNet({1, 1}) {}
};

// Build the serialized form of a zero-weight 2-2-2 net. Useful for
// sanity-checking the stream operators on a trivial fixture.
std::string makeZeroNetStream() {
    Matrix layerSizes(1, 3, 0.0);
    layerSizes[0][0] = 2.0;
    layerSizes[0][1] = 2.0;
    layerSizes[0][2] = 2.0;

    Matrix b1(2, 1, 0.0);
    Matrix b2(2, 1, 0.0);
    Matrix w1(2, 2, 0.0);
    Matrix w2(2, 2, 0.0);

    std::ostringstream os;
    os.precision(17);
    os << layerSizes << '\n' << b1 << '\n' << b2 << '\n'
       << w1 << '\n' << w2 << '\n';
    return os.str();
}

// Build a 2-3-2 network with small hand-picked weights so that the
// forward pass produces predictable, non-trivial activations for
// interpretability tests.
std::string makeTinyNetStream() {
    Matrix layerSizes(1, 3, 0.0);
    layerSizes[0][0] = 2.0;
    layerSizes[0][1] = 3.0;
    layerSizes[0][2] = 2.0;

    Matrix b1(3, 1, 0.0);
    b1[0][0] = 0.1;  b1[1][0] = -0.2; b1[2][0] = 0.05;

    Matrix b2(2, 1, 0.0);
    b2[0][0] = -0.1; b2[1][0] = 0.2;

    Matrix w1(3, 2, 0.0);
    w1[0][0] =  0.5; w1[0][1] = -0.3;
    w1[1][0] =  0.1; w1[1][1] =  0.4;
    w1[2][0] = -0.2; w1[2][1] =  0.7;

    Matrix w2(2, 3, 0.0);
    w2[0][0] =  0.3; w2[0][1] = -0.5; w2[0][2] = 0.2;
    w2[1][0] = -0.1; w2[1][1] =  0.6; w2[1][2] = 0.4;

    std::ostringstream os;
    os.precision(17);
    os << layerSizes << '\n' << b1 << '\n' << b2 << '\n'
       << w1 << '\n' << w2 << '\n';
    return os.str();
}

} // namespace

// ---------------------------------------------------------------------------
// Forward pass: stream round-trip, hidden activations, consistency
// ---------------------------------------------------------------------------
TEST_CASE("NeuralNet loads from stream", "[neural_net][io]") {
    NeuralNet net({1, 1});
    std::istringstream is(makeZeroNetStream());
    is >> net;

    Matrix input(2, 1, 0.0);
    input[0][0] = 1.0;
    input[1][0] = 1.0;

    Matrix out = net.classify(input);

    REQUIRE(out.height() == 2);
    REQUIRE(out.width() == 1);
    // All weights + biases zero -> sigmoid(0) = 0.5 on every layer.
    REQUIRE(out[0][0] == Catch::Approx(0.5));
    REQUIRE(out[1][0] == Catch::Approx(0.5));
}

TEST_CASE("Multi-layer stream round-trip preserves classification",
          "[neural_net][io]") {
    // Use a non-trivial 3-layer {4, 5, 3} net so the serialized form
    // carries two weight matrices with different shapes. A silent
    // shape mismatch in the reader would almost certainly produce
    // different output activations on the same input.
    NeuralNet original({4, 5, 3});

    // Same fixed input for both forward passes.
    Matrix input(4, 1, 0.0);
    input[0][0] = 0.1;
    input[1][0] = -0.4;
    input[2][0] = 0.7;
    input[3][0] = 0.25;

    Matrix originalOut = original.classify(input);

    std::stringstream ss;
    ss.precision(17);
    ss << original;

    NeuralNet loaded({1, 1});
    ss >> loaded;

    Matrix loadedOut = loaded.classify(input);
    REQUIRE(loadedOut.height() == originalOut.height());
    REQUIRE(loadedOut.width() == originalOut.width());
    for (std::size_t i = 0; i < originalOut.height(); ++i) {
        REQUIRE(loadedOut[i][0] == Catch::Approx(originalOut[i][0]));
    }
}

TEST_CASE("classifyWithHidden exposes hidden activations",
          "[neural_net][interpretability]") {
    NeuralNet net({1, 1});
    std::istringstream is(makeTinyNetStream());
    is >> net;

    Matrix input(2, 1, 0.0);
    input[0][0] = 1.0;
    input[1][0] = 0.0;

    std::vector<Val> hidden;
    Matrix out = net.classifyWithHidden(input, hidden);

    REQUIRE(hidden.size() == 3);
    for (double h : hidden) {
        REQUIRE(h > 0.0);
        REQUIRE(h < 1.0);
    }

    Matrix refOut = net.classify(input);
    REQUIRE(out.height() == refOut.height());
    REQUIRE(out[0][0] == Catch::Approx(refOut[0][0]));
    REQUIRE(out[1][0] == Catch::Approx(refOut[1][0]));
}

TEST_CASE("NeuralNet classify rejects mismatched input shape",
          "[neural_net][contract]") {
    NeuralNet net({2, 3, 1});
    Matrix wrongInput(3, 1, 0.0);

    REQUIRE_THROWS_AS(net.classify(wrongInput), std::invalid_argument);
}

TEST_CASE("NeuralNet learn rejects mismatched expected output shape",
          "[neural_net][contract]") {
    NeuralNet net({2, 3, 1});
    Matrix input(2, 1, 0.0);
    Matrix wrongExpected(2, 1, 0.0);

    REQUIRE_THROWS_AS(net.learn(input, wrongExpected), std::invalid_argument);
}

TEST_CASE("classifyWithHidden is deterministic across repeated calls",
          "[neural_net][interpretability]") {
    NeuralNet net({1, 1});
    std::istringstream is(makeTinyNetStream());
    is >> net;

    Matrix input(2, 1, 0.0);
    input[0][0] = 0.42;
    input[1][0] = -0.17;

    std::vector<Val> hidden1, hidden2;
    Matrix out1 = net.classifyWithHidden(input, hidden1);
    Matrix out2 = net.classifyWithHidden(input, hidden2);

    REQUIRE(hidden1.size() == hidden2.size());
    for (std::size_t i = 0; i < hidden1.size(); ++i) {
        // Forward pass is pure arithmetic on the same inputs + weights,
        // so bit-equality is the right contract here: any drift would
        // indicate hidden static state or UB.
        REQUIRE(hidden1[i] == hidden2[i]);
    }
    for (std::size_t i = 0; i < out1.height(); ++i) {
        REQUIRE(out1[i][0] == out2[i][0]);
    }
}

// ---------------------------------------------------------------------------
// Binary weight format (for WASM offline mode)
// ---------------------------------------------------------------------------

TEST_CASE("loadBinary round-trips a tiny network",
          "[neural_net][binary_weights]") {
    NeuralNet src({1, 1});
    {
        std::istringstream is(makeTinyNetStream());
        is >> src;
    }

    // Manually hand-build the binary payload that export_weights
    // would produce for this network, mirroring the documented
    // layout in include/fast_mnist/NeuralNet.h.
    const std::uint32_t magic = 0x464D4E4Eu;
    const std::uint32_t version = 1u;
    const std::uint32_t layerCount = 3u;
    const std::uint32_t dims[3] = {2u, 3u, 2u};

    std::vector<unsigned char> buf;
    auto appendU32 = [&](std::uint32_t v) {
        const unsigned char* p = reinterpret_cast<const unsigned char*>(&v);
        buf.insert(buf.end(), p, p + 4);
    };
    auto appendF32 = [&](float v) {
        const unsigned char* p = reinterpret_cast<const unsigned char*>(&v);
        buf.insert(buf.end(), p, p + 4);
    };

    appendU32(magic);
    appendU32(version);
    appendU32(layerCount);
    for (std::uint32_t d : dims) appendU32(d);

    for (const auto& b : src.getBiases()) {
        for (std::size_t r = 0; r < b.height(); ++r) {
            appendF32(static_cast<float>(b[r][0]));
        }
    }
    for (const auto& w : src.getWeights()) {
        for (std::size_t r = 0; r < w.height(); ++r) {
            for (std::size_t c = 0; c < w.width(); ++c) {
                appendF32(static_cast<float>(w[r][c]));
            }
        }
    }

    NeuralNet restored({1, 1});
    restored.loadBinary(buf.data(), buf.size());

    Matrix input(2, 1, 0.0);
    input[0][0] = 1.0;
    input[1][0] = 0.0;

    Matrix outSrc = src.classify(input);
    Matrix outRestored = restored.classify(input);

    REQUIRE(outRestored.height() == outSrc.height());
    // Loose tolerance -- double -> float32 -> double round-trip
    // drops ~7 decimal digits of precision.
    for (std::size_t i = 0; i < outSrc.height(); ++i) {
        REQUIRE(outRestored[i][0] ==
                Catch::Approx(outSrc[i][0]).margin(1e-5));
    }
}

TEST_CASE("loadBinary rejects bad magic", "[neural_net][binary_weights]") {
    NeuralNet net({1, 1});
    unsigned char bad[12] = {0};
    REQUIRE_THROWS(net.loadBinary(bad, sizeof(bad)));
}

// ---------------------------------------------------------------------------
// Backward pass / saliency
// ---------------------------------------------------------------------------

TEST_CASE("computeInputGradient returns input-sized saliency",
          "[neural_net][interpretability]") {
    NeuralNet net({1, 1});
    std::istringstream is(makeTinyNetStream());
    is >> net;

    Matrix input(2, 1, 0.0);
    input[0][0] = 1.0;
    input[1][0] = 0.0;

    std::vector<Val> grad;
    net.computeInputGradient(input, 0, grad);

    REQUIRE(grad.size() == 2);

    // For this hand-picked network the gradient must be non-zero in
    // at least one component -- a trivial zero response would mean
    // backprop is dropping the signal.
    const bool anyNonZero =
        std::abs(grad[0]) > 1e-12 || std::abs(grad[1]) > 1e-12;
    REQUIRE(anyNonZero);

    // Finite-difference sanity check: perturb each input pixel and
    // compare (f(x+e) - f(x)) / eps against the analytic gradient
    // of the class-0 output activation.
    const double eps = 1e-6;
    Matrix baseOut = net.classify(input);
    for (int i = 0; i < 2; ++i) {
        Matrix perturbed(2, 1, 0.0);
        perturbed[0][0] = input[0][0];
        perturbed[1][0] = input[1][0];
        perturbed[i][0] += eps;
        Matrix pOut = net.classify(perturbed);
        const double fdGrad = (pOut[0][0] - baseOut[0][0]) / eps;
        REQUIRE(std::abs(grad[i] - fdGrad) < 5e-4);
    }
}

TEST_CASE("computeInputGradient agrees with finite differences within 5%",
          "[neural_net][interpretability]") {
    NeuralNet net({1, 1});
    std::istringstream is(makeTinyNetStream());
    is >> net;

    // Input chosen so all activations sit well inside (0.1, 0.9) --
    // keeps a*(1-a) large enough that the 1e-6 finite-difference
    // noise stays below the relative-error tolerance.
    Matrix input(2, 1, 0.0);
    input[0][0] = 0.3;
    input[1][0] = -0.2;

    // Cycle through each target class -- any drift between forward
    // and backward across classes would show up here.
    for (int target = 0; target < 2; ++target) {
        std::vector<Val> grad;
        net.computeInputGradient(input, target, grad);
        REQUIRE(grad.size() == 2);

        const double eps = 1e-6;
        Matrix baseOut = net.classify(input);
        for (int i = 0; i < 2; ++i) {
            Matrix perturbed = input;
            perturbed[i][0] += eps;
            Matrix pOut = net.classify(perturbed);
            const double fd =
                (pOut[target][0] - baseOut[target][0]) / eps;

            // Relative error, floored at an absolute tolerance so we
            // don't blow up on gradients that are essentially zero.
            const double denom =
                std::max(std::abs(fd), 1e-4);
            const double relErr = std::abs(grad[i] - fd) / denom;
            REQUIRE(relErr < 0.05);
        }
    }
}

// ---------------------------------------------------------------------------
// Weight init sanity
// ---------------------------------------------------------------------------
TEST_CASE("Xavier init produces zero-mean, ~1/sqrt(fan_in) stddev weights",
          "[neural_net][init]") {
    // Large-ish hidden layer so the sample is big enough to get
    // stable moments out of a single draw. initBiasAndWeightMatrices
    // uses a static RNG seeded from std::random_device, which is why
    // this test uses broad 50% tolerances instead of tight bounds.
    const int fanIn = 256;
    const int hidden = 128;
    NeuralNet net({fanIn, hidden, 10});
    const auto& weights = net.getWeights();
    REQUIRE(weights.size() == 2);

    const Matrix& W0 = weights[0];
    REQUIRE(W0.height() == static_cast<std::size_t>(hidden));
    REQUIRE(W0.width() == static_cast<std::size_t>(fanIn));

    // Compute mean + stddev across the hidden x fan_in block.
    double sum = 0.0, sumSq = 0.0;
    std::size_t n = 0;
    for (std::size_t r = 0; r < W0.height(); ++r) {
        for (std::size_t c = 0; c < W0.width(); ++c) {
            const double w = W0[r][c];
            sum += w;
            sumSq += w * w;
            ++n;
        }
    }
    const double mean = sum / static_cast<double>(n);
    const double var =
        sumSq / static_cast<double>(n) - mean * mean;
    const double stddev = std::sqrt(var);
    const double expectedStddev = 1.0 / std::sqrt(static_cast<double>(fanIn));

    // Mean should be small relative to stddev.
    REQUIRE(std::abs(mean) < 0.2 * expectedStddev);
    // Stddev within 50% of the Xavier target.
    REQUIRE(stddev > 0.5 * expectedStddev);
    REQUIRE(stddev < 1.5 * expectedStddev);
}

// ---------------------------------------------------------------------------
// Learning on XOR
// ---------------------------------------------------------------------------
TEST_CASE("NeuralNet learns XOR within 20k SGD steps",
          "[neural_net][learning][slow]") {
    // A 2-4-1 net is overkill for XOR but keeps the training budget
    // well inside the sanitizer CI cell's time envelope. Tag [.slow]
    // so it's still discoverable via `ctest -L slow`; default run
    // executes it.
    std::mt19937 gen(42);
    std::uniform_real_distribution<double> dist(0.0, 1.0);

    // Training data: the 4 XOR points.
    const double X[4][2] = {{0, 0}, {0, 1}, {1, 0}, {1, 1}};
    const double Y[4] = {0, 1, 1, 0};

    // Single best-of-N attempt; the RNG is std::random_device in
    // initBiasAndWeightMatrices so we cannot seed it from here, and
    // a single 2-4-1 net occasionally fails to escape a bad init.
    // Try up to 3 fresh initialisations; 20k steps each is still
    // under one sanitizer-cell second.
    bool converged = false;
    for (int attempt = 0; attempt < 3 && !converged; ++attempt) {
        NeuralNet net({2, 4, 1});

        Matrix in(2, 1, 0.0);
        Matrix target(1, 1, 0.0);

        const int iters = 20000;
        for (int step = 0; step < iters; ++step) {
            const int idx = step % 4;
            in[0][0] = X[idx][0];
            in[1][0] = X[idx][1];
            target[0][0] = Y[idx];
            net.learn(in, target, 1.0);
        }

        int correct = 0;
        for (int i = 0; i < 4; ++i) {
            in[0][0] = X[i][0];
            in[1][0] = X[i][1];
            Matrix out = net.classify(in);
            const double predicted = out[0][0] >= 0.5 ? 1.0 : 0.0;
            if (predicted == Y[i])
                ++correct;
        }
        if (correct == 4) {
            converged = true;
        }

        // Suppress the unused dist/gen warning the CI compilers
        // sometimes emit; they are kept for future extensions.
        (void)dist;
        (void)gen;
    }

    REQUIRE(converged);
}

// ---------------------------------------------------------------------------
// Activation + derivative sanity
// ---------------------------------------------------------------------------
TEST_CASE("sigmoid and invSigmoid match analytic values",
          "[neural_net][activation]") {
    // sigmoid(0) is exactly 1/2 in IEEE-754 arithmetic: exp(-0)=1,
    // 1/(1+1) = 0.5. Any drift here would point to a broken
    // activation function.
    REQUIRE(NeuralNetSpy::sigmoid(0.0) == 0.5);

    // Saturates cleanly at large positive arguments.
    REQUIRE(NeuralNetSpy::sigmoid(1000.0) == Catch::Approx(1.0));
    // And at large negative arguments.
    REQUIRE(NeuralNetSpy::sigmoid(-1000.0) == Catch::Approx(0.0));

    // invSigmoid(x) = sigmoid(x) * (1 - sigmoid(x)) = sigma'(x).
    // At x=0 this is 0.5 * 0.5 = 0.25.
    REQUIRE(NeuralNetSpy::invSigmoid(0.0) == Catch::Approx(0.25));

    // Validate the analytic derivative against a centered
    // finite-difference of sigmoid at a few probe points.
    for (double x : {-2.0, -0.5, 0.5, 2.0}) {
        const double eps = 1e-5;
        const double fd =
            (NeuralNetSpy::sigmoid(x + eps) - NeuralNetSpy::sigmoid(x - eps))
            / (2.0 * eps);
        REQUIRE(std::abs(NeuralNetSpy::invSigmoid(x) - fd) < 1e-6);
    }
}
