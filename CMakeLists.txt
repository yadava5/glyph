cmake_minimum_required(VERSION 3.20)

project(fast_mnist_nn VERSION 1.0.0 LANGUAGES CXX)

option(FAST_MNIST_ENABLE_OPENMP "Enable OpenMP support" ON)
option(FAST_MNIST_ENABLE_NATIVE "Enable -march=native" OFF)
option(FAST_MNIST_ENABLE_BENCHMARKS "Enable Google Benchmark" OFF)
option(FAST_MNIST_ENABLE_COVERAGE "Instrument for source-based coverage" OFF)
option(FAST_MNIST_ENABLE_DOXYGEN "Enable Doxygen docs target" OFF)

# Sanitizer selection. Accepts: OFF, asan, ubsan, asan-ubsan, tsan, msan.
# Must be a cache STRING (not BOOL) because CMake's `option()` only
# supports ON/OFF. The flags are applied PUBLIC on the fast_mnist
# library target so they propagate to every downstream consumer
# (apps, tests, benchmarks).
set(FAST_MNIST_ENABLE_SANITIZERS "OFF" CACHE STRING
    "Enable sanitizers (OFF|asan|ubsan|asan-ubsan|tsan|msan)")
set_property(CACHE FAST_MNIST_ENABLE_SANITIZERS PROPERTY STRINGS
    OFF asan ubsan asan-ubsan tsan msan)

# When configured with emcmake (toolchain = Emscripten.cmake), skip
# the native executables, OpenMP search, and test harness. The WASM
# target lives at the bottom of this file and is the only thing
# emitted in that configuration.
if(EMSCRIPTEN)
  set(FAST_MNIST_ENABLE_OPENMP OFF CACHE BOOL "" FORCE)
  set(FAST_MNIST_ENABLE_SERVER OFF CACHE BOOL "" FORCE)
  set(FAST_MNIST_ENABLE_BENCHMARKS OFF CACHE BOOL "" FORCE)
  set(FAST_MNIST_ENABLE_SANITIZERS "OFF" CACHE STRING "" FORCE)
  # Emscripten has no std::filesystem threads model; disable the
  # test / benchmark / CLI targets and just build the library plus
  # the Embind shim.
  set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
endif()

add_library(fast_mnist
  src/Matrix.cpp
  src/NeuralNet.cpp
  src/ServerApi.cpp
)

