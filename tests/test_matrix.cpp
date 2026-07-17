#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <cmath>
#include <cstdint>
#include <functional>
#include <stdexcept>
#include <sstream>
#include <utility>

#include "fast_mnist/Matrix.h"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
namespace {

// Hand-fill a Matrix with a row-major sequence; useful for the many
// small predictable fixtures in this file.
void fillSequential(Matrix& m, double start = 1.0, double step = 1.0) {
    double v = start;
    for (std::size_t r = 0; r < m.height(); ++r) {
        for (std::size_t c = 0; c < m.width(); ++c) {
            m[r][c] = v;
            v += step;
        }
    }
}

// Identity matrix constructor -- we use this in several cases and
// Matrix does not ship a dedicated identity() factory.
Matrix identity(std::size_t n) {
    Matrix I(n, n, 0.0);
    for (std::size_t i = 0; i < n; ++i)
        I[i][i] = 1.0;
    return I;
}

} // namespace

// ---------------------------------------------------------------------------
// Constructor + basic accessor coverage
// ---------------------------------------------------------------------------
TEST_CASE("Matrix initializes and indexes", "[matrix][basic]") {
    Matrix m(2, 3, 0.0);
    fillSequential(m);

    REQUIRE(m.height() == 2);
    REQUIRE(m.width() == 3);
    REQUIRE(m[0][0] == 1.0);
    REQUIRE(m[1][2] == 6.0);
    REQUIRE_FALSE(m.empty());
}

TEST_CASE("Empty matrices are well-behaved", "[matrix][edge]") {
    SECTION("default-constructed matrix is empty") {
        Matrix m;
        REQUIRE(m.empty());
        REQUIRE(m.height() == 0);
        REQUIRE(m.width() == 0);
    }

    SECTION("{0, 0} matrix is empty") {
        Matrix m(0, 0, 0.0);
        REQUIRE(m.empty());
    }

    SECTION("zero-row / zero-col matrices are empty") {
        Matrix rows0(0, 5, 0.0);
        Matrix cols0(5, 0, 0.0);
        REQUIRE(rows0.empty());
        REQUIRE(cols0.empty());
    }

    SECTION("size-zero transpose + apply do not crash") {
        Matrix m;
        Matrix t = m.transpose();
        REQUIRE(t.empty());

        Matrix negated = m.apply([](double v) { return -v; });
        REQUIRE(negated.empty());
    }

    SECTION("axpy on empty matrix is a no-op") {
        Matrix m;
        Matrix x;
        // Should not crash even when both sides are empty.
        m.axpy(2.0, x);
        REQUIRE(m.empty());
    }
}

TEST_CASE("Row and column vectors behave correctly", "[matrix][edge]") {
    SECTION("1xN row vector transpose") {
        Matrix row(1, 5, 0.0);
        fillSequential(row);

        Matrix col = row.transpose();
        REQUIRE(col.height() == 5);
        REQUIRE(col.width() == 1);
        for (std::size_t i = 0; i < 5; ++i) {
            REQUIRE(col[i][0] == Catch::Approx(static_cast<double>(i + 1)));
        }
    }

    SECTION("Nx1 column vector dot produces inner-product shape") {
        // (1x3) . (3x1) -> (1x1) scalar-shaped matrix.
        Matrix row(1, 3, 0.0);
        Matrix col(3, 1, 0.0);
        fillSequential(row);   // [1 2 3]
        fillSequential(col);   // [1;2;3]
        Matrix r = row.dot(col);
        REQUIRE(r.height() == 1);
        REQUIRE(r.width() == 1);
        REQUIRE(r[0][0] == Catch::Approx(1.0 + 4.0 + 9.0));
    }

    SECTION("axpy on a single-column vector") {
        Matrix x(4, 1, 1.0);
        Matrix y(4, 1, 2.0);
        x.axpy(-0.5, y);
        for (std::size_t i = 0; i < 4; ++i) {
            REQUIRE(x[i][0] == Catch::Approx(0.0));
        }
    }
}

// ---------------------------------------------------------------------------
// Shape-preserving properties: transpose, identity, symmetry
// ---------------------------------------------------------------------------
TEST_CASE("Matrix transpose preserves values", "[matrix][basic]") {
    Matrix m(2, 3, 0.0);
    fillSequential(m);

    Matrix t = m.transpose();
    REQUIRE(t.height() == 3);
    REQUIRE(t.width() == 2);
    REQUIRE(t[0][0] == 1.0);
    REQUIRE(t[2][1] == 6.0);
}

