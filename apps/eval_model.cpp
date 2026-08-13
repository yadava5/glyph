/**
 * \file eval_model.cpp
 * \brief Full-test-set evaluator that emits a committed, machine-readable
 *        accuracy artifact.
 *
 * The headline accuracy figure quoted across this repository (README,
 * booklet, web frontend) used to exist only as a hand-typed literal with
 * no run artifact behind it. This tool is the measurement: it walks the
 * entire testing-set list, classifies every image with the committed
 * weights, and writes
 *
 *   - benchmarks/mnist_eval.json           machine-readable, the source of truth
 *   - benchmarks/mnist_eval.txt            human-readable transcript
 *   - benchmarks/mnist_misclassified.csv   compact per-error record
 *
 * Unlike apps/test_model.cpp (a spot-check that only counts matches),
 * this records *which* images are wrong, so a downstream renderer can
 * draw the real errors rather than stand-ins.
 *
 * Usage:
 *   fast_mnist_eval [model] [dataDir] [listFile] [outDir] [--f32-weights[=bin]]
 * Defaults:
 *   model.weights  data  TestingSetList.txt  benchmarks
 *
 * --f32-weights switches the tool into a second, strictly opt-in mode
 * that answers a different question: the browser does NOT run the ASCII
 * checkpoint. It fetches web/public/wasm/model.weights.bin, the float32
 * export produced by apps/export_weights.cpp, and widens it back to
 * double. So the landing page's "re-run the claim in your browser"
 * promise is only honest if the f32 export predicts the same 10,000
 * labels as the double checkpoint. This mode measures that: it loads
 * both networks, classifies every image with each, and writes
 *
 *   benchmarks/mnist_f32_flips.json    every prediction that changed
 *
 * and nothing else -- the three artifacts above are left untouched, so
 * the committed 97.01% record can never be clobbered by this mode.
 */

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "fast_mnist/Matrix.h"
#include "fast_mnist/NeuralNet.h"

namespace fs = std::filesystem;

namespace {

constexpr int kClasses = 10;

// ---------------------------------------------------------------------------
// SHA-256 (FIPS 180-4). Self-contained so the emitted artifact records a
// checksum of the exact weights file that produced it, verifiable from a
// shell with `shasum -a 256 model.weights`.
// ---------------------------------------------------------------------------

class Sha256 {
  public:
    Sha256() = default;

    void update(const std::uint8_t* data, std::size_t len) {
        for (std::size_t i = 0; i < len; ++i) {
            buffer_[bufLen_++] = data[i];
            if (bufLen_ == 64) {
                transform(buffer_.data());
                bitLen_ += 512;
                bufLen_ = 0;
            }
        }
    }

    std::string hexDigest() {
        std::array<std::uint8_t, 64> block = buffer_;
        std::size_t i = bufLen_;
        const std::uint64_t totalBits = bitLen_ + std::uint64_t(bufLen_) * 8;

        block[i++] = 0x80;
        if (i > 56) {
            while (i < 64) block[i++] = 0;
            transform(block.data());
            i = 0;
        }
        while (i < 56) block[i++] = 0;
        for (int b = 7; b >= 0; --b) {
            block[i++] = static_cast<std::uint8_t>(totalBits >> (b * 8));
        }
        transform(block.data());

        std::ostringstream os;
        os << std::hex << std::setfill('0');
        for (std::uint32_t h : state_) os << std::setw(8) << h;
        return os.str();
    }

  private:
    static std::uint32_t rotr(std::uint32_t x, std::uint32_t n) {
        return (x >> n) | (x << (32 - n));
    }

