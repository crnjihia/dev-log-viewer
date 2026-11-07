// path: crates/logcore/src/lib.rs

pub mod encoding;
pub mod index;
pub mod indexer;
pub mod mmap_view;
pub mod reader;
pub mod search;
pub mod tailer;
pub mod types;

pub use encoding::{decode_lossy, detect_encoding};
pub use index::{LineIndex, SPARSE_STRIDE};
pub use indexer::{build_line_index, get_lines_indexed, INDEX_CHUNK_SIZE_BYTES};
pub use mmap_view::MmapView;
pub use reader::{get_lines, DEFAULT_MAX_LINE_LENGTH};
pub use search::{
    build_regex, byte_range_to_utf16_range, compile_query, evaluate_predicate, extract_field_paths,
    resolve_field, sample_json_fields, search_json_mmap, search_mmap, Operator, Predicate,
    QueryValue, SearchBatch, SearchOptions,
};
pub use tailer::{get_file_identity, start_tailing, Tailer};
pub use types::{
    CoreError, IndexProgress, LineMeta, LineWindow, LogFileMeta, LogLevel, MatchRange, TailEvent,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_detection() {
        assert_eq!(
            LogLevel::detect_from_line("2026-11-07 16:45:00 [ERROR] Daraja STK timeout"),
            LogLevel::Error
        );
        assert_eq!(
            LogLevel::detect_from_line("{\"timestamp\":\"2026-11-07T13:45:00Z\",\"level\":\"warn\",\"msg\":\"retry queued\"}"),
            LogLevel::Warn
        );
        assert_eq!(
            LogLevel::detect_from_line(
                "2026-11-07 16:45:00 [INFO] M-Pesa receipt SYN-KES-10294 processed"
            ),
            LogLevel::Info
        );
        assert_eq!(
            LogLevel::detect_from_line("Random debug string"),
            LogLevel::Unknown
        );
    }

    #[test]
    fn test_types_serialization() {
        let meta = LineMeta {
            line_number: 1,
            byte_offset: 0,
            byte_length: 54,
            level: LogLevel::Info,
            text: "Payment confirmation: KES 1500 received".to_string(),
            matches: vec![MatchRange { start: 22, end: 30 }],
            is_truncated: false,
        };

        let json = serde_json::to_string(&meta).expect("Serialization failed");
        assert!(json.contains("\"level\":\"info\""));
        assert!(json.contains("\"line_number\":1"));
    }
}
