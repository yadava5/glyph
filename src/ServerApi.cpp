#include "fast_mnist/ServerApi.h"

#include <cmath>
#include <fstream>
#include <sstream>
#include <stdexcept>

std::vector<int> mnistTopology() {
    return {784, 100, 10};
}

std::optional<ApiError>
validatePredictionPixels(const std::vector<double>& pixels) {
    constexpr std::size_t ExpectedPixels = 784;
    if (pixels.size() != ExpectedPixels) {
        return ApiError{
            "invalid_pixel_count",
            "Expected 784 pixels, got " + std::to_string(pixels.size()) + ".",
        };
    }

    for (std::size_t i = 0; i < pixels.size(); ++i) {
        const double value = pixels[i];
        if (!std::isfinite(value) || value < 0.0 || value > 1.0) {
            return ApiError{
                "invalid_pixel_value",
                "Pixel values must be finite numbers in [0, 1].",
            };
        }
    }

    return std::nullopt;
}

bool networkMatchesTopology(const NeuralNet& net,
                            const std::vector<int>& topology) {
    if (topology.size() < 2) {
        return false;
    }

    const auto& weights = net.getWeights();
    const auto& biases = net.getBiases();
    if (weights.size() != topology.size() - 1 ||
        biases.size() != topology.size() - 1) {
        return false;
    }

    for (std::size_t i = 0; i < weights.size(); ++i) {
        const auto expectedIn = static_cast<std::size_t>(topology[i]);
        const auto expectedOut = static_cast<std::size_t>(topology[i + 1]);
        if (weights[i].height() != expectedOut ||
            weights[i].width() != expectedIn ||
            biases[i].height() != expectedOut ||
            biases[i].width() != 1) {
            return false;
        }
    }

    return true;
}

NeuralNet loadRequiredModel(const std::string& path) {
    return loadRequiredModel(path, mnistTopology());
}

NeuralNet loadRequiredModel(const std::string& path,
                            const std::vector<int>& topology) {
    std::ifstream file(path);
    if (!file) {
        throw std::runtime_error("model file not found: " + path);
    }

    NeuralNet net(topology);
    file >> net;
    if (!file) {
        throw std::runtime_error("model file could not be read: " + path);
    }

    if (!networkMatchesTopology(net, topology)) {
        std::ostringstream os;
        os << "model topology does not match expected ";
        for (std::size_t i = 0; i < topology.size(); ++i) {
            if (i > 0) {
                os << " -> ";
            }
            os << topology[i];
        }
        throw std::runtime_error(os.str());
    }

    return net;
}