    void transform(const std::uint8_t* chunk) {
        static const std::uint32_t k[64] = {
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
            0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
            0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
            0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
            0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
            0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
            0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
            0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
            0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
            0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};

        std::uint32_t w[64];
        for (int i = 0; i < 16; ++i) {
            w[i] = (std::uint32_t(chunk[i * 4]) << 24) |
                   (std::uint32_t(chunk[i * 4 + 1]) << 16) |
                   (std::uint32_t(chunk[i * 4 + 2]) << 8) |
                   std::uint32_t(chunk[i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            const std::uint32_t s0 =
                rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
            const std::uint32_t s1 =
                rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        std::uint32_t a = state_[0], b = state_[1], c = state_[2],
                      d = state_[3], e = state_[4], f = state_[5],
                      g = state_[6], h = state_[7];

        for (int i = 0; i < 64; ++i) {
            const std::uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const std::uint32_t ch = (e & f) ^ (~e & g);
            const std::uint32_t t1 = h + S1 + ch + k[i] + w[i];
            const std::uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const std::uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            const std::uint32_t t2 = S0 + maj;
            h = g; g = f; f = e; e = d + t1;
            d = c; c = b; b = a; a = t1 + t2;
        }

        state_[0] += a; state_[1] += b; state_[2] += c; state_[3] += d;
        state_[4] += e; state_[5] += f; state_[6] += g; state_[7] += h;
    }

    std::array<std::uint32_t, 8> state_{0x6a09e667, 0xbb67ae85, 0x3c6ef372,
                                        0xa54ff53a, 0x510e527f, 0x9b05688c,
                                        0x1f83d9ab, 0x5be0cd19};
    std::array<std::uint8_t, 64> buffer_{};
    std::size_t bufLen_{0};
    std::uint64_t bitLen_{0};
};

/** Compute the SHA-256 of a file, or an empty string if unreadable. */
std::string sha256File(const std::string& path, std::uintmax_t& sizeOut) {
    std::ifstream in(path, std::ios::binary);
    if (!in) return {};
    Sha256 sha;
    std::vector<char> buf(1 << 16);
    std::uintmax_t total = 0;
    while (in) {
        in.read(buf.data(), static_cast<std::streamsize>(buf.size()));
        const std::streamsize got = in.gcount();
        if (got <= 0) break;
        total += static_cast<std::uintmax_t>(got);
        sha.update(reinterpret_cast<const std::uint8_t*>(buf.data()),
                   static_cast<std::size_t>(got));
    }
    sizeOut = total;
    return sha.hexDigest();
}

// ---------------------------------------------------------------------------
// PGM loading (ASCII P2, normalized to [0, 1]) -- mirrors apps/test_model.cpp
// so the measurement path matches the shipped inference path exactly.
// ---------------------------------------------------------------------------

Matrix loadPGM(const std::string& path) {
    std::ifstream file(path, std::ios::binary);
    if (!file) {
        throw std::runtime_error("Unable to read " + path);
    }

    std::string buf((std::istreambuf_iterator<char>(file)),
                    std::istreambuf_iterator<char>());
    const char* p = buf.data();
    const char* e = p + buf.size();

    auto skipSpaceAndComments = [&]() {
        while (p < e) {
            while (p < e && static_cast<unsigned char>(*p) <= ' ') ++p;
            if (p < e && *p == '#') {
                while (p < e && *p != '\n') ++p;
                continue;
            }
            break;
        }
    };

    auto parseInt = [&]() -> int {
        skipSpaceAndComments();
        int v = 0;
        while (p < e && *p >= '0' && *p <= '9') {
            v = v * 10 + (*p - '0');
            ++p;
        }
        return v;
    };

    skipSpaceAndComments();
    if (p + 2 > e || p[0] != 'P' || p[1] != '2') {
        throw std::runtime_error("Unsupported PGM: " + path);
    }
    p += 2;

    const int width = parseInt();
    const int height = parseInt();
    const int maxVal = parseInt();
    if (width <= 0 || height <= 0 || maxVal <= 0) {
        throw std::runtime_error("Invalid PGM header: " + path);
    }

    const std::size_t nPix = static_cast<std::size_t>(width) * height;
    Matrix img(nPix, 1, Matrix::NoInit{});
    const double inv = 1.0 / static_cast<double>(maxVal);
    for (std::size_t i = 0; i < nPix; ++i) {
        img[i][0] = static_cast<double>(parseInt()) * inv;
    }
    return img;
}

/**
 * Parse "TestingSet/digit_<ordinal>_<label>.pgm".
 *
 * \return true when both fields parsed; ordinal/label written out.
 */
bool parseNameFields(const std::string& relPath, long& ordinal, int& label) {
    const std::size_t lastSlash = relPath.find_last_of("/\\");
    const std::string base = (lastSlash == std::string::npos)
                                 ? relPath
                                 : relPath.substr(lastSlash + 1);
    const std::size_t u2 = base.rfind('_');
    if (u2 == std::string::npos || u2 + 1 >= base.size()) return false;
    const std::size_t u1 = base.rfind('_', u2 - 1);
    if (u1 == std::string::npos) return false;

    label = base[u2 + 1] - '0';
    if (label < 0 || label > 9) return false;
    try {
        ordinal = std::stol(base.substr(u1 + 1, u2 - u1 - 1));
    } catch (...) {
        return false;
    }
    return true;
}

/** Trim trailing CR so Windows-authored lists parse identically. */
void stripCr(std::string& s) {
    while (!s.empty() && (s.back() == '\r' || s.back() == '\n')) s.pop_back();
}

/** Fixed-precision double formatting for JSON output. */
std::string fixed(double v, int precision) {
    std::ostringstream os;
    os << std::fixed << std::setprecision(precision) << v;
    return os.str();
}

struct ErrorRecord {
    long index;
    std::string file;
    int trueLabel;
    int predLabel;
    double predActivation;
    double trueActivation;
};

// ---------------------------------------------------------------------------
// --f32-weights mode: double checkpoint vs float32 browser export
// ---------------------------------------------------------------------------

/** Scientific formatting, for quantities that live near 1e-8. */
std::string sci(double v, int precision = 6) {
    std::ostringstream os;
    os << std::scientific << std::setprecision(precision) << v;
    return os.str();
}

/**
 * Argmax and runner-up of an output column, using the same tie-break as
 * the main evaluation loop (strict >, scanning upward, so the lowest
 * index wins a tie).
 */
void top2Of(const Matrix& out, int& best, int& second) {
    best = 0;
    for (int i = 1; i < kClasses; ++i) {
        if (out[i][0] > out[best][0]) best = i;
    }
    second = -1;
    for (int i = 0; i < kClasses; ++i) {
        if (i == best) continue;
        if (second < 0 || out[i][0] > out[second][0]) second = i;
    }
}

/** An image whose argmax differs between the two weight precisions. */
struct FlipRecord {
    long index;
    std::string file;
    int trueLabel;
    int predDouble;
    int predF32;
    double dblActPredDouble;  // a_double[predDouble]
    double dblActPredF32;     // a_double[predF32]
    double f32ActPredDouble;  // a_f32[predDouble]
    double f32ActPredF32;     // a_f32[predF32]
};

/**
 * Per-image argmax margin. \c top1/\c top2 are chosen in the double
 * regime; the f32 activations are read from those same two neurons so
 * the margin is directly comparable.
 */
struct MarginRecord {
    long index;
    std::string file;
    int trueLabel;
    int top1;
    int top2;
    double a1Double, a2Double;
    double a1F32, a2F32;
    int predF32;

    double marginDouble() const { return a1Double - a2Double; }
    double marginF32() const { return a1F32 - a2F32; }
};

/** Emit one margin record as a JSON object (no trailing comma). */
void writeMarginJson(std::ostream& j, const MarginRecord& m,
                     const char* indent) {
    j << indent << "{ \"index\": " << m.index << ", \"file\": \"" << m.file
      << "\", \"true\": " << m.trueLabel << ", \"top1\": " << m.top1
      << ", \"top2\": " << m.top2
      << ", \"margin_double\": " << sci(m.marginDouble())
      << ", \"margin_f32\": " << sci(m.marginF32())
      << ", \"margin_shift\": " << sci(m.marginF32() - m.marginDouble())
      << ", \"pred_f32\": " << m.predF32
      << ", \"flipped\": " << (m.predF32 != m.top1 ? "true" : "false") << " }";
}

/**
 * Compare the committed double checkpoint against the float32 binary
 * export over the whole test set and write benchmarks/mnist_f32_flips.json.
 *
 * The f32 network is not re-derived here: it is loaded from the exact
 * bytes the browser downloads, through the same NeuralNet::loadBinary
 * the wasm module uses. A parameter-by-parameter check then proves that
 * those bytes are bit-identical to static_cast<double>(static_cast<float>(w))
 * of the ASCII checkpoint, so "load the shipped .bin" and "round every
 * weight through float" are provably the same experiment.
 *
 * \return process exit status.
 */
int runF32Compare(const NeuralNet& netDouble, const std::string& modelPath,
                  std::uintmax_t modelBytes, const std::string& modelSha,
                  const std::string& binPath, const std::string& dataPath,
                  const std::string& listPath, const std::string& outDir) {
    std::uintmax_t binBytes = 0;
    const std::string binSha = sha256File(binPath, binBytes);
    if (binSha.empty()) {
        std::cerr << "Error: cannot read binary weights: " << binPath << "\n";
        return 1;
    }

    std::vector<unsigned char> blob;
    {
        std::ifstream in(binPath, std::ios::binary);
        if (!in) {
            std::cerr << "Error: cannot open " << binPath << "\n";
            return 1;
        }
        blob.assign(std::istreambuf_iterator<char>(in),
                    std::istreambuf_iterator<char>());
    }

    NeuralNet netF32({784, 100, 10});
    try {
        netF32.loadBinary(blob.data(), blob.size());
    } catch (const std::exception& e) {
        std::cerr << "Error: " << binPath << ": " << e.what() << "\n";
        return 1;
    }
    std::cout << "F32    : " << binPath << " (" << binBytes << " bytes, sha256 "
              << binSha.substr(0, 16) << "...)\n";

    // ---- parameter equivalence: is the .bin exactly the f32 rounding? -----
    std::size_t params = 0, mismatches = 0;
    double maxAbsWeightDelta = 0.0;
    {
        const MatrixVec& wd = netDouble.getWeights();
        const MatrixVec& wf = netF32.getWeights();
        const MatrixVec& bd = netDouble.getBiases();
        const MatrixVec& bf = netF32.getBiases();
        if (wd.size() != wf.size() || bd.size() != bf.size()) {
            std::cerr << "Error: layer count differs between " << modelPath
                      << " and " << binPath << "\n";
            return 1;
        }
        auto compare = [&](const MatrixVec& a, const MatrixVec& b) -> bool {
            for (std::size_t l = 0; l < a.size(); ++l) {
                if (a[l].height() != b[l].height() ||
                    a[l].width() != b[l].width()) {
                    return false;
                }
                for (std::size_t r = 0; r < a[l].height(); ++r) {
                    for (std::size_t c = 0; c < a[l].width(); ++c) {
                        const double ref = static_cast<double>(
                            static_cast<float>(a[l][r][c]));
                        ++params;
                        if (b[l][r][c] != ref) ++mismatches;
                        maxAbsWeightDelta = std::max(
                            maxAbsWeightDelta, std::fabs(a[l][r][c] - b[l][r][c]));
                    }
                }
            }
            return true;
        };
        if (!compare(bd, bf) || !compare(wd, wf)) {
            std::cerr << "Error: weight/bias shapes differ between "
                      << modelPath << " and " << binPath << "\n";
            return 1;
        }
    }
    std::cout << "Params : " << params << " compared, " << mismatches
              << " differ from static_cast<double>(static_cast<float>(w))\n";
    if (mismatches != 0) {
        std::cerr << "Error: " << binPath << " is not the float32 rounding of "
                  << modelPath << "; the two files are out of sync.\n";
        return 1;
    }

    // ---- classify every image with both networks ---------------------------
    std::ifstream testList(listPath);
    if (!testList) {
        std::cerr << "Error: cannot open list file: " << listPath << "\n"
                  << "The MNIST test set is gitignored; run tools/bootstrap "
                     "to fetch it.\n";
        return 1;
    }

    std::vector<FlipRecord> flips;
    std::vector<MarginRecord> margins;
    margins.reserve(10000);
    long total = 0, correctDouble = 0, correctF32 = 0;
    double maxAbsActDelta = 0.0, sumAbsActDelta = 0.0;
    std::size_t actSamples = 0;

    std::string line;
    while (std::getline(testList, line)) {
        stripCr(line);
        if (line.empty()) continue;

        long ordinal = -1;
        int expected = -1;
        if (!parseNameFields(line, ordinal, expected)) {
            std::cerr << "Error: cannot parse label from '" << line << "'\n";
            return 1;
        }

        const Matrix img = loadPGM((fs::path(dataPath) / line).string());
        // Both networks are 784->100->10 and both go through classify(),
        // so the two forward passes differ only in the weight values.
        const Matrix outD = netDouble.classify(img);
        const Matrix outF = netF32.classify(img);

        int top1D = 0, top2D = 0, top1F = 0, top2F = 0;
        top2Of(outD, top1D, top2D);
        top2Of(outF, top1F, top2F);

        for (int c = 0; c < kClasses; ++c) {
            const double d = std::fabs(outD[c][0] - outF[c][0]);
            maxAbsActDelta = std::max(maxAbsActDelta, d);
            sumAbsActDelta += d;
            ++actSamples;
        }

        if (top1D == expected) ++correctDouble;
        if (top1F == expected) ++correctF32;
        if (top1D != top1F) {
            flips.push_back({total, line, expected, top1D, top1F,
                             outD[top1D][0], outD[top1F][0], outF[top1D][0],
                             outF[top1F][0]});
        }
        margins.push_back({total, line, expected, top1D, top2D, outD[top1D][0],
                           outD[top2D][0], outF[top1D][0], outF[top2D][0],
                           top1F});
        ++total;
    }

    if (total == 0) {
        std::cerr << "Error: list file " << listPath << " yielded 0 images.\n";
        return 1;
    }

    // Tightest double-regime argmax margins: the images where f32 rounding
    // had the best chance of flipping the decision.
    constexpr std::size_t kTightest = 10;
    std::vector<MarginRecord> tightest = margins;
    const std::size_t nTight = std::min(kTightest, tightest.size());
    std::partial_sort(tightest.begin(), tightest.begin() + nTight,
                      tightest.end(),
                      [](const MarginRecord& a, const MarginRecord& b) {
                          return a.marginDouble() < b.marginDouble();
                      });
    tightest.resize(nTight);

    // Indices called out by hand as knife-edge cases in mnist_eval.json.
    const std::array<long, 2> spotIdx{151, 9858};

    long helpful = 0, harmful = 0, neutral = 0;
    for (const FlipRecord& f : flips) {
        if (f.predF32 == f.trueLabel) {
            ++helpful;
        } else if (f.predDouble == f.trueLabel) {
            ++harmful;
        } else {
            ++neutral;
        }
    }

    const double accD = static_cast<double>(correctDouble) / total;
    const double accF = static_cast<double>(correctF32) / total;
    const double meanAbsActDelta =
        actSamples ? sumAbsActDelta / static_cast<double>(actSamples) : 0.0;

    std::cout << "Images : " << total << "\n"
              << "double : " << correctDouble << " correct ("
              << fixed(accD * 100.0, 4) << "%)\n"
              << "f32    : " << correctF32 << " correct ("
              << fixed(accF * 100.0, 4) << "%)\n"
              << "Flips  : " << flips.size() << "  (helpful " << helpful
              << ", harmful " << harmful << ", neutral " << neutral << ")\n"
              << "Tightest double-regime margin: "
              << (tightest.empty() ? std::string("n/a")
                                   : sci(tightest.front().marginDouble()))
              << "\nMax |activation delta|: " << sci(maxAbsActDelta) << "\n";

    fs::create_directories(outDir);
    const std::string jsonPath =
        (fs::path(outDir) / "mnist_f32_flips.json").string();
    std::ofstream j(jsonPath);
    if (!j) {
        std::cerr << "Error: cannot write " << jsonPath << "\n";
        return 1;
    }

    j << "{\n";
    j << "  \"$comment\": [\n"
      << "    \"How many of the 10,000 MNIST test predictions change when the "
         "committed double\",\n"
      << "    \"checkpoint is replaced by the float32 export the browser "
         "actually downloads?\",\n"
      << "    \"benchmarks/mnist_eval.json records 9701/10000 = 97.01% from "
         "model.weights, the\",\n"
      << "    \"800,678-byte ASCII checkpoint at full double precision. The "
         "landing page's wasm\",\n"
      << "    \"path fetches web/public/wasm/model.weights.bin instead -- the "
         "318,064-byte float32\",\n"
      << "    \"export written by apps/export_weights.cpp -- and widens it "
         "back to double on load.\",\n"
      << "    \"If those two disagree, re-running the accuracy claim in a "
         "visitor's browser is not\",\n"
      << "    \"a reproduction of the claim.\",\n"
      << "    \"\",\n"
      << "    \"Produced by: fast_mnist_eval " << modelPath << " " << dataPath
      << " " << listPath << " " << outDir << " --f32-weights\",\n"
      << "    \"after: cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && "
         "cmake --build build --target fast_mnist_eval. The f32\",\n"
      << "    \"network is loaded from the shipped .bin through "
         "NeuralNet::loadBinary, not re-derived;\",\n"
      << "    \"parameter_check below verifies element by element that those "
         "bytes are exactly\",\n"
      << "    \"static_cast<double>(static_cast<float>(w)) of the ASCII "
         "checkpoint.\",\n"
      << "    \"\",\n"
      << "    \"LIMITATION -- this is the QUANTISATION difference only, and it "
         "does not bound the\",\n"
      << "    \"true browser-vs-native delta. Both columns here were computed "
         "by the same native\",\n"
      << "    \"kernel, so two further differences are unmeasured: (1) "
         "reduction order -- the arm64\",\n"
      << "    \"NEON path in src/NeuralNet.cpp accumulates in one f64x2 "
         "accumulator and reduces two\",\n"
      << "    \"lanes, while the wasm simd128 path uses two independent f64x2 "
         "accumulators and\",\n"
      << "    \"reduces four; and (2) FMA contraction -- the NEON kernel uses "
         "vfmaq_f64, so products\",\n"
      << "    \"are never rounded, while wasm simd128 has no FMA and rounds "
         "every product. (2) is\",\n"
      << "    \"plausibly the larger of the two, since it changes rounding at "
         "every multiply rather\",\n"
      << "    \"than only in the reduction tree. The real browser-vs-native "
         "delta can therefore be\",\n"
      << "    \"larger than the number below, and is not bounded by it. "
         "Measuring it requires\",\n"
      << "    \"running the emscripten build itself and diffing against this "
         "native run.\"\n"
      << "  ],\n";
    j << "  \"schema\": \"glyph.mnist_f32_flips/1\",\n";
    j << "  \"generator\": \"apps/eval_model.cpp (fast_mnist_eval "
         "--f32-weights)\",\n";
    j << "  \"weights\": {\n"
      << "    \"double\": { \"path\": \"" << modelPath << "\", \"bytes\": "
      << modelBytes << ", \"sha256\": \"" << modelSha << "\" },\n"
      << "    \"float32\": { \"path\": \"" << binPath << "\", \"bytes\": "
      << binBytes << ", \"sha256\": \"" << binSha << "\" }\n"
      << "  },\n";
    j << "  \"parameter_check\": {\n"
      << "    \"note\": \"every weight and bias in the .bin equals "
         "static_cast<double>(static_cast<float>(w)) of the ASCII value\",\n"
      << "    \"params_compared\": " << params << ",\n"
      << "    \"mismatches\": " << mismatches << ",\n"
      << "    \"max_abs_weight_delta\": " << sci(maxAbsWeightDelta) << "\n"
      << "  },\n";
    j << "  \"dataset\": { \"list\": \"" << listPath << "\", \"root\": \""
      << dataPath << "\", \"images\": " << total << " },\n";
    j << "  \"accuracy\": {\n"
      << "    \"double\": { \"correct\": " << correctDouble
      << ", \"accuracy_pct\": " << fixed(accD * 100.0, 4) << " },\n"
      << "    \"float32\": { \"correct\": " << correctF32
      << ", \"accuracy_pct\": " << fixed(accF * 100.0, 4) << " },\n"
      << "    \"delta_correct\": " << (correctF32 - correctDouble) << "\n"
      << "  },\n";
    j << "  \"flips\": {\n"
      << "    \"note\": \"images whose argmax differs between the two weight "
         "precisions; helpful = f32 right where double was wrong\",\n"
      << "    \"count\": " << flips.size() << ",\n"
      << "    \"helpful\": " << helpful << ",\n"
      << "    \"harmful\": " << harmful << ",\n"
      << "    \"neutral\": " << neutral << ",\n"
      << "    \"indices\": [";
    for (std::size_t i = 0; i < flips.size(); ++i) {
        j << flips[i].index << (i + 1 == flips.size() ? "" : ", ");
    }
    j << "],\n";
    j << "    \"records\": [\n";
    for (std::size_t i = 0; i < flips.size(); ++i) {
        const FlipRecord& f = flips[i];
        const char* verdict = (f.predF32 == f.trueLabel) ? "helpful"
                              : (f.predDouble == f.trueLabel) ? "harmful"
                                                              : "neutral";
        j << "      { \"index\": " << f.index << ", \"file\": \"" << f.file
          << "\", \"true\": " << f.trueLabel
          << ", \"pred_double\": " << f.predDouble
          << ", \"pred_f32\": " << f.predF32
          << ", \"double_activation_of_pred_double\": "
          << fixed(f.dblActPredDouble, 12)
          << ", \"double_activation_of_pred_f32\": "
          << fixed(f.dblActPredF32, 12)
          << ", \"f32_activation_of_pred_double\": "
          << fixed(f.f32ActPredDouble, 12)
          << ", \"f32_activation_of_pred_f32\": " << fixed(f.f32ActPredF32, 12)
          << ", \"margin_double\": "
          << sci(f.dblActPredDouble - f.dblActPredF32)
          << ", \"margin_f32\": " << sci(f.f32ActPredF32 - f.f32ActPredDouble)
          << ", \"verdict\": \"" << verdict << "\" }"
          << (i + 1 == flips.size() ? "\n" : ",\n");
    }
    j << "    ]\n  },\n";
    j << "  \"activation_delta\": {\n"
      << "    \"note\": \"|a_double - a_f32| over all " << actSamples
      << " output activations\",\n"
      << "    \"max_abs\": " << sci(maxAbsActDelta) << ",\n"
      << "    \"mean_abs\": " << sci(meanAbsActDelta) << "\n"
      << "  },\n";
    j << "  \"tightest_margins\": {\n"
      << "    \"note\": \"the " << nTight
      << " smallest double-regime argmax margins (top1 - top2) in the test "
         "set -- the images most exposed to f32 rounding\",\n"
      << "    \"records\": [\n";
    for (std::size_t i = 0; i < tightest.size(); ++i) {
        writeMarginJson(j, tightest[i], "      ");
        j << (i + 1 == tightest.size() ? "\n" : ",\n");
    }
    j << "    ]\n  },\n";
    j << "  \"spot_checks\": {\n"
      << "    \"note\": \"indices named by hand as knife-edge errors; margin "
         "here is top1 - top2, which is not always pred - true\",\n"
      << "    \"records\": [\n";
    for (std::size_t s = 0; s < spotIdx.size(); ++s) {
        const auto it = std::find_if(margins.begin(), margins.end(),
                                     [&](const MarginRecord& m) {
                                         return m.index == spotIdx[s];
                                     });
        if (it == margins.end()) continue;
        writeMarginJson(j, *it, "      ");
        j << (s + 1 == spotIdx.size() ? "\n" : ",\n");
    }
    j << "    ]\n  }\n}\n";

    if (!j) {
        std::cerr << "Error: write failed for " << jsonPath << "\n";
        return 1;
    }
    std::cout << "Wrote " << jsonPath << "\n";
    return 0;
}

}  // namespace

int main(int argc, char* argv[]) {
    // Flags are pulled out first so the positional argument order
    // documented in the header comment is unchanged.
    std::vector<std::string> positional;
    bool f32Mode = false;
    std::string binPath = "web/public/wasm/model.weights.bin";
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg.rfind("--f32-weights", 0) == 0) {
            f32Mode = true;
            const std::size_t eq = arg.find('=');
            if (eq != std::string::npos) binPath = arg.substr(eq + 1);
        } else if (arg.rfind("--", 0) == 0) {
            std::cerr << "Error: unknown flag " << arg << "\n"
                      << "Usage: fast_mnist_eval [model] [dataDir] [listFile] "
                         "[outDir] [--f32-weights[=bin]]\n";
            return 2;
        } else {
            positional.push_back(arg);
        }
    }
    const auto at = [&](std::size_t i, const char* fallback) {
        return i < positional.size() ? positional[i] : std::string(fallback);
    };
    const std::string modelPath = at(0, "model.weights");
    const std::string dataPath  = at(1, "data");
    const std::string listPath  = at(2, "TestingSetList.txt");
    const std::string outDir    = at(3, "benchmarks");

