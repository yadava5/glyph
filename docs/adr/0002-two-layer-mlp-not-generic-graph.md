# ADR-0002: Hardcoded 2-layer MLP instead of a generic computation graph

- **Status:** Accepted
- **Date:** 2025-12-26
- **Deciders:** Ayush Yadav
- **Consulted:** —
- **Informed:** contributors

## Context and problem statement

MNIST classifiers are conventionally written against a generic computation
graph — a list of layers, each exposing `forward` and `backward`, wired up
dynamically. PyTorch, TensorFlow, tinygrad, and ggml all do this. A
generic representation makes it trivial to swap 2-layer MLP for a 5-layer
MLP or a small CNN.

Glyph only ever needs one architecture: a 784 → 100 → 10
fully-connected network with sigmoid activations. Given that, should
`NeuralNet` still carry the generic-graph machinery?

## Decision drivers

- Inference hot-path latency (the whole project is sold on microsecond
  classify times).
- Readability of the core class — is a new reader able to trace a single
  prediction end-to-end?
- Weight file format simplicity — the text format is part of the
  reproducibility contract.
- Future-proofing against adding a convolutional or deeper variant.

## Considered options

1. **Hardcode exactly 2 layers** (an input layer with hidden-sized output,
   and an output layer with 10 outputs). Static per-thread hidden buffer
   inside `classify()`.
2. **Store layers as a `std::vector<Layer>`** and iterate in both
   `classify()` and `learn()`.
3. **Use a computation-graph representation** with nodes, edges, and a
   scheduler.

## Decision

Option 1 for the inference path, with an asymmetric compromise on the
training path.

- `NeuralNet::classify()` assumes exactly two layers. The hidden
  activations live in a fixed-size static buffer sized for the 100-unit
  hidden layer. No dispatch, no allocation, no indirection per layer.
- `NeuralNet::learn()` IS written generically over `layers.size()` — the
  layer-by-layer backward pass benefits from the loop structure and the
  inner-loop cost dominates any overhead.

The asymmetry is deliberate: inference runs hot on the web server, training
runs cold and offline.

## Consequences

**Good**

- The `classify()` inner loop fits comfortably in L1 and has no
  per-layer dispatch overhead. This is what makes 81k img/s possible on
  commodity hardware.
- The weight file is two matrices, two bias vectors, and two header
  lines — human-readable, diffable, easy to port.
- The intent of the code matches the intent of the project: this is a
  two-layer MLP, and it advertises itself as one.

**Bad**

- Adding a third layer, let alone a convolution, is a rewrite, not an
  extension. Any future architecture work means revisiting `NeuralNet`
  wholesale.
- Sharp edge: if someone trains a non-2-layer model offline and loads it
  into `classify()`, the static hidden buffer is the wrong size. This is
  asserted in the weight-file header check, but it is a latent foot-gun.
- The asymmetry between `classify()` (hardcoded) and `learn()` (generic)
  surprises readers. The asymmetry is documented in the header; it is
  still asymmetric.

## Alternatives considered and why they were rejected

- **Generic layer-list iteration inside `classify()`.** Loses the
  static-buffer performance win, which is the whole point. Benchmarked
  during prototyping and came in ~15% slower on M2.
- **Full graph representation.** Too much machinery for a showcase — we
  would be writing a miniature framework, not a neural net. Rejected as
  over-engineering relative to the project's scope (see
  [ADR-0001](0001-hand-rolled-simd-over-bundled-blas.md) for the parallel
  reasoning on kernels).
- **Compile-time templates over layer count.** Would preserve performance
  while allowing 3-, 4-, 5-layer variants. Rejected because it inflates
  compile times, bloats the binary across template instantiations, and
  provides no benefit for the sole architecture we ship.

## Validation

Inference throughput in [`BENCHMARKS.md`](../../BENCHMARKS.md) (81,628
img/s classify on baseline) is the load-bearing evidence. The assertion
in the weight-file header check guards the sharp-edge described above.
