# ADR 0001: Memory-Mapped File Safety, Truncation, and Log Rotation Strategy

## Status
Accepted

## Context
Dev Log Viewer is architected to open multi-gigabyte files instantly without copying data into user-space heap memory. To achieve sub-second time-to-first-paint on 1 GB–20+ GB logs, we employ read-only memory mapping (`memmap2`).

However, memory mapping files that can concurrently change poses two critical operating-system level challenges:
1. **Unix Truncation / SIGBUS Risk**: If a file is truncated while an active `mmap` covers byte offsets beyond the new file length, accessing that memory page triggers a `SIGBUS` signal on Linux/macOS, crashing the process immediately.
2. **Windows File Locking & Rotation Block**: On Windows (NTFS), active memory-mapped sections hold an open kernel section handle. If a background process (such as `logrotate`, a Docker logging driver, or a syslog daemon) attempts to rename, rotate, or delete the mapped file, Windows rejects the file system operation with `ERROR_SHARING_VIOLATION` (os error 32) or `ERROR_ACCESS_DENIED` (os error 5).
3. **Zero-Byte File Restriction**: The `CreateFileMapping` API on Windows returns `ERROR_FILE_INVALID` (os error 1006) when attempting to map a 0-byte file.

## Decision

We adopt the following layered architectural strategy in `logcore`:

### 1. Zero-Length Guard
`MmapView::open()` checks the file metadata length before invoking `memmap2::MmapOptions`. If `file_size == 0`, `MmapView` initializes with an empty representation (`mmap: None`), returning an empty slice `&[]` without invoking the OS mapping syscall.

### 2. Prefix Mapping vs. Append Tail Strategy for Live Tail
- For static file viewing, the file is mapped once read-only (`PAGE_READONLY` / `PROT_READ`).
- When Live Tail mode is activated:
  - We record the file identifier (filesystem device ID and inode on Unix; volume serial number and 64-bit file index via `GetFileInformationByHandle` on Windows).
  - The stable existing length is mapped as the base prefix.
  - Newly appended bytes detected by the `notify` filesystem watcher or polling loop are read via normal standard buffered file descriptors (`std::fs::File` with read seek) rather than immediately remapping.
  - Once the appended delta exceeds a configurable threshold (e.g., 32 MB) or tailing is paused, the mmap is atomically remapped to the new length.

### 3. File Truncation and Rotation Recovery
- Before accessing mapped chunks or when `notify` signals an event:
  - We query current file length.
  - If current length `<` mapped length, a **truncation event** is declared. The existing mapping is discarded immediately, and a fresh mapping for the new smaller length is established before any page is touched.
  - If the file identity (inode / file index) changes or file handle is replaced, a **log rotation event** is declared. The old handle is closed cleanly, releasing the Windows file lock, and the new active file is opened.

### 4. Bounded Viewport Windowing
The UI virtualized viewport asks only for line windows (`get_lines(start_line, count)`). The reader translates requests into byte ranges and performs bounds checks against the verified file length, preventing out-of-bounds page faults.

## Consequences
- **Positive**: Eliminates `SIGBUS` crashes on Unix when log files are truncated or cleared (`> file.log`).
- **Positive**: Prevents Windows file locking from breaking external log rotation daemons.
- **Positive**: 0-byte log files open immediately without errors.
- **Trade-off**: Remapping during heavy active writes requires coordination with the search and indexing thread pool.

