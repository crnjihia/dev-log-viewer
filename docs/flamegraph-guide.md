<!-- path: docs/flamegraph-guide.md -->

# CPU Flamegraph Profiling Guide for `logcore`

This guide explains how to generate, analyze, and optimize CPU flamegraphs for the core engine of **Dev Log Viewer** (`crates/logcore`). Flamegraphs visualize the runtime profile of CPU stacks, where the horizontal axis represents 100% of the recorded CPU time and the vertical axis represents call-stack depth.

---

## 1. Prerequisites and Installation

### A. Installing `cargo-flamegraph`
```bash
cargo install flamegraph
```

### B. Platform-Specific Profiler Backends

#### **Linux (Recommended for lowest profiling overhead)**
Ensure `perf` is installed:
```bash
# Ubuntu / Debian
sudo apt-get install -y linux-tools-common linux-tools-generic linux-tools-$(uname -r)

# Allow non-root profiling of kernel/user symbols
echo -1 | sudo tee /proc/sys/kernel/perf_event_paranoid
echo 0 | sudo tee /proc/sys/kernel/kptr_restrict
```

#### **macOS**
Uses macOS DTrace:
```bash
# SIP (System Integrity Protection) may require running with sudo:
sudo cargo flamegraph --bin bench_harness -- [args...]
```

#### **Windows**
On Windows 11 / Windows 10, there are two supported paths:
1. **DTrace for Windows**:
   - Enable `dtrace` in Developer Mode or via Windows Features.
   - Run in an elevated Administrator PowerShell prompt:
     ```powershell
     cargo flamegraph --bin bench_harness -- [args...]
     ```
2. **Visual Studio Performance Profiler / Windows Performance Recorder (WPR)**:
   - Profile the release binary `target\release\bench_harness.exe` directly using CPU Usage sampling.
   - Export to `.diagsession` or ETL trace and open in Windows Performance Analyzer (WPA).

---

## 2. Compiler Profile Configuration

To get clean function symbols with line numbers without sacrificing release-level compiler optimizations (SIMD vectorization, inlining), verify that `Cargo.toml` has debug symbols enabled for the release profile:

```toml
[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
debug = true # Embeds DWARF / PDB symbols for profilers
```

---

## 3. Profiling Workloads

The `bench_harness` CLI tool allows targeted profiling of distinct subsystems:

### A. Parallel Line Indexing (`--action index`)
Profiles the Rayon parallel work-stealing chunks, sparse offset recording (stride 64), and vectorized newline scanning via `memchr::memchr`:

```bash
# 1. Generate test file if needed:
cargo run --release -p loggen -- --size 1GB --format mixed --output target/bench-data/bench_1gb.log

# 2. Capture indexing flamegraph:
cargo flamegraph --bin bench_harness -o flamegraph_index.svg -- \
  --file target/bench-data/bench_1gb.log \
  --action index
```

**Expected Flamegraph Profile**:
- Wide frames in `rayon::iter::ParallelIterator` and worker pool threads.
- Dominated by `memchr::memchr` (SIMD vector loop checking 16/32/64 bytes per cycle for `\n`).
- Very narrow overhead in `LineIndex::push_checkpoint` because stride 64 checkpoints amortize memory writes.

---

### B. Streaming Regex Search (`--action regex-search`)
Profiles the memory-mapped linear regex engine, multi-pattern match streaming, and UTF-16 code unit position translation:

```bash
cargo flamegraph --bin bench_harness -o flamegraph_regex.svg -- \
  --file target/bench-data/bench_1gb.log \
  --action regex-search \
  --query "DAR-STK-FAILED"
```

**Expected Flamegraph Profile**:
- Fast literal pre-filter skipping non-matching blocks.
- Non-backtracking linear scan via `regex::bytes::Regex`.
- Minimal allocation in inner matching loop.

---

### C. Structured JSON-Lines Querying (`--action json-query`)
Profiles tokenization, parse tree evaluation, and zero-copy string comparison on unstructured and semi-structured lines:

```bash
cargo flamegraph --bin bench_harness -o flamegraph_json.svg -- \
  --file target/bench-data/bench_1gb.log \
  --action json-query \
  --query 'status:"FAILED" AND amount > 5000'
```

**Expected Flamegraph Profile**:
- `json_query::search_json_mmap` scanning line by line.
- Fast heuristic validation checking for `{` before running `serde_json::from_slice`.
- Zero-alloc evaluation for lines failing the initial fast-path filter.

---

## 4. How to Interpret the Resulting Flamegraph

1. **Width = Execution Time**: The horizontal width of any box corresponds to the fraction of total CPU time spent in that function (including its callees).
2. **Top-Level Flat Plateaus**: Functions at the top of the stack with wide, flat tops are CPU hotspots performing active computation (e.g. `memchr`, SIMD comparison loops, byte slicing).
3. **Unexpected Spikes or Recursion**:
   - Tall towers indicate deep call stacks or recursion.
   - Wide valleys between Rayon chunks indicate lock contention, cache misses, or thread synchronization barriers.
4. **Memory Allocation in Loops**:
   - Look for frames like `alloc::alloc::exchange_malloc` or `malloc`. Inner search loops must be zero-allocation. If `alloc` appears in the search or index hot path, replace owned `String` or `Vec` allocations with slice borrows or reusable scratch buffers.

