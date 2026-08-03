#!/bin/bash
#
# Line and region coverage for the C++ library, via clang's source-based
# instrumentation.
#
# Deliberately its own build directory and its own script rather than a flag on
# the benchmark harness. Instrumentation adds a counter update on every branch
# and forces -O0, so a coverage build's timings describe a binary nobody ships.
# Keeping the two apart means neither can quietly become the other.
#
# Usage:
#   tools/coverage.sh                 # build, run tests, print the report
#   tools/coverage.sh --html          # also write an HTML report
#   tools/coverage.sh --floor 60      # fail below a line-coverage percentage
#
# Requires llvm-profdata and llvm-cov. On macOS these ship inside Xcode and are
# reached with `xcrun`, NOT from PATH -- a bare `llvm-cov` is usually either
# absent or a Homebrew build whose version disagrees with the compiler that
# produced the profile, which fails with an unhelpful format error.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/build-coverage"
HTML=0
FLOOR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --html)  HTML=1; shift ;;
    --floor) FLOOR="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if command -v xcrun >/dev/null 2>&1; then
  PROFDATA=$(xcrun --find llvm-profdata)
  COV=$(xcrun --find llvm-cov)
else
  PROFDATA=$(command -v llvm-profdata)
  COV=$(command -v llvm-cov)
fi

echo "==> configure"
cmake -S "$ROOT" -B "$BUILD" \
  -DCMAKE_BUILD_TYPE=Debug \
  -DFAST_MNIST_ENABLE_COVERAGE=ON \
  -DFAST_MNIST_ENABLE_BENCHMARKS=OFF \
  -DFAST_MNIST_ENABLE_SERVER=OFF \
  -DBUILD_TESTING=ON >/dev/null

echo "==> build"
cmake --build "$BUILD" -j "$(sysctl -n hw.ncpu 2>/dev/null || nproc)" >/dev/null

echo "==> run tests"
# Each test binary writes its own raw profile; %p keeps concurrent runs from
# clobbering a single file.
rm -rf "$BUILD/profraw"
mkdir -p "$BUILD/profraw"
LLVM_PROFILE_FILE="$BUILD/profraw/%p.profraw" ctest --test-dir "$BUILD" --output-on-failure

echo "==> merge profiles"
"$PROFDATA" merge -sparse "$BUILD"/profraw/*.profraw -o "$BUILD/coverage.profdata"

# Report against the binaries ctest actually runs, asked of ctest rather than
# guessed from a filename pattern. Guessing is how this first failed: the
# executable is `fast_mnist_tests`, and a `test_*` glob matched nothing while
# the suite itself had passed, producing an empty report from a green run.
BINARIES=()
while IFS= read -r line; do
  [ -x "$line" ] && BINARIES+=("$line")
done < <(ctest --test-dir "$BUILD" --show-only=json-v1 2>/dev/null | python3 -c '
import json, sys
d = json.load(sys.stdin)
seen = []
for t in d.get("tests", []):
    cmd = t.get("command")
    if cmd and cmd[0] not in seen:
        seen.append(cmd[0])
print("\n".join(seen))
')

if [ ${#BINARIES[@]} -eq 0 ]; then
  echo "FAIL: found no test binaries to report against — coverage would be empty" >&2
  exit 1
fi

# `${arr[@]}` on an empty array is "unbound" under `set -u` in the bash 3.2 that
# ships with macOS, so every expansion below uses the +"..." guard form.
OBJ_ARGS=()
for b in "${BINARIES[@]:1}"; do OBJ_ARGS+=(-object "$b"); done
EXTRA=(${OBJ_ARGS[@]+"${OBJ_ARGS[@]}"})

# Only the library's own sources. Without this the report is dominated by
# Catch2 and rapidcheck headers pulled in from _deps, which are not this
# project's code and would inflate or deflate the number arbitrarily.
IGNORE='(_deps|/usr/|/Applications/|tests/)'

echo
"$COV" report "${BINARIES[0]}" ${EXTRA[@]+"${EXTRA[@]}"} \
  -instr-profile="$BUILD/coverage.profdata" \
  -ignore-filename-regex="$IGNORE"

if [ "$HTML" -eq 1 ]; then
  "$COV" show "${BINARIES[0]}" ${EXTRA[@]+"${EXTRA[@]}"} \
    -instr-profile="$BUILD/coverage.profdata" \
    -ignore-filename-regex="$IGNORE" \
    -format=html -output-dir="$BUILD/html"
  echo
  echo "HTML report: $BUILD/html/index.html"
fi

if [ -n "$FLOOR" ]; then
  PCT=$("$COV" export "${BINARIES[0]}" ${EXTRA[@]+"${EXTRA[@]}"} \
        -instr-profile="$BUILD/coverage.profdata" \
        -ignore-filename-regex="$IGNORE" \
        -summary-only \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["totals"]["lines"]["percent"])')
  echo
  python3 - "$PCT" "$FLOOR" <<'PY'
import sys
pct, floor = float(sys.argv[1]), float(sys.argv[2])
if pct < floor:
    sys.exit(f"FAIL: line coverage {pct:.1f}% is below the {floor:.1f}% floor")
print(f"OK: line coverage {pct:.1f}% is at or above the {floor:.1f}% floor")
PY
fi