    std::uintmax_t modelBytes = 0;
    const std::string modelSha = sha256File(modelPath, modelBytes);
    if (modelSha.empty()) {
        std::cerr << "Error: cannot read model file: " << modelPath << "\n";
        return 1;
    }

    NeuralNet net({784, 100, 10});
    {
        std::ifstream modelFile(modelPath);
        if (!modelFile) {
            std::cerr << "Error: cannot open model file: " << modelPath << "\n";
            return 1;
        }
        modelFile >> net;
    }
    std::cout << "Model  : " << modelPath << " (" << modelBytes
              << " bytes, sha256 " << modelSha.substr(0, 16) << "...)\n";

    // Opt-in second mode. Writes only benchmarks/mnist_f32_flips.json;
    // the committed accuracy artifacts below are never reached.
    if (f32Mode) {
        return runF32Compare(net, modelPath, modelBytes, modelSha, binPath,
                             dataPath, listPath, outDir);
    }

    std::ifstream testList(listPath);
    if (!testList) {
        std::cerr << "Error: cannot open list file: " << listPath << "\n"
                  << "The MNIST test set is gitignored; run tools/bootstrap "
                     "to fetch it.\n";
        return 1;
    }

    // confusion[trueLabel][predLabel]
    std::vector<std::vector<long>> confusion(
        kClasses, std::vector<long>(kClasses, 0));
    std::vector<ErrorRecord> errors;
    long total = 0, correct = 0, ordinalMismatches = 0;

