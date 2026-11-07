// path: crates/logcore/benches/index_throughput.rs

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use logcore::{build_line_index, MmapView};
use std::io::Write;
use tempfile::NamedTempFile;

/// Creates a synthetic in-memory test file for benchmark iteration
fn create_bench_file(target_bytes: usize) -> NamedTempFile {
    let mut file = NamedTempFile::new().expect("Failed to create bench tempfile");
    let line_template = b"2026-11-07T16:45:00.123+03:00 [INFO] daraja-stk-push trace_id=trc-019283 duration_ms=45 msisdn=+254700000042 receipt=SYN-KES-192837 msg=\"Daraja STK push callback completed\"\n";

    let mut written = 0;
    while written < target_bytes {
        file.write_all(line_template).unwrap();
        written += line_template.len();
    }
    file.flush().unwrap();
    file
}

fn bench_index_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("index_throughput");

    // Benchmarks across 1 MB, 10 MB, and 50 MB synthetic workloads
    for size_mb in [1, 10, 50] {
        let size_bytes = size_mb * 1024 * 1024;
        let file = create_bench_file(size_bytes);
        let view = MmapView::open(file.path()).expect("Failed to map bench file");

        group.throughput(Throughput::Bytes(size_bytes as u64));
        group.bench_with_input(
            BenchmarkId::new("parallel_rayon_memchr", format!("{}MB", size_mb)),
            &view,
            |b, v| {
                b.iter(|| {
                    let index = build_line_index(black_box(v), "bench-file", None, None).unwrap();
                    black_box(index);
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_index_throughput);
criterion_main!(benches);