TEST_CASE("Transpose is an involution", "[matrix][property]") {
    Matrix m(5, 7, 0.0);
    fillSequential(m, -3.5, 0.25);

    Matrix roundTrip = m.transpose().transpose();
    REQUIRE(roundTrip.height() == m.height());
    REQUIRE(roundTrip.width() == m.width());
    for (std::size_t r = 0; r < m.height(); ++r) {
        for (std::size_t c = 0; c < m.width(); ++c) {
            // Transpose is a pure data move, so bit-equality is fine:
            // no FP ops occur, so Catch::Approx is stricter than we need.
            REQUIRE(roundTrip[r][c] == m[r][c]);
        }
    }
}

// ---------------------------------------------------------------------------
// dot()
// ---------------------------------------------------------------------------
TEST_CASE("Matrix dot multiplies small matrices", "[matrix][basic]") {
    Matrix a(2, 3, 0.0);
    Matrix b(3, 2, 0.0);

    a[0][0] = 1.0; a[0][1] = 2.0; a[0][2] = 3.0;
    a[1][0] = 4.0; a[1][1] = 5.0; a[1][2] = 6.0;

    b[0][0] =  7.0; b[0][1] =  8.0;
    b[1][0] =  9.0; b[1][1] = 10.0;
    b[2][0] = 11.0; b[2][1] = 12.0;

    Matrix c = a.dot(b);
    REQUIRE(c.height() == 2);
    REQUIRE(c.width() == 2);
    REQUIRE(c[0][0] == Catch::Approx(58.0));
    REQUIRE(c[0][1] == Catch::Approx(64.0));
    REQUIRE(c[1][0] == Catch::Approx(139.0));
    REQUIRE(c[1][1] == Catch::Approx(154.0));
}

TEST_CASE("Matrix dot rejects mismatched shapes in release builds",
          "[matrix][dot][contract]") {
    Matrix left(0, 2, 0.0);
    Matrix right(3, 1, 0.0);

    REQUIRE_THROWS_AS(left.dot(right), std::invalid_argument);
}

TEST_CASE("A . I == A and I . A == A", "[matrix][property]") {
    Matrix a(4, 6, 0.0);
    fillSequential(a, 0.125, 0.375);

    Matrix aI = a.dot(identity(6));
    REQUIRE(aI.height() == 4);
    REQUIRE(aI.width() == 6);
    for (std::size_t r = 0; r < 4; ++r) {
        for (std::size_t c = 0; c < 6; ++c) {
            REQUIRE(aI[r][c] == Catch::Approx(a[r][c]));
        }
    }

    Matrix Ia = identity(4).dot(a);
    for (std::size_t r = 0; r < 4; ++r) {
        for (std::size_t c = 0; c < 6; ++c) {
            REQUIRE(Ia[r][c] == Catch::Approx(a[r][c]));
        }
    }
}

TEST_CASE("A . A^T is symmetric", "[matrix][property]") {
    Matrix a(5, 3, 0.0);
    fillSequential(a, 1.0, 0.5);

    Matrix s = a.dot(a.transpose());
    REQUIRE(s.height() == 5);
    REQUIRE(s.width() == 5);
    for (std::size_t r = 0; r < 5; ++r) {
        for (std::size_t c = r + 1; c < 5; ++c) {
            REQUIRE(s[r][c] == Catch::Approx(s[c][r]));
        }
    }
}

TEST_CASE("Matrix dot handles a larger shape", "[matrix][stress]") {
    // 256x256 is large enough to exercise the tiled GEMM path's
    // BI/BJ blocking (64x64) but small enough to stay inside a
    // sanitizer's reasonable time budget.
    constexpr std::size_t N = 256;
    Matrix a(N, N, 0.0);
    Matrix b(N, N, 0.0);

    // Fill with a pattern that produces non-trivial sums.
    for (std::size_t r = 0; r < N; ++r) {
        for (std::size_t c = 0; c < N; ++c) {
            a[r][c] = static_cast<double>((r + c) % 7);
            b[r][c] = static_cast<double>((r * 3 + c) % 5);
        }
    }

    Matrix c = a.dot(b);
    REQUIRE(c.height() == N);
    REQUIRE(c.width() == N);

    // Spot-check one cell against a hand rollup; this is enough to
    // catch any gross miscount in the tiled accumulator.
    double expected00 = 0.0;
    for (std::size_t k = 0; k < N; ++k) {
        expected00 += a[0][k] * b[k][0];
    }
    REQUIRE(c[0][0] == Catch::Approx(expected00));
}