    std::string line;
    while (std::getline(testList, line)) {
        stripCr(line);
        if (line.empty()) continue;

        long ordinal = -1;
        int expected = -1;
        if (!parseNameFields(line, ordinal, expected)) {
            std::cerr << "Error: cannot parse label from '" << line << "'\n";
            return 1;
        }
        if (ordinal != total) ++ordinalMismatches;

        const Matrix img = loadPGM((fs::path(dataPath) / line).string());
        const Matrix out = net.classify(img);

        int prediction = 0;
        double best = out[0][0];
        for (int i = 1; i < kClasses; ++i) {
            if (out[i][0] > best) {
                best = out[i][0];
                prediction = i;
            }
        }

        confusion[expected][prediction]++;
        if (prediction == expected) {
            ++correct;
        } else {
            errors.push_back({total, line, expected, prediction, best,
                              out[expected][0]});
        }
        ++total;
    }

    if (total == 0) {
        std::cerr << "Error: list file " << listPath << " yielded 0 images.\n";
        return 1;
    }

    const double accuracy = static_cast<double>(correct) / total;

    // ---- per-class precision / recall / F1 --------------------------------
    struct ClassStat {
        long support = 0, tp = 0, fp = 0, fn = 0, predicted = 0;
        double precision = 0, recall = 0, f1 = 0;
    };
    std::array<ClassStat, kClasses> stats{};
    for (int t = 0; t < kClasses; ++t) {
        for (int p = 0; p < kClasses; ++p) {
            const long n = confusion[t][p];
            stats[t].support += n;
            stats[p].predicted += n;
            if (t == p) {
                stats[t].tp += n;
            } else {
                stats[t].fn += n;
                stats[p].fp += n;
            }
        }
    }
    double macroP = 0, macroR = 0, macroF1 = 0;
    for (int c = 0; c < kClasses; ++c) {
        ClassStat& s = stats[c];
        s.precision = (s.tp + s.fp) ? static_cast<double>(s.tp) / (s.tp + s.fp) : 0.0;
        s.recall    = (s.tp + s.fn) ? static_cast<double>(s.tp) / (s.tp + s.fn) : 0.0;
        s.f1 = (s.precision + s.recall > 0)
                   ? 2 * s.precision * s.recall / (s.precision + s.recall)
                   : 0.0;
        macroP += s.precision; macroR += s.recall; macroF1 += s.f1;
    }
    macroP /= kClasses; macroR /= kClasses; macroF1 /= kClasses;

