<!-- path: docs/performance-benchmarks.md -->

# Dev Log Viewer: Performance Benchmarks & SLA Verification

This document defines the performance benchmarks, service level agreement (SLA) verification targets, and experimental methodology for **Dev Log Viewer** across multi-gigabyte log datasets.

---

## 1. Definition of "Instantly" (< 1000ms SLA)

In Dev Log Viewer, opening a log file **"instantly"** is defined strictly and measurably as:

> **Time to First Paint SLA**: The time elapsed from when a user selects a file (or the file path is loaded) until the first visible viewport of lines (e.g., initial 50 lines) is fully parsed, decoded, and rendered on screen must be **strictly under 1,000 milliseconds**, with an internal target of **< 20 milliseconds**, regardless of whether the file is **100 MB, 1 GB, 5 GB, or 20 GB**.

### Why Dev Log Viewer Achieves Instant Rendering:
1. **Zero-Copy Memory Mapping (`memmap2`)**: Opening a 20 GB file does not read 20 GB of bytes into user-space heap memory. The OS kernel virtual memory manager maps the file descriptor into process address space in sub-millisecond time.
2. **First-Window Direct Slicing**: The first 50 lines are decoded directly from the beginning of the memory map (`view.as_slice()`) without waiting for the rest of the file to be read or indexed.
3. **Decoupled Asynchronous Indexing**: Full line offset indexing runs concurrently on a Rayon background thread pool without blocking the UI thread. The UI estimates line counts via file size / average line length until the sparse checkpoint index finishes.

---

## 2. Benchmark Honesty Declaration

> [!IMPORTANT]
> **AI Honesty Rule**: Benchmark numbers, throughput rates, and memory footprints for physical hardware execution are never simulated or fabricated. 
> 
> The table below provides standardized `___` placeholders. Human engineers or automated CI runners populate these placeholders with verified outputs produced by `crates/logcore/src/bin/bench_harness.rs`, `scripts/profile_benchmarks.ps1`, or `scripts/profile_benchmarks.sh`.

---

## 3. Test Environment Specifications

Record the host platform details when conducting benchmark runs:

| Parameter | Specification (Fill In) | Example |
| :--- | :--- | :--- |
| **CPU** | `___` | AMD Ryzen 9 7950X / Apple M3 Max / Intel i9-13900K |
| **Physical Cores / Threads** | `___` | 16 Cores / 32 Threads |
| **RAM** | `___` | 32 GB DDR5 6000 MHz |
| **Storage / Disk** | `___` | Samsung 990 Pro PCIe 4.0 NVMe SSD (7450 MB/s read) |
| **Operating System** | `___` | Windows 11 Pro 64-bit / Ubuntu 24.04 LTS / macOS 14.5 |
| **Rust Version** | `___` | rustc 1.99.0 (stable) |
| **LLVM Version** | `___` | 19.x |

---

## 4. Benchmark Execution Commands

To execute reproducible runs across all test sizes on Windows:

```powershell
# Run benchmark suite across 100MB, 1GB, and 5GB datasets
powershell -ExecutionPolicy Bypass -File .\scripts\profile_benchmarks.ps1 -Sizes @("100MB", "1GB", "5GB") -RunHyperfine
```

To execute on Linux or macOS:

```bash
chmod +x ./scripts/profile_benchmarks.sh
./scripts/profile_benchmarks.sh --sizes "100MB 1GB 5GB" --hyperfine
```

---

## 5. Official Benchmark Results Matrix

*All tests executed using release-optimized binaries (`opt-level = 3`, `lto = "thin"`) on synthetic Safaricom Daraja M-Pesa and Africa's Talking mixed log streams.*

| Dataset Size | File Size (Bytes) | Total Lines | Time to First Paint (Target < 1s) | Index Duration | Index Throughput | Sparse Index RAM (Stride 64) | Process Peak RSS | Regex Search Throughput | Structured JSON Query Throughput |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **100 MB** | `___` bytes | `___` lines | `___` ms | `___` s | `___` MB/s | `___` KB | `___` MB | `___` MB/s | `___` MB/s |
| **1 GB** | `___` bytes | `___` lines | `___` ms | `___` s | `___` MB/s | `___` MB | `___` MB | `___` MB/s | `___` MB/s |
| **5 GB** | `___` bytes | `___` lines | `___` ms | `___` s | `___` MB/s | `___` MB | `___` MB | `___` MB/s | `___` MB/s |
| **20 GB** | `___` bytes | `___` lines | `___` ms | `___` s | `___` MB/s | `___` MB | `___` MB | `___` MB/s | `___` MB/s |

---

## 6. Hyperfine Statistical Timing Distribution

*Statistical distributions over multiple warm runs (Warmup: 2 runs, Measured: 5 runs).*

### A. Time to First Paint Latency
| Dataset Size | Mean Latency | Min Latency | Max Latency | StdDev (σ) | SLA Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100 MB** | `___` ms | `___` ms | `___` ms | `___` ms | `___` |
| **1 GB** | `___` ms | `___` ms | `___` ms | `___` ms | `___` |
| **5 GB** | `___` ms | `___` ms | `___` ms | `___` ms | `___` |
| **20 GB** | `___` ms | `___` ms | `___` ms | `___` ms | `___` |

### B. Parallel Full Indexing Throughput
| Dataset Size | Mean Duration | Mean Throughput | Min Duration | Max Duration |
| :--- | :--- | :--- | :--- | :--- |
| **100 MB** | `___` s | `___` MB/s | `___` s | `___` s |
| **1 GB** | `___` s | `___` MB/s | `___` s | `___` s |
| **5 GB** | `___` s | `___` MB/s | `___` s | `___` s |
| **20 GB** | `___` s | `___` MB/s | `___` s | `___` s |

---

## 7. Analysis & Verification Checklist (**MANUAL STEP**)

> [!NOTE]
> This section is completed by the developer following hardware execution.

- [ ] **First Paint SLA Verification**: Confirmed that First Paint is < 1,000 ms across all file sizes (100MB, 1GB, 5GB, 20GB).
- [ ] **Linear Memory Bound Verification**: Confirmed that `LineIndex` heap memory grows at strictly $\approx 125\text{ KB}$ per 1,000,000 lines (stride = 64 u64 offsets = 8 bytes per 64 lines = 0.125 bytes per line).
- [ ] **Process Peak RSS Stability**: Confirmed that total process resident memory remains bounded under 50 MB regardless of dataset size during indexation and regex search.
- [ ] **SIMD Acceleration**: Confirmed `memchr` exploits AVX2 / AVX-512 / NEON vector registers on host architecture.
- [ ] **Hardware Bottleneck Assessment**:
  - *I/O vs CPU Bound*: `___`
  - *Storage read throughput saturation*: `___` MB/s
  - *CPU thread efficiency across Rayon worker pool*: `___`% utilization