// ---------------------------------------------------------------------------
// axpy + scalar ops
// ---------------------------------------------------------------------------
TEST_CASE("Matrix axpy updates in place", "[matrix][basic]") {
    Matrix x(2, 2, 1.0);
    Matrix y(2, 2, 2.0);

    x.axpy(2.0, y);
    REQUIRE(x[0][0] == Catch::Approx(5.0));
    REQUIRE(x[1][1] == Catch::Approx(5.0));
}

TEST_CASE("axpy with alpha = 0 is a no-op", "[matrix][property]") {
    Matrix x(3, 4, 7.5);
    Matrix y(3, 4, 99.0);
    x.axpy(0.0, y);

    for (std::size_t r = 0; r < 3; ++r) {
        for (std::size_t c = 0; c < 4; ++c) {
            REQUIRE(x[r][c] == 7.5);  // exact: no FP op performed
        }
    }
}

TEST_CASE("Operator overloads behave element-wise", "[matrix][ops]") {
    Matrix a(2, 2, 0.0);
    Matrix b(2, 2, 0.0);
    a[0][0] = 1.0; a[0][1] = 2.0; a[1][0] = 3.0; a[1][1] = 4.0;
    b[0][0] = 5.0; b[0][1] = 6.0; b[1][0] = 7.0; b[1][1] = 8.0;

    SECTION("addition") {
        Matrix s = a + b;
        REQUIRE(s[0][0] == Catch::Approx(6.0));
        REQUIRE(s[1][1] == Catch::Approx(12.0));
    }

    SECTION("subtraction") {
        Matrix d = b - a;
        REQUIRE(d[0][0] == Catch::Approx(4.0));
        REQUIRE(d[1][1] == Catch::Approx(4.0));
    }

    SECTION("Hadamard product via operator*") {
        Matrix h = a * b;
        REQUIRE(h[0][0] == Catch::Approx(5.0));
        REQUIRE(h[1][1] == Catch::Approx(32.0));
    }

    SECTION("scalar multiply") {
        Matrix s = a * 2.5;
        REQUIRE(s[0][0] == Catch::Approx(2.5));
        REQUIRE(s[1][1] == Catch::Approx(10.0));
    }

    SECTION("apply with std::negate") {
        Matrix n = a.apply(std::negate<double>{});
        REQUIRE(n[0][0] == Catch::Approx(-1.0));
        REQUIRE(n[1][1] == Catch::Approx(-4.0));
    }
}

TEST_CASE("Matrix element-wise operations reject mismatched shapes",
          "[matrix][ops][contract]") {
    Matrix left(0, 2, 0.0);
    Matrix right(0, 3, 0.0);

    REQUIRE_THROWS_AS(left + right, std::invalid_argument);
}

// ---------------------------------------------------------------------------
// Storage: NoInit tag + 64-byte alignment
// ---------------------------------------------------------------------------
TEST_CASE("NoInit tag allocates writable storage", "[matrix][storage]") {
    // Using a somewhat oversized matrix so the uninitialized bytes
    // are more likely to be non-zero under a debug allocator, making
    // a post-fill verification meaningful.
    Matrix m(8, 16, Matrix::NoInit{});
    REQUIRE(m.height() == 8);
    REQUIRE(m.width() == 16);
    REQUIRE_FALSE(m.empty());

    // Writability check: every cell must accept a store + readback.
    for (std::size_t r = 0; r < 8; ++r) {
        for (std::size_t c = 0; c < 16; ++c) {
            m[r][c] = static_cast<double>(r * 16 + c);
        }
    }
    for (std::size_t r = 0; r < 8; ++r) {
        for (std::size_t c = 0; c < 16; ++c) {
            REQUIRE(m[r][c] == static_cast<double>(r * 16 + c));
        }
    }
}

