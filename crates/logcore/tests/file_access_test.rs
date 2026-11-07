// path: crates/logcore/tests/file_access_test.rs

use logcore::{decode_lossy, detect_encoding, get_lines, LogLevel, MmapView};
use std::io::Write;
use tempfile::NamedTempFile;

#[test]
fn test_empty_file_handling() {
    let empty_file = NamedTempFile::new().expect("Failed to create tempfile");
    let view = MmapView::open(empty_file.path()).expect("Opening empty file should succeed");

    assert!(view.is_empty());
    assert_eq!(view.file_size(), 0);
    assert_eq!(view.as_slice(), b"");

    let window = get_lines(&view, "empty-file-id", 0, 50, 10_000)
        .expect("get_lines on empty file must succeed");
    assert_eq!(window.lines.len(), 0);
    assert_eq!(window.total_lines_estimated, 0);
    assert!(window.is_indexing_complete);
}

#[test]
fn test_encoding_detection() {
    // UTF-8 BOM
    let utf8_bom = [0xEF, 0xBB, 0xBF, b'H', b'e', b'l', b'l', b'o'];
    let (_, name) = detect_encoding(&utf8_bom);
    assert_eq!(name, "UTF-8-BOM");

    // UTF-16LE BOM
    let utf16_le = [0xFF, 0xFE, b'H', 0x00, b'i', 0x00];
    let (_, name) = detect_encoding(&utf16_le);
    assert_eq!(name, "UTF-16LE");

    // UTF-16BE BOM
    let utf16_be = [0xFE, 0xFF, 0x00, b'H', 0x00, b'i'];
    let (_, name) = detect_encoding(&utf16_be);
    assert_eq!(name, "UTF-16BE");

    // Standard UTF-8
    let plain_utf8 = b"2026-11-07 [INFO] Daraja STK push received KES 2500";
    let (_, name) = detect_encoding(plain_utf8);
    assert_eq!(name, "UTF-8");
}

#[test]
fn test_lossy_utf8_decoding() {
    let invalid_bytes = vec![b'K', b'E', b'S', 0xFF, b' ', 0xC3, 0x28, b'e', b'r', b'r'];
    let (decoded, had_errors) = decode_lossy(&invalid_bytes, encoding_rs::UTF_8);

    // Decoding must succeed without panic, flag had_errors, and contain the unicode replacement character
    assert!(!decoded.is_empty());
    assert!(decoded.starts_with("KES"));
    assert!(had_errors);
    assert!(decoded.contains('\u{FFFD}'));
}

#[test]
fn test_crlf_and_lf_newline_normalization() {
    let mut file = NamedTempFile::new().expect("Failed to create tempfile");
    writeln!(file, "Line 1: Linux LF").unwrap();
    write!(file, "Line 2: Windows CRLF\r\n").unwrap();
    write!(file, "Line 3: Final line without newline").unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).expect("Failed to open mmap");
    let window = get_lines(&view, "newline-test", 0, 10, 10_000).expect("get_lines failed");

    assert_eq!(window.lines.len(), 3);
    assert_eq!(window.lines[0].text, "Line 1: Linux LF");
    assert_eq!(window.lines[1].text, "Line 2: Windows CRLF");
    assert_eq!(window.lines[2].text, "Line 3: Final line without newline");

    // Ensure no trailing carriage returns remain
    for line in &window.lines {
        assert!(!line.text.ends_with('\r'));
    }
}

#[test]
fn test_windowing_pagination() {
    let mut file = NamedTempFile::new().expect("Failed to create tempfile");
    for i in 1..=100 {
        writeln!(file, "2026-11-07 [INFO] Nairobi log entry #{:03}", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).expect("Failed to open mmap");
    // Request 5 lines starting at index 10 (line 11)
    let window = get_lines(&view, "page-test", 10, 5, 10_000).expect("get_lines failed");

    assert_eq!(window.lines.len(), 5);
    assert_eq!(window.lines[0].line_number, 11);
    assert_eq!(window.lines[0].level, LogLevel::Info);
    assert!(window.lines[0].text.contains("entry #011"));
    assert_eq!(window.lines[4].line_number, 15);
    assert!(window.lines[4].text.contains("entry #015"));
}

#[test]
fn test_line_truncation_cap() {
    let mut file = NamedTempFile::new().expect("Failed to create tempfile");
    let long_line_content = "A".repeat(5000);
    writeln!(file, "Short prefix: {}", long_line_content).unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).expect("Failed to open mmap");
    // Request window with a strict 200 char max
    let window = get_lines(&view, "truncate-test", 0, 1, 200).expect("get_lines failed");

    assert_eq!(window.lines.len(), 1);
    let line = &window.lines[0];
    assert!(line.is_truncated);
    assert!(line.text.contains("LINE TRUNCATED: exceeds 200 chars"));
}

#[test]
fn test_bounds_checked_slice() {
    let mut file = NamedTempFile::new().expect("Failed to create tempfile");
    write!(file, "Hello Nairobi").unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).expect("Failed to open mmap");
    let valid_slice = view.slice(0, 5).expect("Slice 0..5 should succeed");
    assert_eq!(valid_slice, b"Hello");

    // Out of bounds offset
    assert!(view.slice(100, 5).is_err());
    // Out of bounds length
    assert!(view.slice(5, 50).is_err());
}
