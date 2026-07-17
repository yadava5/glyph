#ifndef NEURAL_NET_H
#define NEURAL_NET_H

/**
 * A simple neural network implementationi n C++.  This implementation
 * is essentially based on the implementation from Michael Nielsen at
 * http://neuralnetworksanddeeplearning.com/
 *
 */

#include "fast_mnist/Matrix.h"
#include <cstdlib>
#include <cmath>
#include <functional>
#include <iostream>
#include <string>
#include <tuple>
#include <vector>

// A vector containing a list of doubles
using DoubleVec = std::vector<double>;

// A list of matrixes that is used to represent the biases and weights
// associated with each layer of the neural net.
using MatrixVec = std::vector<Matrix>;

/**
 * The main NeuralNetwork class. This class is sufficiently flexible
 * to enable creating different neural networks with different number
 * of layers and sizes.
 */
class NeuralNet {
    /**
     * A stream insertion operator to save/write the neural network so
     * that the trained network can be saved and loaded easily.
     *
     * \param[out] os The output stream to where the data is to be
     * written.
     *
     * \param[in] nnet The neural network to be serialized to the
     * given output stream.
     */
    friend std::ostream& operator<<(std::ostream& os, const NeuralNet& nnet);

    /**
     * The stream extraction operator to read data for a neural
     * network based on data written earlier via the above stream
     * insertion operator.
     *
     * \param[in] is The intput stream from where the data is to be
     * read.
     *
     * \param[out] nnet The neural network whose data is to be
     * read/modified by this method.
     */
    friend std::istream& operator>>(std::istream& is, NeuralNet& nnet);

  public:
    /**
     * Creates a neural network with a given number of layers with a
     * given number of neurons at each layer. For example NeuralNet
     * net({784, 100, 10}); creates a \c nnet with 3-layers with the
     * input layer having 784 neurons, hidden layer with 100 neurons,
     * and 10 neurons in the output layer.
     *
     * \param[in] layers The layers and number of neurons on each
     * layer.x
     */
    NeuralNet(const std::vector<int>& layers);

    /**
     * The helper method that updates the weights and biases of the
     * network to help it recognize the given input image as a digit.
     *
     * \param[in] inputs The input pixels that contain the image to be
     * recognized by the neural network.  The number of pixels in this
     * image must be exactly the same as the number of input neurons
     * for this neural network.
     *
     * \param[in] expected The expected output matrix for this image.
     * This matrix should be the same dimension as the output layer of
     * this neural network.
     *
     * \param[in] eta The learning rate at which this neural network
     * is to learn from this one example.
     */
    void learn(const Matrix& inputs, const Matrix& expected,
               const Val eta = 0.3);

    /**
     * This method is used to classify or recognize a given image
     * based on the current learning by this neural network.
     *
     * \param[in] inputs The input image to be classified/recognized
     * by this neural network.  The number of pixels in this image
     * must be exactly the same as the number of input neurons for
     * this neural network.
     *
     * \return The output matrix resulting from
     * classifying/recognizing the input image.
     */
    Matrix classify(const Matrix& inputs) const;

    /**
     * Classify an input and return the hidden-layer activations
     * alongside the output activations. For a 2-layer network
     * (input -> hidden -> output), \c hiddenActivations is filled
     * with the hidden-layer post-sigmoid values.
     *
     * Unlike classify(), this method does not use a static scratch
     * buffer; it allocates per call so it is safe to invoke from
     * multiple threads (e.g. concurrent HTTP requests).
     *
     * \param[in] inputs Column-vector of input values (e.g. 784
     * pixel values in [0, 1]).
     * \param[out] hiddenActivations std::vector<Val> that will be
     * resized to match the hidden layer width and filled with
     * post-sigmoid activations of the first hidden layer.
     *
     * \return Output-layer activations (same shape as classify()).
     */
    Matrix classifyWithHidden(const Matrix& inputs,
                              std::vector<Val>& hiddenActivations) const;

    /**
     * Compute the gradient of the predicted class's output
     * activation with respect to the input pixels, for saliency
     * visualization. Uses plain backpropagation through sigmoid
     * activations. Does NOT modify weights or biases.
     *
     * For a 2-layer network the math is:
     *   a1 = sigmoid(W0 * x + b0),  a2 = sigmoid(W1 * a1 + b1)
     *   delta2  = e_target * a2 * (1 - a2)   (e_target = one-hot)
     *   delta1  = (W1^T * delta2) .* a1 * (1 - a1)
     *   grad_x  = W0^T * delta1
     *
     * \param[in] inputs Column-vector of input values.
     * \param[in] targetClass Output-neuron index whose activation
     * gradient to take -- typically argmax of the forward pass.
     * \param[out] grad std::vector<Val> resized to the input
     * dimension and filled with gradient values.
     */
    void computeInputGradient(const Matrix& inputs,
                              int targetClass,
                              std::vector<Val>& grad) const;

    /**
     * This method is the top-level training method that processes
     * multiple input images and calling the learn method in this
     * class.
     *
     * \param[in] path Path to a file that contains the list of input
     * images to be used by this method to train the neural network.
     */
    void train(const std::string& path);

    /**
     * Get read-only access to the weight matrices.
     * \return Const reference to the vector of weight matrices.
     */
    const MatrixVec& getWeights() const { return weights; }

    /**
     * Get read-only access to the bias vectors.
     * \return Const reference to the vector of bias matrices.
     */
    const MatrixVec& getBiases() const { return biases; }

    /**
     * Load a compact binary weight file written by the
     * \c export_weights utility. The format is documented in
     * \c apps/export_weights.cpp and prioritizes small download size
     * over precision: weights and biases are stored as float32.
     *
     * On success, \c layerSizes, \c biases, and \c weights are
     * replaced with the values parsed from \c bytes. If the magic
     * marker or version is wrong, the method throws \c
     * std::runtime_error and leaves the object untouched.
     *
     * \param[in] bytes Pointer to the start of the binary payload.
     * \param[in] size Total payload size in bytes.
     */
    void loadBinary(const unsigned char* bytes, std::size_t size);

  protected:
    /**
     * This is an internal helper method that is used to initializes
     * the biases and weights matrix values for each layer.  This
     * method is used in the constructor to initialize the set of
     * matrices used by this class.
     *
     * \param[in] layerSizes The number of layers and number of
     * neurons in each layer.
     *
     * \param[out] biases The list of biases for each layer to be
     * initialized by this method.
     *
     * \param[out] weights The list of weights for each layer to be
     * initialized by this method.
     */
    void initBiasAndWeightMatrices(const std::vector<int>& layerSizes,
                                   MatrixVec& biases, MatrixVec& weights) const;

    /**
     * A simple sigmoid function.
     *
     * \param[in] val The value whose sigmoid value is to be returned.
     *
     * \return The sigmoid value for the given val.
     */
    static Val sigmoid(const Val val) {
        return 1. / (1. + std::exp(-val));
    }

    /**
     * A simple inverse-sigmoid function.
     *
     * \param[in] val The value whose inverse sigmoid value is to be
     * returned.
     *
     * \return The inverse sigmoid value for the given val.
     */
    static Val invSigmoid(const Val val) {
        return sigmoid(val) * (1 - sigmoid(val));
    }

  private:
    /**
     * The column-vector of biases associated with each layer of the
     * neural network.
     */
    MatrixVec biases;

    /**
     * The two dimensional matrix of weights associated with each
     * layer of the neural network.
     */
    MatrixVec weights;

    /**
     * The number of neurons to be present on each layer of the neural
     * network.
     */
    Matrix layerSizes;
};

#endif
