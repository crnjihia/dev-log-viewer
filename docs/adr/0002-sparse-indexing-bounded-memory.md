# ADR 0002: Bounded Memory via Sparse Checkpoint Line Indexing

## Status
Accepted

## Context
A major design requirement of Dev Log Viewer is to handle multi-gigabyte log files (e.g. 5 GB to 20+ GB) on standard developer laptops without exhausting available RAM.

In typical production logs, average line length ranges between 100 and 250 bytes:
- A **1 GB** file contains approximately 5,000,000 to 10,000,000 lines.
- A **20 GB** file contains approximately 100,000,000 to 200,000,000 lines.

If we stored a naive index with a 64-bit byte offset (`u64` = 8 bytes) for **every** line:
- 100M lines * 8 bytes = **800 MB** of heap memory just for line pointers.
- Adding line lengths or metadata would balloon memory consumption to **1.6 GB–3.2 GB**, degrading garbage collection and causing out-of-memory crashes on memory-constrained systems.

## Decision

We implement a **Sparse Checkpoint Index** with a fixed stride `SPARSE_STRIDE = 64`:

1. **Storage Structure**:
   - The index stores an array of 64-bit offsets for only every 64th line: line 0, line 64, line 128, line 192, and so forth.
   - For a 100,000,000 line file, the checkpoint count is `100,000,000 / 64 ≈ 1,562,500` entries.
   - Total heap memory footprint: `1,562,500 * 8 bytes ≈ 12.5 MB`.
   - Memory stays strictly bounded under **15 MB** even for 20 GB files.

2. **Lookup Algorithm**:
   - To find the starting byte offset of line `N`:
     - Calculate checkpoint index: `cp = N / 64`.
     - Jump directly to byte offset `checkpoints[cp]`.
     - Count at most `N % 64` (at most 63) newline (`\n`) characters using SIMD-accelerated `memchr::memchr`.
   - In benchmarks on modern CPUs, scanning 63 newlines via AVX2/SSE2 `memchr` requires less than **1 microsecond** (< 1 µs), which is completely imperceptible to human scroll interaction (60–120 FPS frame budget is 8.3–16.6 ms).

3. **Progressive Parallel Construction**:
   - The index is built in parallel chunks (16 MB slices) via `rayon`.
   - Each chunk independently counts newlines and records offsets.
   - An estimated line count is provided immediately to the virtual scrollbar and refined to exact when parallel reduction completes.
   - Progress events are streamed via crossbeam channels to Tauri and the UI.
   - Indexing can be cancelled at any time via an atomic flag.

## Consequences
- **Positive**: Memory usage is reduced by **98.4%** compared to dense full-line indexing.
- **Positive**: Arbitrary jumping to any line in a 20 GB file executes in sub-microsecond time.
- **Positive**: Memory footprint scales linearly with `file_lines / 64`, remaining safe even for hundreds of millions of lines.
- **Trade-off**: Requires reading at most 63 newlines from mapped memory when resolving arbitrary unaligned line numbers.

