// path: crates/logcore/src/mmap_view.rs

use crate::types::CoreError;
use memmap2::Mmap;
use std::fs::File;
use std::path::{Path, PathBuf};

/// Safe memory-mapped file viewer supporting multi-gigabyte log access
pub struct MmapView {
    path: PathBuf,
    file_size: u64,
    mmap: Option<Mmap>,
}

impl MmapView {
    /// Opens and memory-maps a file in read-only mode. Empty (0-byte) files are handled gracefully without panicking.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, CoreError> {
        let p = path.as_ref().to_path_buf();
        let file = File::open(&p)?;
        let metadata = file.metadata()?;
        let file_size = metadata.len();

        if file_size == 0 {
            return Ok(Self {
                path: p,
                file_size: 0,
                mmap: None,
            });
        }

        // Safety: We map the file with read-only access.
        // We ensure length > 0 since Windows and Linux mmap fail on zero-length files.
        let mmap = unsafe {
            memmap2::MmapOptions::new()
                .map(&file)
                .map_err(|e| CoreError::Mmap(format!("Failed to map {}: {}", p.display(), e)))?
        };

        Ok(Self {
            path: p,
            file_size,
            mmap: Some(mmap),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn file_size(&self) -> u64 {
        self.file_size
    }

    pub fn is_empty(&self) -> bool {
        self.file_size == 0
    }

    /// Access the entire memory-mapped slice
    pub fn as_slice(&self) -> &[u8] {
        match &self.mmap {
            Some(m) => &m[..],
            None => &[],
        }
    }

    /// Bounds-checked subslice retrieval
    pub fn slice(&self, offset: u64, length: usize) -> Result<&[u8], CoreError> {
        if offset > self.file_size {
            return Err(CoreError::Index(format!(
                "Requested offset {} exceeds file size {}",
                offset, self.file_size
            )));
        }

        let start = offset as usize;
        let end = start
            .checked_add(length)
            .ok_or_else(|| CoreError::Index("Requested slice length overflow".into()))?;

        if end as u64 > self.file_size {
            return Err(CoreError::Index(format!(
                "Requested slice end {} exceeds file size {}",
                end, self.file_size
            )));
        }

        Ok(&self.as_slice()[start..end])
    }
}
