/**
 * Test the trained model on specific test images.
 */

#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include "fast_mnist/Matrix.h"
#include "fast_mnist/NeuralNet.h"

namespace fs = std::filesystem;

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
            while (p < e && static_cast<unsigned char>(*p) <= ' ')
                ++p;
            if (p < e && *p == '#') {
                while (p < e && *p != '\n')
                    ++p;
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

    const size_t nPix = static_cast<size_t>(width) * height;
    Matrix img(nPix, 1, Matrix::NoInit{});
    const double inv = 1.0 / static_cast<double>(maxVal);

    for (size_t i = 0; i < nPix; ++i) {
        const int pix = parseInt();
        img[i][0] = static_cast<double>(pix) * inv;
    }

    return img;
}

int getDigitFromPath(const std::string& path) {
    auto pos = path.rfind('_');
    if (pos != std::string::npos && pos + 1 < path.size()) {
        return path[pos + 1] - '0';
    }
    return -1;
}

int main(int argc, char* argv[]) {
    std::string modelPath = "model.weights";
    std::string dataPath = "data";
    int testCount = 100;

    if (argc > 1) modelPath = argv[1];
    if (argc > 2) dataPath = argv[2];
    if (argc > 3) testCount = std::stoi(argv[3]);

    std::cout << "Loading model from " << modelPath << "...\n";

    NeuralNet net({784, 100, 10});
    std::ifstream modelFile(modelPath);
    if (!modelFile) {
        std::cerr << "Error: Cannot open model file: " << modelPath << "\n";
        return 1;
    }
    modelFile >> net;
    std::cout << "Model loaded.\n\n";

    // Load test images
    std::ifstream testList("TestingSetList.txt");
    if (!testList) {
        std::cerr << "Error: Cannot open TestingSetList.txt\n";
        return 1;
    }

    int correct = 0;
    int total = 0;
    std::vector<int> predictions(10, 0);  // Count predictions per digit

    std::string imgName;
    while (std::getline(testList, imgName) && total < testCount) {
        fs::path fullPath = fs::path(dataPath) / imgName;
        Matrix img = loadPGM(fullPath.string());
        int expected = getDigitFromPath(imgName);

        Matrix result = net.classify(img);

        // Find prediction
        int prediction = 0;
        double maxVal = result[0][0];
        for (int i = 1; i < 10; ++i) {
            if (result[i][0] > maxVal) {
                maxVal = result[i][0];
                prediction = i;
            }
        }

        predictions[prediction]++;

        if (prediction == expected) {
            correct++;
        }

        if (total < 20) {
            std::cout << "Image: " << imgName << " Expected: " << expected
                      << " Predicted: " << prediction;
            if (prediction == expected) {
                std::cout << " ✓";
            } else {
                std::cout << " ✗";
            }
            std::cout << " (raw outputs: ";
            for (int i = 0; i < 10; ++i) {
                std::cout << i << ":" << result[i][0] << " ";
            }
            std::cout << ")\n";
        }

        total++;
    }

    std::cout << "\n--- Results ---\n";
    std::cout << "Accuracy: " << correct << "/" << total << " = "
              << (100.0 * correct / total) << "%\n\n";

    std::cout << "Prediction distribution:\n";
    for (int i = 0; i < 10; ++i) {
        std::cout << "  " << i << ": " << predictions[i] << " times\n";
    }

    return 0;
}
