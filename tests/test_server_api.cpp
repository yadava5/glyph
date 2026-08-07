#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_string.hpp>

#include <cmath>
#include <string>
#include <vector>

#include "fast_mnist/ServerApi.h"

TEST_CASE("Server API validates prediction pixels", "[server][api]") {
    std::vector<double> pixels(784, 0.5);

    REQUIRE_FALSE(validatePredictionPixels(pixels).has_value());

    pixels.push_back(0.1);
    auto wrongCount = validatePredictionPixels(pixels);
    REQUIRE(wrongCount.has_value());
    REQUIRE(wrongCount->code == "invalid_pixel_count");

    pixels.assign(784, 0.5);
    pixels[17] = std::numeric_limits<double>::quiet_NaN();
    auto nonFinite = validatePredictionPixels(pixels);
    REQUIRE(nonFinite.has_value());
    REQUIRE(nonFinite->code == "invalid_pixel_value");

    pixels.assign(784, 0.5);
    pixels[18] = 1.1;
    auto outOfRange = validatePredictionPixels(pixels);
    REQUIRE(outOfRange.has_value());
    REQUIRE(outOfRange->code == "invalid_pixel_value");
}

TEST_CASE("Server API fails fast when the model file is missing",
          "[server][api]") {
    REQUIRE_THROWS_WITH(
        loadRequiredModel("definitely-missing-model.weights"),
        Catch::Matchers::ContainsSubstring("model file not found"));
}

TEST_CASE("Server API recognizes the portfolio topology", "[server][api]") {
    NeuralNet matching({784, 100, 10});
    NeuralNet stale({784, 30, 10});

    REQUIRE(networkMatchesTopology(matching, mnistTopology()));
    REQUIRE_FALSE(networkMatchesTopology(stale, mnistTopology()));
}
