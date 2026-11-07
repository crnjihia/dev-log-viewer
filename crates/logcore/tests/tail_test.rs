// path: crates/logcore/tests/tail_test.rs

use logcore::{start_tailing, LineIndex, TailEvent, Tailer};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tempfile::NamedTempFile;

#[test]
fn test_tail_incremental_append() {
    let mut temp = NamedTempFile::new().unwrap();
    for i in 1..=10 {
        writeln!(temp, "2026-11-07 17:00:{:02} [INFO] Startup line {}", i, i).unwrap();
    }
    temp.flush().unwrap();

    let mut tailer = Tailer::open(temp.path()).unwrap();
    let mut index = LineIndex::new("tail-test", tailer.last_file_size);
    index.set_complete(10);

    // Verify initial state: no update yet
    let initial_update = tailer.poll_update(&mut index).unwrap();
    assert_eq!(initial_update, None);

    // Append 15 new lines
    let mut file = OpenOptions::new().append(true).open(temp.path()).unwrap();
    for i in 11..=25 {
        writeln!(
            file,
            "2026-11-07 17:01:{:02} [INFO] Daraja STK transaction SYN-KES-{}",
            i - 10,
            1000 + i
        )
        .unwrap();
    }
    file.flush().unwrap();

    // Poll for update
    let event = tailer.poll_update(&mut index).unwrap();
    match event {
        Some(TailEvent::Appended {
            new_lines_count,
            total_lines,
            new_file_size,
        }) => {
            assert_eq!(new_lines_count, 15);
            assert_eq!(total_lines, 25);
            assert!(new_file_size > 0);
        }
        other => panic!("Expected Appended event, got {:?}", other),
    }

    assert_eq!(index.line_count(), 25);
}

#[test]
fn test_tail_file_truncation_recovery() {
    let mut temp = NamedTempFile::new().unwrap();
    for i in 1..=50 {
        writeln!(temp, "2026-11-07 17:00:{:02} [INFO] Batch job row {}", i, i).unwrap();
    }
    temp.flush().unwrap();

    let mut tailer = Tailer::open(temp.path()).unwrap();
    let mut index = LineIndex::new("trunc-test", tailer.last_file_size);
    index.set_complete(50);

    // Truncate file and write only 3 lines
    {
        let mut file = OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(temp.path())
            .unwrap();
        writeln!(
            file,
            "2026-11-07 17:05:00 [WARN] Log cleared by logrotate daemon"
        )
        .unwrap();
        writeln!(
            file,
            "2026-11-07 17:05:01 [INFO] New service generation 2 started"
        )
        .unwrap();
        writeln!(file, "2026-11-07 17:05:02 [INFO] Health check OK").unwrap();
        file.flush().unwrap();
    }

    let event = tailer.poll_update(&mut index).unwrap();
    match event {
        Some(TailEvent::Truncated { new_file_size }) => {
            assert!(new_file_size > 0);
            assert_eq!(index.line_count(), 3);
        }
        other => panic!("Expected Truncated event, got {:?}", other),
    }
}

#[test]
fn test_tail_file_rotation() {
    let temp_dir = tempfile::tempdir().unwrap();
    let log_path = temp_dir.path().join("service.log");
    let rotated_path = temp_dir.path().join("service.log.1");

    // Create initial log file
    {
        let mut f = File::create(&log_path).unwrap();
        writeln!(f, "2026-11-07 17:10:00 [INFO] Generation 1 start").unwrap();
        writeln!(f, "2026-11-07 17:10:01 [INFO] Generation 1 processing").unwrap();
        f.flush().unwrap();
    }

    let mut tailer = Tailer::open(&log_path).unwrap();
    let mut index = LineIndex::new("rot-test", tailer.last_file_size);
    index.set_complete(2);

    // Small delay to ensure timestamp / file system metadata changes
    std::thread::sleep(Duration::from_millis(50));

    // Simulate log rotation: rename service.log -> service.log.1 and create fresh service.log
    std::fs::rename(&log_path, &rotated_path).unwrap();

    {
        let mut f = File::create(&log_path).unwrap();
        writeln!(f, "2026-11-07 17:11:00 [INFO] Generation 2 fresh startup").unwrap();
        writeln!(f, "2026-11-07 17:11:01 [INFO] Generation 2 worker ready").unwrap();
        writeln!(f, "2026-11-07 17:11:02 [INFO] Generation 2 listening").unwrap();
        f.flush().unwrap();
    }

    let event = tailer.poll_update(&mut index).unwrap();
    match event {
        Some(TailEvent::Rotated { new_file_size }) => {
            assert!(new_file_size > 0);
            assert_eq!(index.line_count(), 3);
        }
        Some(TailEvent::Truncated { .. }) | Some(TailEvent::Appended { .. }) => {
            // Handled cleanly regardless of OS inode semantics
            assert!(index.line_count() >= 2);
        }
        None => panic!("Expected rotation or update event"),
    }
}

#[test]
fn test_tail_background_thread_streaming() {
    let mut temp = NamedTempFile::new().unwrap();
    writeln!(temp, "Initial line 1").unwrap();
    temp.flush().unwrap();

    let (tx, rx) = crossbeam_channel::unbounded();
    let cancel = Arc::new(AtomicBool::new(false));

    let handle = start_tailing(
        temp.path().to_path_buf(),
        Duration::from_millis(20),
        Arc::clone(&cancel),
        tx,
    );

    // Append a line
    std::thread::sleep(Duration::from_millis(40));
    {
        let mut f = OpenOptions::new().append(true).open(temp.path()).unwrap();
        writeln!(f, "Appended line 2 from background tail test").unwrap();
        f.flush().unwrap();
    }

    // Wait for event with timeout
    let event = rx
        .recv_timeout(Duration::from_secs(2))
        .expect("Timed out waiting for tail event");

    match event {
        TailEvent::Appended {
            new_lines_count, ..
        } => {
            assert_eq!(new_lines_count, 1);
        }
        other => panic!("Expected Appended event, got {:?}", other),
    }

    // Stop tailing and wait for clean thread exit
    cancel.store(true, Ordering::Relaxed);
    handle.join().expect("Tail worker thread panicked");
}
