#!/usr/bin/env bash
# path: scripts/profile_benchmarks.sh
#
# Automated Performance Profiling Script for Dev Log Viewer (logcore) on Linux & macOS.
# Measures:
#   1. Time to First Paint (< 1000ms SLA target)
#   2. Parallel line indexing throughput (MB/s) and bounded memory consumption
#   3. Linear-time regex search throughput (MB/s)
#   4. Structured JSON query throughput (MB/s)
#   5. Process Maximum Resident Set Size (RSS) via /usr/bin/time

set -euo pipefail

OUTPUT_DIR="./target/bench-data"
SIZES=("100MB" "1GB")
SKIP_GEN=0
RUN_HYPERFINE=0

print_usage() {
    cat <<EOF
Usage: ./scripts/profile_benchmarks.sh [options]

Options:
  --output-dir <DIR>    Directory to store test logs and reports (default: ./target/bench-data)
  --sizes <SIZES>       Space-delimited sizes (e.g. "100MB 1GB 5GB") (default: "100MB 1GB")
  --skip-gen            Skip generation if files already exist
  --hyperfine           Run statistical benchmarking via hyperfine if installed
  -h, --help            Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --sizes)
            IFS=' ' read -r -a SIZES <<< "$2"
            shift 2
            ;;
        --skip-gen)
            SKIP_GEN=1
            shift
            ;;
        --hyperfine)
            RUN_HYPERFINE=1
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            print_usage
            exit 1
            ;;
    esac
done

echo "======================================================="
echo "  Dev Log Viewer Performance Profiling Suite (POSIX)  "
echo "======================================================="

echo -e "\n[1/4] Compiling binaries (loggen & bench_harness)..."
BUILD_RELEASE=1
cargo build --release --bin bench_harness --bin loggen || BUILD_RELEASE=0

PROFILE_DIR="release"
if [[ $BUILD_RELEASE -eq 0 || ! -x "./target/release/bench_harness" ]]; then
    echo "Release build not available. Falling back to debug profile..."
    cargo build --bin bench_harness --bin loggen
    PROFILE_DIR="debug"
fi

LOGGEN="./target/${PROFILE_DIR}/loggen"
BENCH_HARNESS="./target/${PROFILE_DIR}/bench_harness"

if [[ ! -x "$LOGGEN" || ! -x "$BENCH_HARNESS" ]]; then
    echo "Error: Binaries not found or not executable in target/${PROFILE_DIR}." >&2
    exit 1
fi
echo "Active binary profile: target/${PROFILE_DIR}"

mkdir -p "$OUTPUT_DIR"

HAS_HYPERFINE=0
if [[ $RUN_HYPERFINE -eq 1 ]]; then
    if command -v hyperfine &>/dev/null; then
        HAS_HYPERFINE=1
        echo "hyperfine detected: $(command -v hyperfine)"
    else
        echo "Warning: hyperfine not found in PATH. Skipping hyperfine runs." >&2
    fi
fi

# Detect time command for RSS tracking
TIME_CMD=""
if [[ "$(uname -s)" == "Linux" ]]; then
    if [[ -x "/usr/bin/time" ]]; then
        TIME_CMD="/usr/bin/time -v"
    fi
elif [[ "$(uname -s)" == "Darwin" ]]; then
    if [[ -x "/usr/bin/time" ]]; then
        TIME_CMD="/usr/bin/time -l"
    fi
fi

JSON_RECORDS=()

for size in "${SIZES[@]}"; do
    echo -e "\n-------------------------------------------------------"
    echo "Benchmarking Dataset Size: $size"
    echo "-------------------------------------------------------"

    LOG_FILE="${OUTPUT_DIR}/bench_${size}.log"

    if [[ ! -f "$LOG_FILE" || $SKIP_GEN -eq 0 ]]; then
        echo "Generating $size mixed test log at $LOG_FILE..."
        START_GEN=$(date +%s%N)
        "$LOGGEN" --size "$size" --format mixed --output "$LOG_FILE"
        END_GEN=$(date +%s%N)
        GEN_DURATION=$(( (END_GEN - START_GEN) / 1000000 ))
        echo "Generation completed in ${GEN_DURATION} ms"
    else
        echo "Found existing dataset at $LOG_FILE. Skipping generation."
    fi

    echo "Running bench_harness performance report..."
    "$BENCH_HARNESS" --file "$LOG_FILE" --action all

    # Collect JSON representation
    JSON_OUTPUT=$("$BENCH_HARNESS" --file "$LOG_FILE" --action all --json)
    JSON_RECORDS+=("$JSON_OUTPUT")

    if [[ -n "$TIME_CMD" ]]; then
        echo -e "\nMeasuring Maximum Resident Set Size (RSS) during full indexing:"
        $TIME_CMD "$BENCH_HARNESS" --file "$LOG_FILE" --action index >/dev/null 2>&1 || true
    fi

    if [[ $HAS_HYPERFINE -eq 1 ]]; then
        echo -e "\nStatistical Benchmarks (hyperfine):"
        echo "1. Time to First Paint:"
        hyperfine --warmup 2 --runs 5 "$BENCH_HARNESS --file '$LOG_FILE' --action first-paint"

        echo "2. Indexing Throughput:"
        hyperfine --warmup 1 --runs 3 "$BENCH_HARNESS --file '$LOG_FILE' --action index"
    fi
done

REPORT_FILE="${OUTPUT_DIR}/benchmark_run_latest.json"
echo "[" > "$REPORT_FILE"
FIRST=1
for record in "${JSON_RECORDS[@]}"; do
    if [[ $FIRST -eq 1 ]]; then
        echo "  $record" >> "$REPORT_FILE"
        FIRST=0
    else
        echo "  ,$record" >> "$REPORT_FILE"
    fi
done
echo "]" >> "$REPORT_FILE"

echo -e "\n======================================================="
echo "Benchmark suite completed successfully."
echo "Raw JSON metrics saved to: $REPORT_FILE"
echo "======================================================="