    // ---- console summary --------------------------------------------------
    std::cout << "Dataset: " << listPath << " -> " << total << " images\n"
              << "Correct: " << correct << " / " << total << "\n"
              << "Accuracy: " << fixed(accuracy * 100.0, 4) << "%  ("
              << fixed(accuracy, 6) << ")\n"
              << "Errors : " << errors.size() << "\n";
    if (ordinalMismatches) {
        std::cout << "NOTE   : " << ordinalMismatches
                  << " filenames whose embedded ordinal != list position; "
                     "indices below are list positions.\n";
    }

    fs::create_directories(outDir);
    const std::string jsonPath =
        (fs::path(outDir) / "mnist_eval.json").string();
    const std::string txtPath =
        (fs::path(outDir) / "mnist_eval.txt").string();
    const std::string csvPath =
        (fs::path(outDir) / "mnist_misclassified.csv").string();

    // ---- JSON -------------------------------------------------------------
    {
        std::ofstream j(jsonPath);
        if (!j) {
            std::cerr << "Error: cannot write " << jsonPath << "\n";
            return 1;
        }
        j << "{\n";
        j << "  \"schema\": \"glyph.mnist_eval/1\",\n";
        j << "  \"generator\": \"apps/eval_model.cpp (fast_mnist_eval)\",\n";
        j << "  \"model\": {\n"
          << "    \"path\": \"" << modelPath << "\",\n"
          << "    \"bytes\": " << modelBytes << ",\n"
          << "    \"sha256\": \"" << modelSha << "\",\n"
          << "    \"layers\": [784, 100, 10]\n"
          << "  },\n";
        j << "  \"dataset\": {\n"
          << "    \"list\": \"" << listPath << "\",\n"
          << "    \"root\": \"" << dataPath << "\",\n"
          << "    \"images\": " << total << "\n"
          << "  },\n";
        j << "  \"overall\": {\n"
          << "    \"correct\": " << correct << ",\n"
          << "    \"total\": " << total << ",\n"
          << "    \"incorrect\": " << errors.size() << ",\n"
          << "    \"accuracy\": " << fixed(accuracy, 6) << ",\n"
          << "    \"accuracy_pct\": " << fixed(accuracy * 100.0, 4) << ",\n"
          << "    \"error_rate_pct\": " << fixed(100.0 - accuracy * 100.0, 4)
          << "\n  },\n";
        j << "  \"macro_avg\": { \"precision\": " << fixed(macroP, 6)
          << ", \"recall\": " << fixed(macroR, 6)
          << ", \"f1\": " << fixed(macroF1, 6) << " },\n";

        j << "  \"per_class\": [\n";
        for (int c = 0; c < kClasses; ++c) {
            const ClassStat& s = stats[c];
            j << "    { \"digit\": " << c << ", \"support\": " << s.support
              << ", \"predicted\": " << s.predicted << ", \"tp\": " << s.tp
              << ", \"fp\": " << s.fp << ", \"fn\": " << s.fn
              << ", \"precision\": " << fixed(s.precision, 6)
              << ", \"recall\": " << fixed(s.recall, 6)
              << ", \"f1\": " << fixed(s.f1, 6) << " }"
              << (c == kClasses - 1 ? "\n" : ",\n");
        }
        j << "  ],\n";

        j << "  \"confusion_matrix\": {\n"
          << "    \"note\": \"rows = true label 0-9, cols = predicted label "
             "0-9\",\n"
          << "    \"rows\": [\n";
        for (int t = 0; t < kClasses; ++t) {
            j << "      [";
            for (int p = 0; p < kClasses; ++p) {
                j << confusion[t][p] << (p == kClasses - 1 ? "" : ", ");
            }
            j << "]" << (t == kClasses - 1 ? "\n" : ",\n");
        }
        j << "    ]\n  },\n";

        j << "  \"misclassified_count\": " << errors.size() << ",\n";
        j << "  \"misclassified\": [\n";
        for (std::size_t i = 0; i < errors.size(); ++i) {
            const ErrorRecord& r = errors[i];
            j << "    { \"index\": " << r.index << ", \"file\": \"" << r.file
              << "\", \"true\": " << r.trueLabel
              << ", \"pred\": " << r.predLabel
              << ", \"pred_activation\": " << fixed(r.predActivation, 6)
              << ", \"true_activation\": " << fixed(r.trueActivation, 6)
              << " }" << (i + 1 == errors.size() ? "\n" : ",\n");
        }
        j << "  ]\n}\n";
    }

