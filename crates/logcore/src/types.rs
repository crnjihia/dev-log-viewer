// path: crates/logcore/src/types.rs

use serde::de::Deserializer;
use serde::ser::{SerializeStruct, Serializer};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Core error types for logcore operations
#[derive(Debug)]
pub enum CoreError {
    Io(std::io::Error),
    Mmap(String),
    InvalidLineRange {
        start: u64,
        count: usize,
        total: u64,
    },
    RegexCompile(regex::Error),
    QueryParse {
        position: usize,
        message: String,
    },
    Index(String),
    Cancelled,
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoreError::Io(err) => write!(f, "I/O error: {}", err),
            CoreError::Mmap(msg) => write!(f, "File mapping error: {}", msg),
            CoreError::InvalidLineRange {
                start,
                count,
                total,
            } => {
                write!(
                    f,
                    "Invalid line range: requested start {}, count {}, total lines {}",
                    start, count, total
                )
            }
            CoreError::RegexCompile(err) => write!(f, "Regex compile error: {}", err),
            CoreError::QueryParse { position, message } => {
                write!(
                    f,
                    "Query parse error at character {}: {}",
                    position, message
                )
            }
            CoreError::Index(msg) => write!(f, "File index error: {}", msg),
            CoreError::Cancelled => write!(f, "Operation cancelled"),
        }
    }
}

impl std::error::Error for CoreError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            CoreError::Io(err) => Some(err),
            CoreError::RegexCompile(err) => Some(err),
            _ => None,
        }
    }
}

impl From<std::io::Error> for CoreError {
    fn from(err: std::io::Error) -> Self {
        CoreError::Io(err)
    }
}

impl From<regex::Error> for CoreError {
    fn from(err: regex::Error) -> Self {
        CoreError::RegexCompile(err)
    }
}

/// Standardized log severity level detected from line content
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
    Unknown,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Error => "error",
            LogLevel::Warn => "warn",
            LogLevel::Info => "info",
            LogLevel::Debug => "debug",
            LogLevel::Trace => "trace",
            LogLevel::Unknown => "unknown",
        }
    }

    pub fn from_str_loose(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "error" | "err" | "fatal" | "critical" => LogLevel::Error,
            "warn" | "warning" => LogLevel::Warn,
            "info" => LogLevel::Info,
            "debug" => LogLevel::Debug,
            "trace" => LogLevel::Trace,
            _ => LogLevel::Unknown,
        }
    }

    /// Fast heuristic check for common severity prefixes
    pub fn detect_from_line(line: &str) -> Self {
        let upper = line.trim_start();
        if upper.starts_with("ERROR")
            || upper.contains(" level=error")
            || upper.contains("\"level\":\"error\"")
            || upper.contains("[ERROR]")
            || upper.contains("CRITICAL")
        {
            LogLevel::Error
        } else if upper.starts_with("WARN")
            || upper.contains(" level=warn")
            || upper.contains("\"level\":\"warn\"")
            || upper.contains("[WARN]")
        {
            LogLevel::Warn
        } else if upper.starts_with("INFO")
            || upper.contains(" level=info")
            || upper.contains("\"level\":\"info\"")
            || upper.contains("[INFO]")
        {
            LogLevel::Info
        } else if upper.starts_with("DEBUG")
            || upper.contains(" level=debug")
            || upper.contains("\"level\":\"debug\"")
            || upper.contains("[DEBUG]")
        {
            LogLevel::Debug
        } else if upper.starts_with("TRACE")
            || upper.contains(" level=trace")
            || upper.contains("\"level\":\"trace\"")
            || upper.contains("[TRACE]")
        {
            LogLevel::Trace
        } else {
            LogLevel::Unknown
        }
    }
}

impl Serialize for LogLevel {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for LogLevel {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(LogLevel::from_str_loose(&s))
    }
}

/// Substring match span represented in UTF-16 code units for frontend compatibility
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchRange {
    pub start: usize,
    pub end: usize,
}

impl Serialize for MatchRange {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("MatchRange", 2)?;
        state.serialize_field("start", &self.start)?;
        state.serialize_field("end", &self.end)?;
        state.end()
    }
}

