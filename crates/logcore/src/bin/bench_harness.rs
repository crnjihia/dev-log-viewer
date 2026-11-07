// path: crates/logcore/src/bin/bench_harness.rs

use logcore::{
    build_line_index, compile_query, get_lines, search_json_mmap, search_mmap, MmapView,
    SearchOptions,
};
use std::env;
use std::path::PathBuf;
use std::time::Instant;

fn print_usage() {
    eprintln!(
        r#"Logcore Performance Profiling Harness
Usage:
  bench_harness --file <PATH> [--action <first-paint|index|regex-search|json-query|all>] [--query <STRING>] [--json]

Actions:
  first-paint   Measure latency from cold open to rendering first 50 lines (< 1s target)
  index         Measure parallel line indexation throughput and memory footprint
  regex-search  Measure streaming regex search throughput in MB/s
  json-query    Measure structured JSON query throughput in MB/s
  all           Execute full benchmark suite and print markdown/json performance report
"#
    );
}

fn get_rss_bytes() -> usize {
    #[cfg(target_os = "linux")]
    {
        if let Ok(statm) = std::fs::read_to_string("/proc/self/statm") {
            let parts: Vec<&str> = statm.split_whitespace().collect();
            if parts.len() >= 2 {
                if let Ok(resident_pages) = parts[1].parse::<usize>() {
                    return resident_pages * 4096;
                }
            }
        }
    }
    0
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        print_usage();
        std::process::exit(1);
    }

    let mut file_path: Option<PathBuf> = None;
    let mut action = "all".to_string();
    let mut query = "error".to_string();
    let mut as_json = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--file" | "-f" => {
                if i + 1 < args.len() {
                    file_path = Some(PathBuf::from(&args[i + 1]));
                    i += 1;
                }
            }
            "--action" | "-a" => {
                if i + 1 < args.len() {
                    action = args[i + 1].clone();
                    i += 1;
                }
            }
            "--query" | "-q" => {
                if i + 1 < args.len() {
                    query = args[i + 1].clone();
                    i += 1;
                }
            }
            "--json" => {
                as_json = true;
            }
            "--help" | "-h" => {
                print_usage();
                return;
            }
            _ => {}
        }
        i += 1;
    }

    let path = match file_path {
        Some(p) => p,
        None => {
            eprintln!("Error: --file argument is required.");
            std::process::exit(1);
        }
    };

    if !path.exists() {
        eprintln!("Error: File not found: {:?}", path);
        std::process::exit(1);
    }

    let file_metadata = std::fs::metadata(&path).expect("Failed to read file metadata");
    let clean_path = path.to_string_lossy().replace('\\', "/");
    let file_size_bytes = file_metadata.len();
    let file_size_mb = file_size_bytes as f64 / (1024.0 * 1024.0);

    // Initial RSS
    let rss_before = get_rss_bytes();

    // 1. Time to First Paint Measurement
    let start_paint = Instant::now();
    let view = MmapView::open(&path).expect("Failed to memory-map target file");
    let first_window =
        get_lines(&view, "bench-file", 0, 50, 10_000).expect("Failed to read first 50 lines");
    let time_to_first_paint = start_paint.elapsed();
    let first_paint_ms = time_to_first_paint.as_secs_f64() * 1000.0;

    if action == "first-paint" {
        if as_json {
            println!(
                r#"{{"file": "{}", "size_bytes": {}, "lines_retrieved": {}, "time_to_first_paint_ms": {:.3}}}"#,
                clean_path,
                file_size_bytes,
                first_window.lines.len(),
                first_paint_ms
            );
        } else {
            println!("=== Time to First Paint ===");
            println!("File: {:?}", path);
            println!("Size: {:.2} MB ({} bytes)", file_size_mb, file_size_bytes);
            println!("Lines retrieved: {}", first_window.lines.len());
            println!(
                "Time to first 50 lines: {:.3} ms ({:?})",
                first_paint_ms, time_to_first_paint
            );
            println!(
                "Instant rendering SLA (< 1000 ms): {}",
                if first_paint_ms < 1000.0 {
                    "PASS"
                } else {
                    "FAIL"
                }
            );
        }
        return;
    }

    // 2. Full Background Indexing Measurement
    let start_index = Instant::now();
    let index = build_line_index(&view, "bench-file", None, None).expect("Failed to build index");
    let time_to_index = start_index.elapsed();
    let index_secs = time_to_index.as_secs_f64();
    let index_throughput_mb_s = if index_secs > 0.0 {
        file_size_mb / index_secs
    } else {
        0.0
    };
    let total_lines = index.line_count();
    let index_heap_bytes = index.heap_memory_bytes();
    let index_heap_mb = index_heap_bytes as f64 / (1024.0 * 1024.0);

    let rss_after_index = get_rss_bytes();
    let rss_delta_mb = (rss_after_index.saturating_sub(rss_before)) as f64 / (1024.0 * 1024.0);

    if action == "index" {
        if as_json {
            println!(
                r#"{{"file": "{}", "size_bytes": {}, "total_lines": {}, "time_to_index_secs": {:.4}, "throughput_mb_s": {:.2}, "index_heap_bytes": {}, "index_heap_mb": {:.4}}}"#,
                clean_path,
                file_size_bytes,
                total_lines,
                index_secs,
                index_throughput_mb_s,
                index_heap_bytes,
                index_heap_mb
            );
        } else {
            println!("=== Line Indexing Performance ===");
            println!("Total lines indexed: {}", total_lines);
            println!(
                "Time to full index: {:.3} s ({:?})",
                index_secs, time_to_index
            );
            println!("Indexing throughput: {:.2} MB/s", index_throughput_mb_s);
            println!(
                "Sparse index heap memory: {} bytes ({:.2} MB)",
                index_heap_bytes, index_heap_mb
            );
            println!(
                "Memory per 1M lines: {:.2} KB",
                (index_heap_bytes as f64 / total_lines as f64) * 1000.0
            );
        }
        return;
    }

    // 3. Regex Search Measurement
    let start_search = Instant::now();
    let search_opts = SearchOptions {
        case_sensitive: false,
        whole_word: false,
        is_regex: false,
        max_results: None,
    };
    let regex_matches =
        search_mmap(&view, &index, &query, &search_opts, None, None).expect("Regex search failed");
    let time_to_search = start_search.elapsed();
    let search_secs = time_to_search.as_secs_f64();
    let search_throughput_mb_s = if search_secs > 0.0 {
        file_size_mb / search_secs
    } else {
        0.0
    };

    if action == "regex-search" {
        if as_json {
            println!(
                r#"{{"query": "{}", "matches": {}, "time_secs": {:.4}, "throughput_mb_s": {:.2}}}"#,
                query,
                regex_matches.len(),
                search_secs,
                search_throughput_mb_s
            );
        } else {
            println!("=== Regex Search Performance ===");
            println!("Pattern: '{}'", query);
            println!("Matches found: {}", regex_matches.len());
            println!(
                "Time to search: {:.3} s ({:?})",
                search_secs, time_to_search
            );
            println!("Search throughput: {:.2} MB/s", search_throughput_mb_s);
        }
        return;
    }

    // 4. Structured JSON Query Measurement
    let json_query_str = if query == "error" {
        "level:error"
    } else {
        &query
    };
    let start_json = Instant::now();
    let pred = compile_query(json_query_str).expect("Failed to compile structured query");
    let json_matches = search_json_mmap(&view, &index, &pred, None, None, None)
        .expect("Structured JSON search failed");
    let time_to_json = start_json.elapsed();
    let json_secs = time_to_json.as_secs_f64();
    let json_throughput_mb_s = if json_secs > 0.0 {
        file_size_mb / json_secs
    } else {
        0.0
    };

    // Print Full Report
    if as_json {
        println!(
            r#"{{"file": "{}", "size_bytes": {}, "size_mb": {:.2}, "first_paint_ms": {:.3}, "total_lines": {}, "index_time_s": {:.4}, "index_throughput_mb_s": {:.2}, "index_heap_bytes": {}, "regex_query": "{}", "regex_matches": {}, "regex_throughput_mb_s": {:.2}, "json_query": "{}", "json_matches": {}, "json_throughput_mb_s": {:.2}}}"#,
            clean_path,
            file_size_bytes,
            file_size_mb,
            first_paint_ms,
            total_lines,
            index_secs,
            index_throughput_mb_s,
            index_heap_bytes,
            query,
            regex_matches.len(),
            search_throughput_mb_s,
            json_query_str,
            json_matches.len(),
            json_throughput_mb_s
        );
    } else {
        println!("\n=======================================================");
        println!("       DEV LOG VIEWER PERFORMANCE REPORT");
        println!("=======================================================");
        println!("File:                 {:?}", path);
        println!(
            "Size:                 {:.2} MB ({} bytes)",
            file_size_mb, file_size_bytes
        );
        println!("Total Lines:          {}", total_lines);
        println!("-------------------------------------------------------");
        println!(
            "Time to First Paint:  {:.3} ms ({:?})",
            first_paint_ms, time_to_first_paint
        );
        println!(
            "Time to Full Index:   {:.3} s ({:.2} MB/s)",
            index_secs, index_throughput_mb_s
        );
        println!(
            "Sparse Index RAM:     {:.3} MB ({} bytes)",
            index_heap_mb, index_heap_bytes
        );
        if rss_after_index > 0 {
            println!("Process RSS Delta:    {:.2} MB", rss_delta_mb);
        }
        println!("-------------------------------------------------------");
        println!("Regex Query:          '{}'", query);
        println!("Regex Matches:        {}", regex_matches.len());
        println!(
            "Regex Throughput:     {:.2} MB/s ({:.3} s)",
            search_throughput_mb_s, search_secs
        );
        println!("-------------------------------------------------------");
        println!("JSON Query:           '{}'", json_query_str);
        println!("JSON Matches:         {}", json_matches.len());
        println!(
            "JSON Throughput:      {:.2} MB/s ({:.3} s)",
            json_throughput_mb_s, json_secs
        );
        println!("=======================================================\n");
    }
}
