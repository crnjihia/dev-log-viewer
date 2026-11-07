// path: crates/logcore/src/indexer.rs

use crate::encoding::{decode_lossy, detect_encoding};
use crate::index::{LineIndex, SPARSE_STRIDE};
use crate::mmap_view::MmapView;
use crate::types::{CoreError, IndexProgress, LineMeta, LineWindow, LogLevel};
use crossbeam_channel::Sender;
use memchr::memchr;
use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Default chunk size for parallel background indexing (16 MB)
pub const INDEX_CHUNK_SIZE_BYTES: usize = 16 * 1024 * 1024;

/// Result of scanning a single parallel chunk
struct ChunkScanResult {
    chunk_index: usize,
    chunk_start_byte: usize,
    /// Absolute byte offsets of newlines within the file
    newline_offsets: Vec<usize>,
}

/// Progressively scans a memory-mapped file in parallel chunks using Rayon and SIMD memchr,
/// emitting progress events and yielding a bounded-memory sparse LineIndex.
pub fn build_line_index(
    view: &MmapView,
    file_id: &str,
    progress_tx: Option<&Sender<IndexProgress>>,
    cancel_token: Option<&Arc<AtomicBool>>,
) -> Result<LineIndex, CoreError> {
    let bytes = view.as_slice();
    let total_bytes = bytes.len();

    let mut line_index = LineIndex::new(file_id, total_bytes as u64);

    if total_bytes == 0 {
        line_index.set_complete(0);
        if let Some(tx) = progress_tx {
            let _ = tx.send(IndexProgress {
                file_id: file_id.to_string(),
                bytes_indexed: 0,
                total_bytes: 0,
                lines_indexed: 0,
                percent: 100.0,
                is_done: true,
            });
        }
        return Ok(line_index);
    }

    // Partition the buffer into chunks
    let mut chunk_ranges = Vec::new();
    let mut offset = 0;
    let mut chunk_idx = 0;

    while offset < total_bytes {
        let chunk_len = (total_bytes - offset).min(INDEX_CHUNK_SIZE_BYTES);
        chunk_ranges.push((chunk_idx, offset, chunk_len));
        offset += chunk_len;
        chunk_idx += 1;
    }

    let is_cancelled = || {
        cancel_token
            .map(|t| t.load(Ordering::Relaxed))
            .unwrap_or(false)
    };

    // Scan chunks in parallel using Rayon
    let scan_results: Result<Vec<ChunkScanResult>, CoreError> = chunk_ranges
        .par_iter()
        .map(|&(idx, start, len)| {
            if is_cancelled() {
                return Err(CoreError::Cancelled);
            }

            let slice = &bytes[start..start + len];
            let mut newline_offsets = Vec::with_capacity(slice.len() / 64);

            let mut search_pos = 0;
            while search_pos < slice.len() {
                match memchr(b'\n', &slice[search_pos..]) {
                    Some(found) => {
                        let absolute_nl = start + search_pos + found;
                        newline_offsets.push(absolute_nl);
                        search_pos += found + 1;
                    }
                    None => break,
                }
            }

            Ok(ChunkScanResult {
                chunk_index: idx,
                chunk_start_byte: start,
                newline_offsets,
            })
        })
        .collect();

    let mut results = scan_results?;
    // Ensure chunks are ordered by file offset
    results.sort_by_key(|r| r.chunk_index);

    let mut total_lines: u64 = 0;

    for chunk in results {
        if is_cancelled() {
            return Err(CoreError::Cancelled);
        }

        for nl_offset in chunk.newline_offsets {
            total_lines += 1;
            // Next line begins immediately after the \n byte
            let next_line_start = (nl_offset + 1) as u64;

            if (total_lines as usize).is_multiple_of(SPARSE_STRIDE)
                && next_line_start < (total_bytes as u64)
            {
                line_index.add_checkpoint(next_line_start);
            }
        }

        let bytes_processed = chunk.chunk_start_byte
            + INDEX_CHUNK_SIZE_BYTES.min(total_bytes - chunk.chunk_start_byte);

        if let Some(tx) = progress_tx {
            let percent = ((bytes_processed as f32) / (total_bytes as f32) * 100.0).min(99.9);
            let _ = tx.send(IndexProgress {
                file_id: file_id.to_string(),
                bytes_indexed: bytes_processed as u64,
                total_bytes: total_bytes as u64,
                lines_indexed: total_lines,
                percent,
                is_done: false,
            });
        }
    }

    // If the file does not end with a trailing newline, count the final trailing line
    if total_bytes > 0 && bytes[total_bytes - 1] != b'\n' {
        total_lines += 1;
    }

    line_index.set_complete(total_lines);

    if let Some(tx) = progress_tx {
        let _ = tx.send(IndexProgress {
            file_id: file_id.to_string(),
            bytes_indexed: total_bytes as u64,
            total_bytes: total_bytes as u64,
            lines_indexed: total_lines,
            percent: 100.0,
            is_done: true,
        });
    }

    Ok(line_index)
}

/// Instant random-access window reader using the sparse line index to jump directly
/// to `start_line` without scanning from the start of the file.
pub fn get_lines_indexed(
    index: &LineIndex,
    view: &MmapView,
    start_line: u64,
    count: usize,
    max_line_len: usize,
) -> Result<LineWindow, CoreError> {
    if view.is_empty() || count == 0 {
        return Ok(LineWindow {
            file_id: index.file_id.clone(),
            start_line,
            count: 0,
            total_lines_estimated: index.line_count(),
            is_indexing_complete: index.is_complete,
            lines: Vec::new(),
        });
    }

    let bytes = view.as_slice();
    let (encoding, _) = detect_encoding(bytes);

    let start_offset = match index.line_to_byte_offset(start_line, bytes) {
        Some(offset) => offset as usize,
        None => {
            return Ok(LineWindow {
                file_id: index.file_id.clone(),
                start_line,
                count: 0,
                total_lines_estimated: index.line_count(),
                is_indexing_complete: index.is_complete,
                lines: Vec::new(),
            });
        }
    };

    let total_bytes = bytes.len();
    let mut collected_lines = Vec::with_capacity(count.min(1000));
    let mut line_start = start_offset;
    let mut current_line_num = start_line;

    while line_start < total_bytes && collected_lines.len() < count {
        let line_end = match memchr(b'\n', &bytes[line_start..]) {
            Some(idx) => line_start + idx,
            None => total_bytes,
        };

        let mut raw_slice = &bytes[line_start..line_end];
        if let Some(stripped) = raw_slice.strip_suffix(b"\r") {
            raw_slice = stripped;
        }

        let (decoded_text, _) = decode_lossy(raw_slice, encoding);

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
            line_number: current_line_num + 1,
            byte_offset: line_start as u64,
            byte_length: line_end.saturating_sub(line_start),
            level,
            text: final_text,
            matches: Vec::new(),
            is_truncated,
        });

        current_line_num += 1;

        if line_end >= total_bytes {
            break;
        }
        line_start = line_end + 1;
    }

    Ok(LineWindow {
        file_id: index.file_id.clone(),
        start_line,
        count: collected_lines.len(),
        total_lines_estimated: index.line_count(),
        is_indexing_complete: index.is_complete,
        lines: collected_lines,
    })
}