/// Metadata and rendered text for a single visible log line
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LineMeta {
    pub line_number: u64,
    pub byte_offset: u64,
    pub byte_length: usize,
    pub level: LogLevel,
    pub text: String,
    pub matches: Vec<MatchRange>,
    pub is_truncated: bool,
}

impl Serialize for LineMeta {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("LineMeta", 7)?;
        state.serialize_field("line_number", &self.line_number)?;
        state.serialize_field("byte_offset", &self.byte_offset)?;
        state.serialize_field("byte_length", &self.byte_length)?;
        state.serialize_field("level", &self.level)?;
        state.serialize_field("text", &self.text)?;
        state.serialize_field("matches", &self.matches)?;
        state.serialize_field("is_truncated", &self.is_truncated)?;
        state.end()
    }
}

/// Window of lines retrieved for the virtualized log pane
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LineWindow {
    pub file_id: String,
    pub start_line: u64,
    pub count: usize,
    pub total_lines_estimated: u64,
    pub is_indexing_complete: bool,
    pub lines: Vec<LineMeta>,
}

impl Serialize for LineWindow {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("LineWindow", 6)?;
        state.serialize_field("file_id", &self.file_id)?;
        state.serialize_field("start_line", &self.start_line)?;
        state.serialize_field("count", &self.count)?;
        state.serialize_field("total_lines_estimated", &self.total_lines_estimated)?;
        state.serialize_field("is_indexing_complete", &self.is_indexing_complete)?;
        state.serialize_field("lines", &self.lines)?;
        state.end()
    }
}

/// Progress event emitted during progressive background indexing
#[derive(Debug, Clone, PartialEq)]
pub struct IndexProgress {
    pub file_id: String,
    pub bytes_indexed: u64,
    pub total_bytes: u64,
    pub lines_indexed: u64,
    pub percent: f32,
    pub is_done: bool,
}

impl Serialize for IndexProgress {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("IndexProgress", 6)?;
        state.serialize_field("file_id", &self.file_id)?;
        state.serialize_field("bytes_indexed", &self.bytes_indexed)?;
        state.serialize_field("total_bytes", &self.total_bytes)?;
        state.serialize_field("lines_indexed", &self.lines_indexed)?;
        state.serialize_field("percent", &self.percent)?;
        state.serialize_field("is_done", &self.is_done)?;
        state.end()
    }
}

/// High-level file summary metadata
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LogFileMeta {
    pub file_id: String,
    pub path: String,
    pub file_size_bytes: u64,
    pub line_count_estimated: u64,
    pub is_indexed: bool,
    pub detected_encoding: String,
}

impl Serialize for LogFileMeta {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("LogFileMeta", 6)?;
        state.serialize_field("file_id", &self.file_id)?;
        state.serialize_field("path", &self.path)?;
        state.serialize_field("file_size_bytes", &self.file_size_bytes)?;
        state.serialize_field("line_count_estimated", &self.line_count_estimated)?;
        state.serialize_field("is_indexed", &self.is_indexed)?;
        state.serialize_field("detected_encoding", &self.detected_encoding)?;
        state.end()
    }
}

/// Live tail filesystem event emitted during incremental tailing, truncation, or rotation
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TailEvent {
    Appended {
        new_lines_count: usize,
        total_lines: u64,
        new_file_size: u64,
    },
    Truncated {
        new_file_size: u64,
    },
    Rotated {
        new_file_size: u64,
    },
}

impl Serialize for TailEvent {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            TailEvent::Appended {
                new_lines_count,
                total_lines,
                new_file_size,
            } => {
                let mut state = serializer.serialize_struct("TailEvent", 4)?;
                state.serialize_field("type", "appended")?;
                state.serialize_field("new_lines_count", new_lines_count)?;
                state.serialize_field("total_lines", total_lines)?;
                state.serialize_field("new_file_size", new_file_size)?;
                state.end()
            }
            TailEvent::Truncated { new_file_size } => {
                let mut state = serializer.serialize_struct("TailEvent", 2)?;
                state.serialize_field("type", "truncated")?;
                state.serialize_field("new_file_size", new_file_size)?;
                state.end()
            }
            TailEvent::Rotated { new_file_size } => {
                let mut state = serializer.serialize_struct("TailEvent", 2)?;
                state.serialize_field("type", "rotated")?;
                state.serialize_field("new_file_size", new_file_size)?;
                state.end()
            }
        }
    }
}
