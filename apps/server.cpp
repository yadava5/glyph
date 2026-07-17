/**
 * HTTP API server for the Fast MNIST Neural Network.
 * Provides endpoints for digit classification with timing comparison.
 */

#include <chrono>
#include <cmath>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "httplib.h"
#include "json.hpp"

#include "fast_mnist/Matrix.h"
#include "fast_mnist/NeuralNet.h"
#include "fast_mnist/ServerApi.h"

using json = nlohmann::json;

/**
 * Baseline (scalar) matrix-vector multiply + sigmoid.
 * This is intentionally NOT optimized to provide a fair comparison.
 */
static void baseline_gemv_sigmoid(const Matrix& W, const Matrix& b,
                                  const std::vector<double>& x,
                                  std::vector<double>& y) {
    const std::size_t m = W.height(), n = W.width();
    for (std::size_t i = 0; i < m; ++i) {
        double s = 0.0;
        for (std::size_t k = 0; k < n; ++k) {
            s += W[i][k] * x[k];
        }
        s += b[i][0];
        y[i] = 1.0 / (1.0 + std::exp(-s));
    }
}

/**
 * Baseline classify using simple scalar operations.
 * No SIMD, no optimizations - just straightforward C++.
 */
static std::vector<double> baseline_classify(const NeuralNet& net,
                                             const std::vector<double>& input) {
    const auto& weights = net.getWeights();
    const auto& biases = net.getBiases();
    
    // Layer 1: input -> hidden
    std::vector<double> hidden(weights[0].height());
    baseline_gemv_sigmoid(weights[0], biases[0], input, hidden);
    
    // Layer 2: hidden -> output
    std::vector<double> output(weights[1].height());
    baseline_gemv_sigmoid(weights[1], biases[1], hidden, output);
    
    return output;
}

// Model file path
static std::string g_modelPath = "model.weights";

// Global networks for comparison
static NeuralNet g_network(mnistTopology());

static void setError(httplib::Response& res, int status,
                     const std::string& code,
                     const std::string& message) {
    res.status = status;
    json body = {
        {"error", {
            {"code", code},
            {"message", message},
        }},
    };
    res.set_content(body.dump(), "application/json");
}

/**
 * Classify an image using the neural network and return timing info.
 */
json classifyWithTiming(NeuralNet& net, const Matrix& input) {
    auto start = std::chrono::high_resolution_clock::now();
    
    Matrix result = net.classify(input);
    
    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration<double, std::milli>(end - start);
    
    // Find prediction (max index)
    int prediction = 0;
    double maxVal = result[0][0];
    std::vector<double> confidence(10);
    
    for (int i = 0; i < 10; ++i) {
        confidence[i] = result[i][0];
        if (result[i][0] > maxVal) {
            maxVal = result[i][0];
            prediction = i;
        }
    }
    
    // L1-normalize so confidence sums to 1. The output layer is sigmoid,
    // so each score is already in [0, 1]; applying exp/softmax here would
    // squash a near-certain prediction toward uniform (~0.23 peak). Divide
    // by the sum instead to preserve the model's actual confidence.
    double sum = 0.0;
    for (int i = 0; i < 10; ++i) {
        sum += confidence[i];
    }
    if (sum > 0.0) {
        for (int i = 0; i < 10; ++i) {
            confidence[i] /= sum;
        }
    }
    
    return {
        {"prediction", prediction},
        {"confidence", confidence},
        {"time_ms", duration.count()}
    };
}

