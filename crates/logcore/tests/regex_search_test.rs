// path: crates/logcore/tests/regex_search_test.rs

use logcore::{
    build_line_index, byte_range_to_utf16_range, search_mmap, CoreError, MmapView, SearchOptions,
};
use std::io::Write;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;
use tempfile::NamedTempFile;

#[test]
fn test_plain_substring_search() {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "2026-11-07 [INFO] Daraja STK Push initiated").unwrap();
    writeln!(file, "2026-11-07 [ERROR] Africa's Talking SMS failed").unwrap();
    writeln!(
        file,
        "2026-11-07 [INFO] Daraja STK Push callback settled KES 1500"
    )
    .unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "search-test", None, None).unwrap();

    let opts = SearchOptions::default();
    let matches = search_mmap(&view, &index, "STK Push", &opts, None, None).unwrap();

    assert_eq!(matches.len(), 2);
    assert_eq!(matches[0].line_number, 1);
    assert_eq!(matches[1].line_number, 3);
    assert!(!matches[0].matches.is_empty());
}

#[test]
fn test_case_sensitivity_and_whole_word() {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "KES 1500 payment received").unwrap();
    writeln!(file, "kes 2000 payment received").unwrap();
    writeln!(file, "KES_LEDGER 5000").unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "case-test", None, None).unwrap();

    // Case sensitive: only line 1
    let mut opts = SearchOptions {
        case_sensitive: true,
        whole_word: true,
        is_regex: false,
        max_results: None,
    };
    let matches = search_mmap(&view, &index, "KES", &opts, None, None).unwrap();
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].line_number, 1);

    // Case insensitive + whole word: matches line 1 and 2, but not line 3 (KES_LEDGER)
    opts.case_sensitive = false;
    let matches_both = search_mmap(&view, &index, "KES", &opts, None, None).unwrap();
    assert_eq!(matches_both.len(), 2);
    assert_eq!(matches_both[0].line_number, 1);
    assert_eq!(matches_both[1].line_number, 2);
}

#[test]
fn test_regex_pattern_search() {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "Receipt SYN-KES-192834 verified").unwrap();
    writeln!(file, "Receipt SYN-USD-998811 skipped").unwrap();
    writeln!(file, "Receipt SYN-KES-829104 verified").unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "regex-test", None, None).unwrap();

    let opts = SearchOptions {
        case_sensitive: true,
        whole_word: false,
        is_regex: true,
        max_results: None,
    };
    let matches = search_mmap(&view, &index, r"SYN-KES-\d{6}", &opts, None, None).unwrap();

    assert_eq!(matches.len(), 2);
    assert_eq!(matches[0].line_number, 1);
    assert_eq!(matches[1].line_number, 3);
}

#[test]
fn test_utf16_code_unit_conversion() {
    // String with 4-byte emoji: 🚀 is 4 bytes in UTF-8, but 2 code units in UTF-16
    let sample = "Nairobi 🚀 KES 500";
    let match_str = "KES";
    let byte_start = sample.find(match_str).unwrap();
    let byte_end = byte_start + match_str.len();

    let range = byte_range_to_utf16_range(sample, byte_start, byte_end);

    // In UTF-16: "Nairobi " is 8, "🚀" is 2, " " is 1 -> "KES" starts at 11, ends at 14
    assert_eq!(range.start, 11);
    assert_eq!(range.end, 14);
}

#[test]
fn test_catastrophic_backtracking_protection() {
    let mut file = NamedTempFile::new().unwrap();
    // Pathological string for backtracking engines: 30 'a's followed by '!'
    writeln!(file, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!").unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "catastrophic-test", None, None).unwrap();

    // ReDoS pattern: (a+)+$ causes exponential backtracking in non-linear engines
    let opts = SearchOptions {
        case_sensitive: true,
        whole_word: false,
        is_regex: true,
        max_results: None,
    };

    let start = Instant::now();
    let matches = search_mmap(&view, &index, r"(a+)+$", &opts, None, None).unwrap();
    let elapsed = start.elapsed();

    assert!(matches.is_empty());
    // Rust regex finite automata guarantee O(m*n), completing in sub-millisecond
    assert!(
        elapsed.as_millis() < 50,
        "Catastrophic pattern took too long: {:?}",
        elapsed
    );
}

#[test]
fn test_search_cancellation() {
    let mut file = NamedTempFile::new().unwrap();
    for i in 1..=500 {
        writeln!(file, "Transaction line {}", i).unwrap();
    }
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "cancel-search-test", None, None).unwrap();

    let cancel_token = Arc::new(AtomicBool::new(true));
    let opts = SearchOptions::default();

    let result = search_mmap(
        &view,
        &index,
        "Transaction",
        &opts,
        None,
        Some(&cancel_token),
    );
    match result {
        Err(CoreError::Cancelled) => (),
        other => panic!("Expected CoreError::Cancelled, got {:?}", other),
    }
}
