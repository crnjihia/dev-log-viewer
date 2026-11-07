// path: crates/logcore/tests/indexing_test.rs

use crossbeam_channel::unbounded;
use logcore::{build_line_index, get_lines_indexed, CoreError, MmapView, SPARSE_STRIDE};
use std::io::Write;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tempfile::NamedTempFile;

#[test]
fn test_empty_file_indexing() {
    let empty_file = NamedTempFile::new().unwrap();
    let view = MmapView::open(empty_file.path()).unwrap();

    let index = build_line_index(&view, "empty-id", None, None).unwrap();
    assert_eq!(index.total_lines, 0);
    assert!(index.is_complete);

    let window = get_lines_indexed(&index, &view, 0, 10, 1000).unwrap();
    assert_eq!(window.lines.len(), 0);
}

#[test]
fn test_known_line_counts() {
    // Exactly 1 line without newline
    let mut f1 = NamedTempFile::new().unwrap();
    write!(f1, "Single line").unwrap();
    f1.flush().unwrap();
    let v1 = MmapView::open(f1.path()).unwrap();
    let idx1 = build_line_index(&v1, "f1", None, None).unwrap();
    assert_eq!(idx1.total_lines, 1);

    // Exactly 64 lines (exact sparse stride boundary)
    let mut f64 = NamedTempFile::new().unwrap();
    for i in 1..=64 {
        writeln!(f64, "Line {}", i).unwrap();
    }
    f64.flush().unwrap();
    let v64 = MmapView::open(f64.path()).unwrap();
    let idx64 = build_line_index(&v64, "f64", None, None).unwrap();
    assert_eq!(idx64.total_lines, 64);
    assert_eq!(idx64.checkpoints.len(), 1); // Line 0 checkpoint

    // Exactly 200 lines (multiple checkpoints)
    let mut f200 = NamedTempFile::new().unwrap();
    for i in 1..=200 {
        writeln!(f200, "2026-11-07 [INFO] Nairobi payment transaction #{}", i).unwrap();
    }
    f200.flush().unwrap();
    let v200 = MmapView::open(f200.path()).unwrap();
    let idx200 = build_line_index(&v200, "f200", None, None).unwrap();
    assert_eq!(idx200.total_lines, 200);
    // Line 0, Line 64, Line 128, Line 192 -> 4 checkpoints
    assert_eq!(idx200.checkpoints.len(), 4);
}

#[test]
fn test_indexed_random_access_windowing() {
    let mut file = NamedTempFile::new().unwrap();
    for i in 1..=500 {
        writeln!(file, "2026-11-07 [INFO] Daraja transaction item #{:04}", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "random-access-test", None, None).unwrap();

    // Random jump to line 350, fetch 5 lines (lines 351..=355)
    let window = get_lines_indexed(&index, &view, 350, 5, 10_000).unwrap();
    assert_eq!(window.lines.len(), 5);
    assert_eq!(window.lines[0].line_number, 351);
    assert!(window.lines[0].text.contains("item #0351"));
    assert_eq!(window.lines[4].line_number, 355);
    assert!(window.lines[4].text.contains("item #0355"));
}

#[test]
fn test_progress_events_emission() {
    let mut file = NamedTempFile::new().unwrap();
    for i in 1..=2000 {
        writeln!(file, "Log line {} with some arbitrary padding text", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let (tx, rx) = unbounded();

    let index = build_line_index(&view, "progress-test", Some(&tx), None).unwrap();
    assert_eq!(index.total_lines, 2000);

    let mut events = Vec::new();
    while let Ok(evt) = rx.try_recv() {
        events.push(evt);
    }

    assert!(!events.is_empty());
    let last = events.last().unwrap();
    assert!(last.is_done);
    assert_eq!(last.lines_indexed, 2000);
    assert_eq!(last.percent, 100.0);
}

#[test]
fn test_cancellation() {
    let mut file = NamedTempFile::new().unwrap();
    for i in 1..=500 {
        writeln!(file, "Line {}", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let cancel_token = Arc::new(AtomicBool::new(true));

    let result = build_line_index(&view, "cancel-test", None, Some(&cancel_token));
    match result {
        Err(CoreError::Cancelled) => (),
        other => panic!("Expected CoreError::Cancelled, got {:?}", other),
    }
}

#[test]
fn test_bidirectional_line_and_offset_lookup() {
    let mut file = NamedTempFile::new().unwrap();
    for i in 1..=300 {
        writeln!(file, "Record {:05}", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "lookup-test", None, None).unwrap();
    let bytes = view.as_slice();

    for test_line in [0, 1, 63, 64, 65, 128, 200, 299] {
        let offset = index
            .line_to_byte_offset(test_line, bytes)
            .expect("Offset must exist for valid line");
        let resolved_line = index.byte_offset_to_line(offset, bytes);
        assert_eq!(
            resolved_line, test_line,
            "Bidirectional lookup mismatch for line {}",
            test_line
        );
    }
}

#[test]
fn test_bounded_memory_sparse_index() {
    let mut file = NamedTempFile::new().unwrap();
    for i in 1..=1000 {
        writeln!(file, "Record {}", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "memory-test", None, None).unwrap();

    // Checkpoint count must be 1000 / 64 + 1 = 16
    assert_eq!(index.checkpoints.len(), 1000 / SPARSE_STRIDE + 1);
    // Heap memory for 16 checkpoints is well under 512 bytes
    assert!(index.heap_memory_bytes() < 512);
}
