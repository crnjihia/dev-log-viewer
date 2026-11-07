// path: crates/logcore/src/tailer.rs

use crate::index::LineIndex;
use crate::types::{CoreError, TailEvent};
use crossbeam_channel::Sender;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// Returns a unique platform-specific identifier for the physical file.
/// On Unix, returns the inode number; on Windows, returns creation_time;
/// otherwise returns file size as a fallback.
pub fn get_file_identity(path: &Path) -> std::io::Result<u64> {
    let meta = std::fs::metadata(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(meta.ino())
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        Ok(meta.creation_time())
    }
    #[cfg(not(any(unix, windows)))]
    {
        Ok(meta.len())
    }
}

/// Tracks an active log file and coordinates incremental indexing,
/// truncation recovery, and log rotation detection.
pub struct Tailer {
    pub path: PathBuf,
    pub last_file_size: u64,
    pub file_identity: u64,
}

impl Tailer {
    /// Initializes a new Tailer for the given file path
    pub fn open(path: impl AsRef<Path>) -> Result<Self, CoreError> {
        let p = path.as_ref().to_path_buf();
        let meta = std::fs::metadata(&p)?;
        let file_identity = get_file_identity(&p).unwrap_or(0);
        let last_file_size = meta.len();

        Ok(Self {
            path: p,
            last_file_size,
            file_identity,
        })
    }

    /// Polls for file size or identity changes, applying incremental updates to the LineIndex.
    /// Returns:
    /// - Ok(Some(TailEvent::Appended)): New bytes appended and indexed
    /// - Ok(Some(TailEvent::Truncated)): File shrunk; index reset and remapped
    /// - Ok(Some(TailEvent::Rotated)): Inode/creation time changed; index reset and remapped
    /// - Ok(None): No change detected
    pub fn poll_update(&mut self, index: &mut LineIndex) -> Result<Option<TailEvent>, CoreError> {
        let meta = match std::fs::metadata(&self.path) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // File might be transiently moving during rotation
                return Ok(None);
            }
            Err(e) => return Err(CoreError::Io(e)),
        };

        let current_size = meta.len();
        let current_identity = get_file_identity(&self.path).unwrap_or(self.file_identity);

        // 1. Check for file rotation (identity changed while having prior content)
        if current_identity != self.file_identity && self.last_file_size > 0 {
            index.reset(current_size);
            if current_size > 0 {
                let mut file = File::open(&self.path)?;
                let mut buffer = vec![0u8; current_size as usize];
                file.read_exact(&mut buffer)?;
                index.extend_with_appended(&buffer, 0);
            }
            index.set_complete(index.total_lines);
            self.file_identity = current_identity;
            self.last_file_size = current_size;
            return Ok(Some(TailEvent::Rotated {
                new_file_size: current_size,
            }));
        }

        // 2. Check for file truncation (size shrunk)
        if current_size < self.last_file_size {
            index.reset(current_size);
            if current_size > 0 {
                let mut file = File::open(&self.path)?;
                let mut buffer = vec![0u8; current_size as usize];
                file.read_exact(&mut buffer)?;
                index.extend_with_appended(&buffer, 0);
            }
            index.set_complete(index.total_lines);
            self.last_file_size = current_size;
            return Ok(Some(TailEvent::Truncated {
                new_file_size: current_size,
            }));
        }

        // 3. Check for appended content (size increased)
        if current_size > self.last_file_size {
            let bytes_to_read = (current_size - self.last_file_size) as usize;
            let mut file = File::open(&self.path)?;
            file.seek(SeekFrom::Start(self.last_file_size))?;

            let mut buffer = vec![0u8; bytes_to_read];
            file.read_exact(&mut buffer)?;

            let new_lines_count = index.extend_with_appended(&buffer, self.last_file_size);
            self.last_file_size = current_size;

            return Ok(Some(TailEvent::Appended {
                new_lines_count,
                total_lines: index.line_count(),
                new_file_size: current_size,
            }));
        }

        Ok(None)
    }
}

/// Spawns a background thread running a filesystem watcher with periodic polling fallback
pub fn start_tailing(
    path: PathBuf,
    poll_interval: Duration,
    cancel_token: Arc<AtomicBool>,
    event_tx: Sender<TailEvent>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut tailer = match Tailer::open(&path) {
            Ok(t) => t,
            Err(_) => return,
        };

        let mut index = LineIndex::new("tail-index", tailer.last_file_size);

        // Set up notify watcher if available
        let (notify_tx, notify_rx) = crossbeam_channel::unbounded();
        let _watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = notify_tx.send(event);
                }
            },
            Config::default(),
        )
        .and_then(|mut w| {
            w.watch(&path, RecursiveMode::NonRecursive)?;
            Ok(w)
        });

        while !cancel_token.load(Ordering::Relaxed) {
            // Drain any pending notify events
            while notify_rx.try_recv().is_ok() {}

            // Poll for file changes
            if let Ok(Some(event)) = tailer.poll_update(&mut index) {
                if event_tx.send(event).is_err() {
                    break;
                }
            }

            // Sleep with quick cancellation check
            std::thread::sleep(poll_interval);
        }
    })
}