TEST_CASE("Matrix storage is 64-byte aligned", "[matrix][storage]") {
    // allocate() uses posix_memalign/_aligned_malloc with 64 B alignment
    // so SIMD kernels can safely use _mm512_load_pd / vld1q_f64.
    // We reach into row 0's data() pointer via the Row proxy to avoid
    // exposing the private data_ field.
    Matrix m(4, 32, 0.0);
    const Val* base = m[0].data();
    REQUIRE(base != nullptr);
    const auto addr = reinterpret_cast<std::uintptr_t>(base);
    REQUIRE(addr % 64 == 0);
}

// ---------------------------------------------------------------------------
// Copy + move semantics
// ---------------------------------------------------------------------------
TEST_CASE("Copy semantics deep-copy the storage", "[matrix][semantics]") {
    Matrix original(3, 5, 0.0);
    fillSequential(original);

    SECTION("copy constructor produces an independent matrix") {
        Matrix copy(original);
        REQUIRE(copy.height() == original.height());
        REQUIRE(copy.width() == original.width());
        REQUIRE(copy[0].data() != original[0].data());

        // Mutating the copy must not affect the source.
        copy[0][0] = 999.0;
        REQUIRE(original[0][0] == Catch::Approx(1.0));
    }

    SECTION("copy assignment produces an independent matrix") {
        Matrix copy;
        copy = original;
        REQUIRE(copy.height() == original.height());
        REQUIRE(copy.width() == original.width());
        copy[2][4] = -1.0;
        REQUIRE(original[2][4] == Catch::Approx(15.0));
    }

    SECTION("self-assignment is safe") {
        Matrix m(2, 2, 0.0);
        m[0][0] = 1.0; m[1][1] = 4.0;
        Matrix& alias = m;
        m = alias;  // must not UAF or double-free
        REQUIRE(m[0][0] == Catch::Approx(1.0));
        REQUIRE(m[1][1] == Catch::Approx(4.0));
    }
}

TEST_CASE("Move semantics transfer storage without allocation",
          "[matrix][semantics]") {
    Matrix a(4, 4, 3.14);
    const Val* originalData = a[0].data();

    SECTION("move constructor") {
        Matrix b(std::move(a));
        REQUIRE(b.height() == 4);
        REQUIRE(b.width() == 4);
        REQUIRE(b[0].data() == originalData);  // same buffer
        REQUIRE(a.empty());                    // moved-from is empty
    }

    SECTION("move assignment") {
        Matrix b;
        b = std::move(a);
        REQUIRE(b.height() == 4);
        REQUIRE(b[0].data() == originalData);
        REQUIRE(a.empty());
    }
}

// ---------------------------------------------------------------------------
// Stream round-trip
// ---------------------------------------------------------------------------
TEST_CASE("Matrix stream round trip", "[matrix][io]") {
    Matrix m(2, 2, 0.0);
    m[0][0] = 1.0;
    m[0][1] = 2.0;
    m[1][0] = 3.0;
    m[1][1] = 4.0;

    std::stringstream ss;
    ss << m;

    Matrix loaded;
    ss >> loaded;

    REQUIRE(loaded.height() == 2);
    REQUIRE(loaded.width() == 2);
    REQUIRE(loaded[1][0] == Catch::Approx(3.0));
    REQUIRE(loaded[0][1] == Catch::Approx(2.0));
}

TEST_CASE("Stream round trip preserves non-round doubles",
          "[matrix][io][property]") {
    // 7x11 with irregular values exercises the text-format
    // serializer at a non-power-of-two shape where ld_ padding
    // diverges from cols_.
    Matrix m(7, 11, 0.0);
    for (std::size_t r = 0; r < m.height(); ++r) {
        for (std::size_t c = 0; c < m.width(); ++c) {
            m[r][c] =
                std::sin(static_cast<double>(r) * 0.3 + c * 0.7) * 12.34567;
        }
    }

    std::stringstream ss;
    ss.precision(17);  // round-trip-safe precision for IEEE-754 double
    ss << m;

    Matrix loaded;
    ss >> loaded;

    REQUIRE(loaded.height() == m.height());
    REQUIRE(loaded.width() == m.width());
    for (std::size_t r = 0; r < m.height(); ++r) {
        for (std::size_t c = 0; c < m.width(); ++c) {
            // Approx here covers any minute rounding the default
            // stream precision might introduce; we explicitly set
            // precision(17) above, which is enough for full-precision
            // round-trip on IEEE-754 double.
            REQUIRE(loaded[r][c] == Catch::Approx(m[r][c]));
        }
    }
}