int main(int argc, char* argv[]) {
    int port = 8080;
    std::string modelPath = "model.weights";
    
    if (argc > 1) {
        port = std::stoi(argv[1]);
    }
    if (argc > 2) {
        modelPath = argv[2];
    }
    
    std::cout << "🧠 Fast MNIST API Server\n";
    std::cout << "   Loading model...\n";
    
    // Load the trained model. A missing or stale model is a startup
    // error; serving random weights is misleading for the portfolio
    // demo and for API consumers.
    try {
        g_network = loadRequiredModel(modelPath);
        std::cout << "   ✓ Loaded model from " << modelPath << "\n";
    } catch (const std::exception& e) {
        std::cerr << "   ✗ " << e.what() << "\n";
        std::cerr << "     Train or export a 784 -> 100 -> 10 model first.\n";
        return 1;
    }
    
    httplib::Server svr;
    
    // Enable CORS for frontend
    svr.set_default_headers({
        {"Access-Control-Allow-Origin", "*"},
        {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type"}
    });
    
    // Handle preflight requests
    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });
    
    // Health check endpoint
    svr.Get("/health", [modelPath](const httplib::Request&,
                                   httplib::Response& res) {
        json response = {
            {"status", "ok"},
            {"ready", true},
            {"model_loaded", true},
            {"model_path", modelPath},
            {"topology", mnistTopology()},
            {"version", "1.0.0"},
        };
        res.set_content(response.dump(), "application/json");
    });
    
    // Prediction endpoint
    svr.Post("/predict", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);
            
            if (!body.contains("pixels") || !body["pixels"].is_array()) {
                setError(res, 400, "invalid_pixels",
                         "Missing or invalid 'pixels' array.");
                return;
            }
            
            auto pixels = body["pixels"].get<std::vector<double>>();
            if (const auto validation = validatePredictionPixels(pixels)) {
                setError(res, 400, validation->code, validation->message);
                return;
            }
            
            // Create input matrix from pixels
            Matrix input(784, 1, Matrix::NoInit{});
            std::vector<double> inputVec(784);
            for (size_t i = 0; i < 784; ++i) {
                input[i][0] = pixels[i];
                inputVec[i] = pixels[i];
            }
            
            const bool includeBenchmarks =
                req.has_param("benchmark") &&
                req.get_param_value("benchmark") == "1";
            const int iterations = includeBenchmarks ? 100 : 1;
            double baselineTime = 0.0;

            if (includeBenchmarks) {
                auto baselineStart = std::chrono::high_resolution_clock::now();
                std::vector<double> baselineResult;
                for (int iter = 0; iter < iterations; ++iter) {
                    baselineResult = baseline_classify(g_network, inputVec);
                }
                auto baselineEnd = std::chrono::high_resolution_clock::now();
                baselineTime = std::chrono::duration<double, std::milli>(
                    baselineEnd - baselineStart).count() / iterations;
            }

            auto optimizedStart = std::chrono::high_resolution_clock::now();
            Matrix result;
            for (int iter = 0; iter < iterations; ++iter) {
                result = g_network.classify(input);
            }
            auto optimizedEnd = std::chrono::high_resolution_clock::now();
            auto optimizedTime = std::chrono::duration<double, std::milli>(
                optimizedEnd - optimizedStart).count() / iterations;
            
            // Find prediction from result
            int prediction = 0;
            double maxVal = result[0][0];
            std::vector<double> confidence(10);
            
            for (int i = 0; i < 10; ++i) {
                confidence[i] = result[i][0];
                if (result[i][0] > maxVal) {
                    maxVal = result[i][0];
                    prediction = i;
                }
            }
            
            // L1-normalize the sigmoid outputs (see classifyWithTiming):
            // exp/softmax over saturated sigmoids would squash a confident
            // prediction toward uniform. Divide by the sum instead.
            double sum = 0.0;
            for (int i = 0; i < 10; ++i) {
                sum += confidence[i];
            }
            if (sum > 0.0) {
                for (int i = 0; i < 10; ++i) {
                    confidence[i] /= sum;
                }
            }

            // Per-request interpretability: hidden activations +
            // input-pixel saliency for the predicted class. These
            // run ONCE (not in the timing loop) so they do not
            // pollute baseline_time_ms / optimized_time_ms.
            std::vector<double> hiddenActivations;
            g_network.classifyWithHidden(input, hiddenActivations);

            std::vector<double> inputGrad;
            g_network.computeInputGradient(input, prediction, inputGrad);

            json response = {
                {"prediction", prediction},
                {"confidence", confidence},
                {"baseline_time_ms", baselineTime},
                {"optimized_time_ms", optimizedTime},
                {"hidden_activations", hiddenActivations},
                {"input_grad", inputGrad}
            };

            res.set_content(response.dump(), "application/json");
            
        } catch (const json::parse_error&) {
            setError(res, 400, "invalid_json", "Request body must be JSON.");
        } catch (const json::type_error&) {
            setError(res, 400, "invalid_pixels",
                     "The 'pixels' field must be an array of numbers.");
        } catch (const std::exception& e) {
            std::cerr << "Prediction failed: " << e.what() << "\n";
            setError(res, 500, "internal_error",
                     "Prediction failed inside the server.");
        }
    });
    
    std::cout << "   Listening on http://localhost:" << port << "\n";
    std::cout << "   Endpoints:\n";
    std::cout << "     GET  /health  - Health check\n";
    std::cout << "     POST /predict - Classify a digit\n";
    std::cout << "\n   Press Ctrl+C to stop.\n";
    
    svr.listen("0.0.0.0", port);
    
    return 0;
}
