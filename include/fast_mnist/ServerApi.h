#ifndef FAST_MNIST_SERVER_API_H
#define FAST_MNIST_SERVER_API_H

#include "fast_mnist/NeuralNet.h"

#include <optional>
#include <string>
#include <vector>

struct ApiError {
    std::string code;
    std::string message;
};

std::vector<int> mnistTopology();

std::optional<ApiError>
validatePredictionPixels(const std::vector<double>& pixels);

bool networkMatchesTopology(const NeuralNet& net,
                            const std::vector<int>& topology);

NeuralNet loadRequiredModel(const std::string& path);

NeuralNet loadRequiredModel(const std::string& path,
                            const std::vector<int>& topology);

#endif
