// path: crates/logcore/src/index.rs

use memchr::memchr;

/// Checkpoint interval: Store a 64-bit byte offset once every 64 lines.
/// For 100M lines, this requires only (100M / 64) * 8 bytes ≈ 12.5 MB of RAM.
pub const SPARSE_STRIDE: usize = 64;

/// Compact sparse line index storing checkpoints every 64 lines for bounded memory
#[derive(Debug, Clone)]
pub struct LineIndex {
    pub file_id: String,
    pub total_lines: u64,
    pub total_bytes: u64,
    /// Byte offsets of line 0, line 64, line 128, etc.
    pub checkpoints: Vec<u64>,
    pub is_complete: bool,
}

impl LineIndex {
    pub fn new(file_id: &str, total_bytes: u64) -> Self {
        let mut checkpoints = Vec::new();
        // Line 0 is always at byte offset 0 if file is not empty
        if total_bytes > 0 {
            checkpoints.push(0);
        }

        Self {
            file_id: file_id.to_string(),
            total_lines: 0,
            total_bytes,
            checkpoints,
            is_complete: false,
        }
    }

    /// Appends a new 64th-line checkpoint byte offset
    pub fn add_checkpoint(&mut self, byte_offset: u64) {
        self.checkpoints.push(byte_offset);
    }

    /// Marks indexing as complete with the exact verified line count
    pub fn set_complete(&mut self, total_lines: u64) {
        self.total_lines = total_lines;
        self.is_complete = true;
    }

    /// Returns the estimated total lines while indexing, or the exact count once complete
    pub fn line_count(&self) -> u64 {
        if self.is_complete {
            self.total_lines
        } else {
            // Rough estimate: number of checkpoints * 64
            (self.checkpoints.len() as u64) * (SPARSE_STRIDE as u64)
        }
    }

    /// Resolves the exact byte offset for any arbitrary line index (0-based) in sub-microsecond time.
    /// Jumps directly to the nearest sparse checkpoint and scans at most 63 newlines via SIMD memchr.
    pub fn line_to_byte_offset(&self, target_line: u64, bytes: &[u8]) -> Option<u64> {
        if bytes.is_empty() {
            return if target_line == 0 { Some(0) } else { None };
        }

        if self.is_complete && target_line >= self.total_lines {
            return None;
        }

        let checkpoint_idx = (target_line as usize) / SPARSE_STRIDE;
        if checkpoint_idx >= self.checkpoints.len() {
            return None;
        }

        let checkpoint_offset = self.checkpoints[checkpoint_idx] as usize;
        let lines_to_advance = (target_line as usize) % SPARSE_STRIDE;

        if lines_to_advance == 0 {
            return Some(checkpoint_offset as u64);
        }

        let mut current_pos = checkpoint_offset;
        let mut lines_found = 0;

        while current_pos < bytes.len() && lines_found < lines_to_advance {
            match memchr(b'\n', &bytes[current_pos..]) {
                Some(idx) => {
                    current_pos += idx + 1;
                    lines_found += 1;
                }
                None => {
                    // Reached end of file
                    if lines_found + 1 == lines_to_advance {
                        return Some(bytes.len() as u64);
                    }
                    return None;
                }
            }
        }

        if lines_found == lines_to_advance {
            Some(current_pos as u64)
        } else {
            None
        }
    }

    /// Resolves the line number corresponding to a given byte offset using binary search on checkpoints
    pub fn byte_offset_to_line(&self, byte_offset: u64, bytes: &[u8]) -> u64 {
        if self.checkpoints.is_empty() || byte_offset == 0 {
            return 0;
        }

        // Binary search the closest checkpoint offset <= byte_offset
        let checkpoint_idx = match self.checkpoints.binary_search(&byte_offset) {
            Ok(exact) => exact,
            Err(insertion_point) => insertion_point.saturating_sub(1),
        };

        let base_line = (checkpoint_idx as u64) * (SPARSE_STRIDE as u64);
        let start_pos = self.checkpoints[checkpoint_idx] as usize;
        let target_pos = (byte_offset as usize).min(bytes.len());

        if start_pos >= target_pos {
            return base_line;
        }

        // Count newlines between checkpoint and target_pos
        let mut count = 0;
        let mut pos = start_pos;
        while pos < target_pos {
            match memchr(b'\n', &bytes[pos..target_pos]) {
                Some(idx) => {
                    count += 1;
                    pos += idx + 1;
                }
                None => break,
            }
        }

        base_line + count
    }

    /// Returns the exact heap memory consumption of the index in bytes
    pub fn heap_memory_bytes(&self) -> usize {
        self.checkpoints.capacity() * std::mem::size_of::<u64>()
    }

    /// Incrementally extends the sparse index with newly appended bytes.
    pub fn extend_with_appended(&mut self, appended_bytes: &[u8], base_offset: u64) -> usize {
        if appended_bytes.is_empty() {
            return 0;
        }

        let mut current_offset = base_offset;
        let mut new_lines = 0;
        let mut slice = appended_bytes;

        while let Some(pos) = memchr(b'\n', slice) {
            self.total_lines += 1;
            new_lines += 1;
            current_offset += (pos + 1) as u64;

            if (self.total_lines as usize).is_multiple_of(SPARSE_STRIDE) {
                self.checkpoints.push(current_offset);
            }

            slice = &slice[pos + 1..];
        }

        self.total_bytes = base_offset + appended_bytes.len() as u64;
        new_lines
    }

    /// Resets the index when a file is truncated or rotated
    pub fn reset(&mut self, new_total_bytes: u64) {
        self.total_lines = 0;
        self.total_bytes = new_total_bytes;
        self.checkpoints.clear();
        if new_total_bytes > 0 {
            self.checkpoints.push(0);
        }
        self.is_complete = false;
    }
}
