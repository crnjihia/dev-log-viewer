// path: crates/logcore/src/search/regex_engine.rs

use crate::encoding::{decode_lossy, detect_encoding};
use crate::index::LineIndex;
use crate::mmap_view::MmapView;
use crate::types::{CoreError, LineMeta, LogLevel, MatchRange};
use crossbeam_channel::Sender;
use memchr::memchr;
use regex::{Regex, RegexBuilder};
use serde::ser::{SerializeStruct, Serializer};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Search query configuration options
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub is_regex: bool,
    pub max_results: Option<usize>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            max_results: Some(10_000),
        }
    }
}

impl Serialize for SearchOptions {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("SearchOptions", 4)?;
        state.serialize_field("case_sensitive", &self.case_sensitive)?;
        state.serialize_field("whole_word", &self.whole_word)?;
        state.serialize_field("is_regex", &self.is_regex)?;
        state.serialize_field("max_results", &self.max_results)?;
        state.end()
    }
}

/// A batch of streaming search results emitted to the UI
#[derive(Debug, Clone)]
pub struct SearchBatch {
    pub matches: Vec<LineMeta>,
    pub lines_searched: u64,
    pub total_lines: u64,
    pub is_done: bool,
}

impl Serialize for SearchBatch {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("SearchBatch", 4)?;
        state.serialize_field("matches", &self.matches)?;
        state.serialize_field("lines_searched", &self.lines_searched)?;
        state.serialize_field("total_lines", &self.total_lines)?;
        state.serialize_field("is_done", &self.is_done)?;
        state.end()
    }
}

/// Converts UTF-8 byte offsets into UTF-16 code unit offsets for precise JavaScript / DOM highlighting.
/// Handles multi-byte characters (emojis, accented Swahili letters, Unicode symbols) accurately.
pub fn byte_range_to_utf16_range(text: &str, byte_start: usize, byte_end: usize) -> MatchRange {
    let mut utf16_offset = 0;
    let mut utf16_start = 0;
    let mut utf16_end = 0;

    for (b_idx, ch) in text.char_indices() {
        if b_idx == byte_start {
            utf16_start = utf16_offset;
        }
        if b_idx == byte_end {
            utf16_end = utf16_offset;
            break;
        }
        utf16_offset += ch.len_utf16();
    }

    if byte_end >= text.len() {
        utf16_end = utf16_offset;
    }

    MatchRange {
        start: utf16_start,
        end: utf16_end,
    }
}

/// Compiles a search pattern into a linear-time guaranteed Regex.
///
/// Note on Catastrophic Backtracking Protection:
/// The Rust `regex` crate uses finite automata (Thompson NFA / PikeVM / Lazy DFA).
/// It guarantees worst-case execution time of O(m * n) where m is pattern length and
/// n is text length. Exponential catastrophic backtracking (ReDoS) is mathematically
/// impossible in this engine, ensuring safety against malicious or accidental user regexes.
pub fn build_regex(query: &str, options: &SearchOptions) -> Result<Regex, CoreError> {
    if query.is_empty() {
        return Err(CoreError::QueryParse {
            position: 0,
            message: "Search query cannot be empty".into(),
        });
    }

    let pattern = if options.is_regex {
        if options.whole_word {
            format!(r"\b(?:{})\b", query)
        } else {
            query.to_string()
        }
    } else {
        let escaped = regex::escape(query);
        if options.whole_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        }
    };

    RegexBuilder::new(&pattern)
        .case_insensitive(!options.case_sensitive)
        .multi_line(false)
        .dot_matches_new_line(false)
        .size_limit(10 * 1024 * 1024) // 10MB compiled regex limit
        .build()
        .map_err(CoreError::RegexCompile)
}

/// Executes a streaming search over a memory-mapped file, streaming batches of matches.
pub fn search_mmap(
    view: &MmapView,
    index: &LineIndex,
    query: &str,
    options: &SearchOptions,
    batch_tx: Option<&Sender<SearchBatch>>,
    cancel_token: Option<&Arc<AtomicBool>>,
) -> Result<Vec<LineMeta>, CoreError> {
    if view.is_empty() || query.is_empty() {
        return Ok(Vec::new());
    }

    let regex = build_regex(query, options)?;
    let bytes = view.as_slice();
    let (encoding, _) = detect_encoding(bytes);

    let is_cancelled = || {
        cancel_token
            .map(|t| t.load(Ordering::Relaxed))
            .unwrap_or(false)
    };

    let total_bytes = bytes.len();
    let total_lines = index.line_count();
    let max_results = options.max_results.unwrap_or(usize::MAX);

    let mut all_matches = Vec::new();
    let mut batch_accumulator = Vec::new();

    let mut line_num: u64 = 0;
    let mut line_start: usize = 0;
    let mut search_pos: usize = 0;

    const BATCH_SIZE: usize = 100;

    while search_pos < total_bytes {
        if is_cancelled() {
            return Err(CoreError::Cancelled);
        }

        let line_end = match memchr(b'\n', &bytes[search_pos..]) {
            Some(idx) => search_pos + idx,
            None => total_bytes,
        };

        let mut raw_slice = &bytes[line_start..line_end];
        if let Some(stripped) = raw_slice.strip_suffix(b"\r") {
            raw_slice = stripped;
        }

        let (decoded_text, _) = decode_lossy(raw_slice, encoding);

        // Find all regex matches within this line
        let mut match_ranges = Vec::new();
        for m in regex.find_iter(&decoded_text) {
            let utf16_range = byte_range_to_utf16_range(&decoded_text, m.start(), m.end());
            match_ranges.push(utf16_range);
        }

        if !match_ranges.is_empty() {
            let level = LogLevel::detect_from_line(&decoded_text);

            let meta = LineMeta {
                line_number: line_num + 1,
                byte_offset: line_start as u64,
                byte_length: line_end.saturating_sub(line_start),
                level,
                text: decoded_text,
                matches: match_ranges,
                is_truncated: false,
            };

            batch_accumulator.push(meta.clone());
            all_matches.push(meta);

            if batch_accumulator.len() >= BATCH_SIZE {
                if let Some(tx) = batch_tx {
                    let _ = tx.send(SearchBatch {
                        matches: std::mem::take(&mut batch_accumulator),
                        lines_searched: line_num + 1,
                        total_lines,
                        is_done: false,
                    });
                }
            }

            if all_matches.len() >= max_results {
                break;
            }
        }

        line_num += 1;
        if line_end >= total_bytes {
            break;
        }
        line_start = line_end + 1;
        search_pos = line_start;
    }

    if let Some(tx) = batch_tx {
        let _ = tx.send(SearchBatch {
            matches: batch_accumulator,
            lines_searched: line_num,
            total_lines,
            is_done: true,
        });
    }

    Ok(all_matches)
}
