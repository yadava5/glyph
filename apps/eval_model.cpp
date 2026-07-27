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
 *   fast_mnist_eval [model] [dataDir] [listFile] [outDir]
 * Defaults:
 *   model.weights  data  TestingSetList.txt  benchmarks
 */

#include <algorithm>
#include <array>
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

}  // namespace

int main(int argc, char* argv[]) {
    const std::string modelPath = (argc > 1) ? argv[1] : "model.weights";
    const std::string dataPath  = (argc > 2) ? argv[2] : "data";
    const std::string listPath  = (argc > 3) ? argv[3] : "TestingSetList.txt";
    const std::string outDir    = (argc > 4) ? argv[4] : "benchmarks";

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