target_include_directories(fast_mnist
  PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

target_compile_features(fast_mnist PUBLIC cxx_std_17)

if(MSVC)
  target_compile_options(fast_mnist PRIVATE /W4)
else()
  target_compile_options(fast_mnist PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(FAST_MNIST_ENABLE_NATIVE)
  if(MSVC)
    message(WARNING "FAST_MNIST_ENABLE_NATIVE is not supported on MSVC")
  else()
    target_compile_options(fast_mnist PRIVATE -march=native)
  endif()
endif()

# Sanitizer flag application. PUBLIC so the flags propagate to every
# target that links fast_mnist -- CLI, trainer, server, tests, and
# benchmarks. Frame pointers are preserved so symbolicated stack
# traces are readable, and -O1 is forced to keep inlining shallow
# enough for useful reports without slowing the build to a crawl.
if(NOT FAST_MNIST_ENABLE_SANITIZERS STREQUAL "OFF")
  if(MSVC)
    message(WARNING "Sanitizers not supported on MSVC; ignoring "
            "FAST_MNIST_ENABLE_SANITIZERS=${FAST_MNIST_ENABLE_SANITIZERS}")
  elseif(FAST_MNIST_ENABLE_SANITIZERS STREQUAL "asan-ubsan")
    target_compile_options(fast_mnist PUBLIC
      -fsanitize=address,undefined -fno-omit-frame-pointer -O1)
    target_link_options(fast_mnist PUBLIC
      -fsanitize=address,undefined)
  elseif(FAST_MNIST_ENABLE_SANITIZERS STREQUAL "asan")
    target_compile_options(fast_mnist PUBLIC
      -fsanitize=address -fno-omit-frame-pointer -O1)
    target_link_options(fast_mnist PUBLIC -fsanitize=address)
  elseif(FAST_MNIST_ENABLE_SANITIZERS STREQUAL "ubsan")
    target_compile_options(fast_mnist PUBLIC
      -fsanitize=undefined -fno-omit-frame-pointer -O1)
    target_link_options(fast_mnist PUBLIC -fsanitize=undefined)
  elseif(FAST_MNIST_ENABLE_SANITIZERS STREQUAL "tsan")
    target_compile_options(fast_mnist PUBLIC
      -fsanitize=thread -fno-omit-frame-pointer -O1)
    target_link_options(fast_mnist PUBLIC -fsanitize=thread)
  elseif(FAST_MNIST_ENABLE_SANITIZERS STREQUAL "msan")
    # MSan needs an MSan-instrumented libc++. The CI matrix skips this;
    # document the manual path instead of wiring it up and failing on
    # every standard toolchain.
    message(WARNING
      "MSan requires an instrumented libc++; skipping automatic setup. "
      "Build your own libc++ with -fsanitize=memory and pass "
      "-stdlib=libc++ -L<path-to-libcxx> manually if you need it.")
  else()
    message(FATAL_ERROR
      "Unknown FAST_MNIST_ENABLE_SANITIZERS value: "
      "'${FAST_MNIST_ENABLE_SANITIZERS}'. "
      "Expected one of: OFF, asan, ubsan, asan-ubsan, tsan, msan.")
  endif()
endif()

# Source-based coverage instrumentation. PUBLIC for the same reason the
# sanitizer flags are: the counters have to exist in the library AND in the
# test binary that drives it, or the report shows the tests covering
# themselves and nothing else.
#
# A separate build directory from the benchmark configurations on purpose.
# Instrumentation changes inlining and adds counter updates on every branch,
# so a coverage build's timings are meaningless -- benchmarking it would
# publish numbers about a binary nobody ships. Kept apart so the two can never
# be confused for one another.
#
# Clang/AppleClang and GCC disagree on the mechanism, so this is not one flag.
if(FAST_MNIST_ENABLE_COVERAGE)
  if(MSVC)
    message(WARNING "FAST_MNIST_ENABLE_COVERAGE is not supported on MSVC")
  elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
    target_compile_options(fast_mnist PUBLIC
      -fprofile-instr-generate -fcoverage-mapping -O0 -g)
    target_link_options(fast_mnist PUBLIC -fprofile-instr-generate)
  elseif(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    target_compile_options(fast_mnist PUBLIC --coverage -O0 -g)
    target_link_options(fast_mnist PUBLIC --coverage)
  else()
    message(WARNING
      "FAST_MNIST_ENABLE_COVERAGE: unrecognised compiler "
      "'${CMAKE_CXX_COMPILER_ID}'; no instrumentation added.")
  endif()
endif()

if(FAST_MNIST_ENABLE_OPENMP)
  find_package(OpenMP QUIET)
  if(OpenMP_CXX_FOUND)
    target_link_libraries(fast_mnist PUBLIC OpenMP::OpenMP_CXX)
    target_compile_definitions(fast_mnist PUBLIC FAST_MNIST_USE_OPENMP=1)
  elseif(APPLE)
    find_library(OPENMP_LIB omp
      PATHS /opt/homebrew/opt/libomp/lib /usr/local/opt/libomp/lib
    )
    if(OPENMP_LIB)
      target_compile_options(fast_mnist PUBLIC -Xpreprocessor -fopenmp)
      target_include_directories(fast_mnist PUBLIC
        /opt/homebrew/opt/libomp/include
        /usr/local/opt/libomp/include
      )
      target_link_libraries(fast_mnist PUBLIC ${OPENMP_LIB})
      target_compile_definitions(fast_mnist PUBLIC FAST_MNIST_USE_OPENMP=1)
    else()
      message(STATUS "OpenMP not found; building without OpenMP")
    endif()
  else()
    message(STATUS "OpenMP not found; building without OpenMP")
  endif()
endif()

if(NOT EMSCRIPTEN)
  add_executable(fast_mnist_cli apps/fast_mnist_cli.cpp)
  target_link_libraries(fast_mnist_cli PRIVATE fast_mnist)

  # Model trainer
  add_executable(fast_mnist_trainer apps/train_model.cpp)
  target_link_libraries(fast_mnist_trainer PRIVATE fast_mnist)

  # Binary weight exporter: converts ASCII model.weights -> compact
  # little-endian .bin for loading in the WASM browser path.
  add_executable(export_weights apps/export_weights.cpp)
  target_link_libraries(export_weights PRIVATE fast_mnist)

  # Evaluation harness — the tool that MEASURES the headline accuracy.
  #
  # This target was missing. apps/eval_model.cpp has been committed since
  # 97de736, and benchmarks/mnist_eval.json is quoted as the source for
  # "97.01% on the 10,000-image MNIST test set" wherever that number
  # appears — but no CMake target built it, and it appeared in no
  # workflow. The report was reproducible in principle and unbuildable in
  # practice: you had to hand-compile the generator to check the number.
  #
  # That is the wrong way round for the one figure this repository is
  # most often judged on. The file's own header calls itself "the
  # measurement"; a measurement nobody can re-run is a claim.
  #
  #   cmake --build build --target fast_mnist_eval
  #   ./build/fast_mnist_eval model.weights data TestingSetList.txt benchmarks
  #
  # Verified 2026-08-02: the regenerated mnist_eval.json and
  # mnist_misclassified.csv are byte-identical to the committed ones.
  add_executable(fast_mnist_eval apps/eval_model.cpp)
  target_link_libraries(fast_mnist_eval PRIVATE fast_mnist)
endif()

# Web API Server
option(FAST_MNIST_ENABLE_SERVER "Enable HTTP API server" ON)
if(FAST_MNIST_ENABLE_SERVER AND NOT EMSCRIPTEN)
  add_executable(fast_mnist_server apps/server.cpp)
  target_include_directories(fast_mnist_server PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/third_party)
  target_link_libraries(fast_mnist_server PRIVATE fast_mnist)
  
  # Find threads library (required by httplib)
  find_package(Threads REQUIRED)
  target_link_libraries(fast_mnist_server PRIVATE Threads::Threads)
  
  # macOS needs additional frameworks for networking
  if(APPLE)
    find_library(COREFOUNDATION_LIBRARY CoreFoundation)
    find_library(SECURITY_LIBRARY Security)
    if(COREFOUNDATION_LIBRARY AND SECURITY_LIBRARY)
      target_link_libraries(fast_mnist_server PRIVATE ${COREFOUNDATION_LIBRARY} ${SECURITY_LIBRARY})
    endif()
  endif()
endif()

include(CTest)
if(BUILD_TESTING)
  include(FetchContent)
  FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.5.2
  )
  FetchContent_MakeAvailable(Catch2)

  # rapidcheck: property-based test fuzzer that plugs into Catch2.
  # No tagged releases upstream, so we pin to a specific commit SHA.
  #
  # RC_ENABLE_CATCH is deliberately left OFF: turning it on pulls in
  # rapidcheck's vendored Catch2 v2.4.2 under ext/catch, which
  # collides with the Catch2 v3 FetchContent above ("target Catch2
  # already exists"). The integration header we actually need lives
  # in extras/catch and is header-only; we add that directory
  # manually below once rapidcheck is populated so we get the
  # `rapidcheck_catch` INTERFACE target without the duplicate
  # Catch2.
  set(RC_ENABLE_TESTS OFF CACHE BOOL "" FORCE)
  set(RC_ENABLE_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(RC_ENABLE_CATCH OFF CACHE BOOL "" FORCE)
  FetchContent_Declare(
    rapidcheck
    GIT_REPOSITORY https://github.com/emil-e/rapidcheck.git
    GIT_TAG b96a4e626ef4c7348dcd16c500353c2f997a9f3f
  )
  FetchContent_MakeAvailable(rapidcheck)

  # Manually register the Catch integration (header-only INTERFACE
  # target). Skip if for any reason a future rapidcheck SHA already
  # provides the target -- guards against accidental re-inclusion.
  if(NOT TARGET rapidcheck_catch)
    add_subdirectory(
      "${rapidcheck_SOURCE_DIR}/extras/catch"
      "${rapidcheck_BINARY_DIR}/extras/catch"
    )
  endif()

  add_executable(fast_mnist_tests
    tests/test_matrix.cpp
    tests/test_matrix_properties.cpp
    tests/test_neural_net.cpp
    tests/test_server_api.cpp
  )
  target_link_libraries(fast_mnist_tests
    PRIVATE
      fast_mnist
      Catch2::Catch2WithMain
      # rapidcheck_catch is INTERFACE and already transitively links
      # the rapidcheck static lib, so listing it alone is enough.
      # Adding rapidcheck a second time triggers a linker warning on
      # macOS ("ignoring duplicate libraries").
      rapidcheck_catch
  )

  include(Catch)
  catch_discover_tests(fast_mnist_tests)
endif()

if(FAST_MNIST_ENABLE_BENCHMARKS)
  include(FetchContent)
  FetchContent_Declare(
    benchmark
    GIT_REPOSITORY https://github.com/google/benchmark.git
    GIT_TAG v1.9.1
  )
  set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(benchmark)

  add_executable(fast_mnist_benchmarks
    benchmarks/bench_matrix.cpp
  )
  target_link_libraries(fast_mnist_benchmarks
    PRIVATE fast_mnist benchmark::benchmark
  )
endif()

if(FAST_MNIST_ENABLE_DOXYGEN)
  find_package(Doxygen QUIET)
  if(DOXYGEN_FOUND)
    add_custom_target(docs
      COMMAND ${DOXYGEN_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/Doxyfile
      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
      COMMENT "Generating Doxygen documentation"
      VERBATIM
    )
  else()
    message(STATUS "Doxygen not found; docs target disabled")
  endif()
endif()

# -------------------------------------------------------------------
# Browser / WebAssembly target
#
# Produces fast_mnist.{js,wasm} when CMake is configured through the
# Emscripten toolchain (emcmake). The JS file is an ES module wrapper
# that lazily loads the wasm; both end up in the web/public/wasm/
# directory via tools/build_wasm.sh. RTTI stays on because Embind's
# class_<>::function() uses dynamic_cast under the hood; turning it
# off triggers link errors even for a trivial wrapper.
# -------------------------------------------------------------------
if(EMSCRIPTEN)
  add_executable(fast_mnist_wasm
    src/Matrix.cpp
    src/NeuralNet.cpp
    wasm/wasm_bindings.cpp
  )
  target_include_directories(fast_mnist_wasm PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
  )
  target_compile_features(fast_mnist_wasm PRIVATE cxx_std_17)
  target_compile_options(fast_mnist_wasm PRIVATE
    -O3
    -msimd128
    # Exceptions + RTTI stay on: Matrix throws std::bad_alloc and
    # NeuralNet::loadBinary throws std::runtime_error on malformed
    # payloads, both of which are valid ways to signal failure back
    # to JS. Embind also relies on RTTI for dynamic_cast.
  )
  # Embind hooks via --bind; module wrapping + memory growth so the
  # browser can ask for more heap if a future model outgrows 16 MB.
  target_link_options(fast_mnist_wasm PRIVATE
    --bind
    -O3
    -sMODULARIZE=1
    -sEXPORT_NAME=createFastMnist
    -sENVIRONMENT=web
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=16MB
    -sSTACK_SIZE=1MB
    -sEXPORT_ES6=1
    -sUSE_ES6_IMPORT_META=1
    # web/vercel.json ships script-src 'self' 'wasm-unsafe-eval', which
    # permits WebAssembly.instantiate but NOT new Function. Embind's
    # craftInvokerFunction reaches new Function on some toolchains, and
    # when it does the factory throws EvalError, the module never loads,
    # and every visitor silently gets the JS fallback. This makes the
    # eval-free property a build requirement instead of a property the
    # current emscripten happens to have.
    -sDYNAMIC_EXECUTION=0
  )
  set_target_properties(fast_mnist_wasm PROPERTIES
    OUTPUT_NAME "fast_mnist"
    SUFFIX ".js"
  )
endif()
