// path: crates/logcore/src/reader.rs

use crate::encoding::{decode_lossy, detect_encoding};
use crate::mmap_view::MmapView;
use crate::types::{CoreError, LineMeta, LineWindow, LogLevel};
use memchr::memchr;

/// Default maximum line character length before truncating in the UI viewport
pub const DEFAULT_MAX_LINE_LENGTH: usize = 10_000;

/// Reads a window of lines from an MmapView starting at `start_line` for `count` lines.
/// Normalizes CRLF and LF newlines, decodes lossily, and truncates overly long lines.
pub fn get_lines(
    view: &MmapView,
    file_id: &str,
    start_line: u64,
    count: usize,
    max_line_len: usize,
) -> Result<LineWindow, CoreError> {
    if view.is_empty() {
        return Ok(LineWindow {
            file_id: file_id.to_string(),
            start_line: 0,
            count: 0,
            total_lines_estimated: 0,
            is_indexing_complete: true,
            lines: Vec::new(),
        });
    }

    let bytes = view.as_slice();
    let (encoding, _encoding_name) = detect_encoding(bytes);

    let mut current_line_num: u64 = 0;
    let mut line_start: usize = 0;
    let mut collected_lines = Vec::with_capacity(count.min(1000));
    let total_bytes = bytes.len();

    // Scan through bytes to locate line boundaries
    let mut search_pos = 0;

    while search_pos < total_bytes {
        let line_end = match memchr(b'\n', &bytes[search_pos..]) {
            Some(idx) => search_pos + idx,
            None => total_bytes, // Last line without trailing newline
        };

        if current_line_num >= start_line && collected_lines.len() < count {
            // Extract line slice excluding \n
            let mut raw_slice = &bytes[line_start..line_end];
            // Normalize CRLF: strip trailing \r if present
            if let Some(stripped) = raw_slice.strip_suffix(b"\r") {
                raw_slice = stripped;
            }

            let (decoded_text, _had_errors) = decode_lossy(raw_slice, encoding);

            // Handle very long lines with truncation cap
            let (final_text, is_truncated) = if decoded_text.chars().count() > max_line_len {
                let truncated: String = decoded_text.chars().take(max_line_len).collect();
                (
                    format!(
                        "{}... [LINE TRUNCATED: exceeds {} chars]",
                        truncated, max_line_len
                    ),
                    true,
                )
            } else {
                (decoded_text, false)
            };

            let level = LogLevel::detect_from_line(&final_text);

            collected_lines.push(LineMeta {
                line_number: current_line_num + 1, // 1-based index for UI display
                byte_offset: line_start as u64,
                byte_length: line_end.saturating_sub(line_start),
                level,
                text: final_text,
                matches: Vec::new(),
                is_truncated,
            });
        }

        current_line_num += 1;

        if collected_lines.len() >= count && current_line_num > (start_line + count as u64) {
            // We have satisfied the window request
            break;
        }

        if line_end >= total_bytes {
            break;
        }

        line_start = line_end + 1;
        search_pos = line_start;
    }

    // Rough initial line count estimate based on average bytes per line
    let estimated_total = if current_line_num == 0 {
        1
    } else {
        current_line_num.max(1)
    };

    Ok(LineWindow {
        file_id: file_id.to_string(),
        start_line,
        count: collected_lines.len(),
        total_lines_estimated: estimated_total,
        is_indexing_complete: false,
        lines: collected_lines,
    })
}