    // ---- compact CSV of every error (renderer-friendly) -------------------
    {
        std::ofstream c(csvPath);
        if (!c) {
            std::cerr << "Error: cannot write " << csvPath << "\n";
            return 1;
        }
        c << "index,true,pred,pred_activation,true_activation,file\n";
        for (const ErrorRecord& r : errors) {
            c << r.index << ',' << r.trueLabel << ',' << r.predLabel << ','
              << fixed(r.predActivation, 6) << ','
              << fixed(r.trueActivation, 6) << ',' << r.file << '\n';
        }
    }

    // ---- human-readable transcript ---------------------------------------
    {
        std::ofstream t(txtPath);
        if (!t) {
            std::cerr << "Error: cannot write " << txtPath << "\n";
            return 1;
        }
        t << "Glyph -- MNIST test-set evaluation\n"
          << "==================================\n\n"
          << "generator : apps/eval_model.cpp (fast_mnist_eval)\n"
          << "model     : " << modelPath << "  (" << modelBytes << " bytes)\n"
          << "sha256    : " << modelSha << "\n"
          << "layers    : 784 -> 100 -> 10 (sigmoid MLP)\n"
          << "dataset   : " << listPath << " (" << total << " images under "
          << dataPath << "/)\n\n";
        t << "OVERALL\n-------\n"
          << "correct   : " << correct << " / " << total << "\n"
          << "incorrect : " << errors.size() << "\n"
          << "accuracy  : " << fixed(accuracy * 100.0, 4) << " %\n"
          << "error rate: " << fixed(100.0 - accuracy * 100.0, 4) << " %\n"
          << "macro P/R/F1: " << fixed(macroP, 4) << " / " << fixed(macroR, 4)
          << " / " << fixed(macroF1, 4) << "\n\n";

        t << "PER-CLASS\n---------\n"
          << "digit  support  correct   errors  precision   recall       f1\n";
        for (int c = 0; c < kClasses; ++c) {
            const ClassStat& s = stats[c];
            t << std::setw(5) << c << std::setw(9) << s.support
              << std::setw(9) << s.tp << std::setw(9) << s.fn
              << std::setw(11) << fixed(s.precision, 4)
              << std::setw(9) << fixed(s.recall, 4)
              << std::setw(9) << fixed(s.f1, 4) << "\n";
        }

        t << "\nCONFUSION MATRIX (rows = true, cols = predicted)\n"
          << "-----------------------------------------------\n"
          << "       ";
        for (int p = 0; p < kClasses; ++p) t << std::setw(6) << p;
        t << "\n";
        for (int tr = 0; tr < kClasses; ++tr) {
            t << std::setw(4) << tr << " | ";
            for (int p = 0; p < kClasses; ++p) {
                t << std::setw(6) << confusion[tr][p];
            }
            t << "\n";
        }

        t << "\nTOP CONFUSIONS\n--------------\n";
        std::vector<std::array<long, 3>> pairs;  // {count, true, pred}
        for (int tr = 0; tr < kClasses; ++tr) {
            for (int p = 0; p < kClasses; ++p) {
                if (tr != p && confusion[tr][p] > 0) {
                    pairs.push_back({confusion[tr][p], tr, p});
                }
            }
        }
        std::sort(pairs.begin(), pairs.end(),
                  [](const auto& a, const auto& b) { return a[0] > b[0]; });
        for (std::size_t i = 0; i < pairs.size() && i < 10; ++i) {
            t << "  true " << pairs[i][1] << " -> predicted " << pairs[i][2]
              << " : " << pairs[i][0] << "\n";
        }

        t << "\nMISCLASSIFIED IMAGES (" << errors.size()
          << ") -- index is 0-based position in " << listPath << "\n"
          << "----------------------------------------------------------\n";
        for (const ErrorRecord& r : errors) {
            t << "  #" << std::setw(5) << r.index << "  true " << r.trueLabel
              << "  pred " << r.predLabel << "  " << r.file << "\n";
        }
        t << "\nFull machine-readable record: " << jsonPath << "\n"
          << "Compact error list          : " << csvPath << "\n";
    }

    std::cout << "Wrote " << jsonPath << "\n"
              << "Wrote " << txtPath << "\n"
              << "Wrote " << csvPath << "\n";
    return 0;
}
