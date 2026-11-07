// path: crates/loggen/src/main.rs

mod kenyan_data;

use kenyan_data::{
    generate_invalid_utf8_line, generate_json_line, generate_plain_line, generate_very_long_line,
    DeterministicRng,
};
use std::env;
use std::fs::File;
use std::io::{self, BufWriter, Write};
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug)]
pub enum OutputFormat {
    Plain,
    Json,
    Mixed,
}

#[derive(Debug)]
pub struct GenConfig {
    pub seed: u64,
    pub size_mb: usize,
    pub max_lines: Option<u64>,
    pub format: OutputFormat,
    pub output_path: PathBuf,
    pub use_crlf: bool,
    pub inject_invalid_utf8: bool,
    pub inject_long_lines: bool,
}

impl Default for GenConfig {
    fn default() -> Self {
        Self {
            seed: 42,
            size_mb: 10,
            max_lines: None,
            format: OutputFormat::Mixed,
            output_path: PathBuf::from("sample-dev.log"),
            use_crlf: false,
            inject_invalid_utf8: false,
            inject_long_lines: false,
        }
    }
}

fn print_help() {
    println!(
        r#"loggen - Multi-Gigabyte Deterministic Kenyan Fintech Log Generator
Author: Chris Njihia (Nairobi, Kenya)

USAGE:
    loggen [OPTIONS]

OPTIONS:
    --size <SIZE>, --size-mb <MB>  Target file size (e.g. '100MB', '1GB', or MB number) [default: 10]
    --lines <N>               Stop after writing exactly N lines [default: size-based]
    --format <FMT>            Log format: 'plain', 'json', 'mixed' [default: mixed]
    --output <PATH>           Destination file path [default: sample-dev.log]
    --seed <SEED>             Deterministic u64 PRNG seed [default: 42]
    --crlf                    Emit Windows CRLF (\r\n) newlines [default: LF]
    --with-invalid-utf8       Inject occasional malformed UTF-8 byte sequences
    --with-long-lines         Inject occasional very long diagnostic lines (10KB-50KB)
    -h, --help                Print this help dialog

EXAMPLES:
    loggen --size-mb 50 --format json --output fixtures/fintech.jsonl
    loggen --lines 1000 --seed 999 --crlf --output fixtures/windows_crlf.log
    loggen --size-mb 5 --with-invalid-utf8 --output fixtures/lossy_utf8.log
"#
    );
}

fn parse_args() -> Result<GenConfig, String> {
    let args: Vec<String> = env::args().collect();
    let mut config = GenConfig::default();
    let mut i = 1;

    while i < args.len() {
        match args[i].as_str() {
            "-h" | "--help" => {
                print_help();
                std::process::exit(0);
            }
            "--seed" => {
                i += 1;
                if i >= args.len() {
                    return Err("Missing value for --seed".into());
                }
                config.seed = args[i]
                    .parse()
                    .map_err(|e| format!("Invalid integer for --seed: {}", e))?;
            }
            "--size" | "--size-mb" => {
                i += 1;
                if i >= args.len() {
                    return Err("Missing value for --size / --size-mb".into());
                }
                let raw_val = args[i].trim();
                let lower = raw_val.to_lowercase();
                let mb: usize = if lower.ends_with("gb") {
                    let num: usize = lower[..lower.len() - 2]
                        .trim()
                        .parse()
                        .map_err(|e| format!("Invalid integer in size '{}': {}", raw_val, e))?;
                    num * 1024
                } else if lower.ends_with("mb") {
                    lower[..lower.len() - 2]
                        .trim()
                        .parse()
                        .map_err(|e| format!("Invalid integer in size '{}': {}", raw_val, e))?
                } else {
                    raw_val
                        .parse()
                        .map_err(|e| format!("Invalid integer for --size-mb: {}", e))?
                };
                config.size_mb = mb;
            }
            "--lines" => {
                i += 1;
                if i >= args.len() {
                    return Err("Missing value for --lines".into());
                }
                config.max_lines = Some(
                    args[i]
                        .parse()
                        .map_err(|e| format!("Invalid integer for --lines: {}", e))?,
                );
            }
            "--format" => {
                i += 1;
                if i >= args.len() {
                    return Err("Missing value for --format".into());
                }
                match args[i].to_lowercase().as_str() {
                    "plain" => config.format = OutputFormat::Plain,
                    "json" | "jsonl" => config.format = OutputFormat::Json,
                    "mixed" => config.format = OutputFormat::Mixed,
                    other => {
                        return Err(format!(
                            "Unknown format '{}', expected 'plain', 'json', or 'mixed'",
                            other
                        ))
                    }
                }
            }
            "--output" => {
                i += 1;
                if i >= args.len() {
                    return Err("Missing value for --output".into());
                }
                config.output_path = PathBuf::from(&args[i]);
            }
            "--crlf" => {
                config.use_crlf = true;
            }
            "--with-invalid-utf8" => {
                config.inject_invalid_utf8 = true;
            }
            "--with-long-lines" => {
                config.inject_long_lines = true;
            }
            unknown => {
                return Err(format!(
                    "Unknown option '{}'. Use --help for usage.",
                    unknown
                ));
            }
        }
        i += 1;
    }

    Ok(config)
}

pub fn run_generator(config: &GenConfig) -> io::Result<(u64, u64)> {
    if let Some(parent) = config.output_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let file = File::create(&config.output_path)?;
    // 128KB write buffer for high I/O throughput
    let mut writer = BufWriter::with_capacity(128 * 1024, file);
    let mut rng = DeterministicRng::new(config.seed);

    let newline: &[u8] = if config.use_crlf { b"\r\n" } else { b"\n" };
    let target_bytes = (config.size_mb as u64) * 1024 * 1024;

    let mut bytes_written: u64 = 0;
    let mut lines_written: u64 = 0;

    let start_time = Instant::now();

    loop {
        // Termination check
        if let Some(max_l) = config.max_lines {
            if lines_written >= max_l {
                break;
            }
        } else if bytes_written >= target_bytes {
            break;
        }

        // Determine line content
        if config.inject_invalid_utf8 && lines_written > 0 && lines_written.is_multiple_of(1000) {
            let line_bytes = generate_invalid_utf8_line(&mut rng, lines_written);
            writer.write_all(&line_bytes)?;
            bytes_written += line_bytes.len() as u64;
        } else if config.inject_long_lines && lines_written > 0 && lines_written.is_multiple_of(500)
        {
            let target_len = rng.next_range(15 * 1024, 45 * 1024);
            let long_str = generate_very_long_line(&mut rng, lines_written, target_len);
            writer.write_all(long_str.as_bytes())?;
            bytes_written += long_str.len() as u64;
        } else {
            match config.format {
                OutputFormat::Plain => {
                    let s = generate_plain_line(&mut rng, lines_written);
                    writer.write_all(s.as_bytes())?;
                    bytes_written += s.len() as u64;
                }
                OutputFormat::Json => {
                    let s = generate_json_line(&mut rng, lines_written);
                    writer.write_all(s.as_bytes())?;
                    bytes_written += s.len() as u64;
                }
                OutputFormat::Mixed => {
                    let is_json = rng.next_bool(60);
                    let s = if is_json {
                        generate_json_line(&mut rng, lines_written)
                    } else {
                        generate_plain_line(&mut rng, lines_written)
                    };
                    writer.write_all(s.as_bytes())?;
                    bytes_written += s.len() as u64;
                }
            }
        }

        writer.write_all(newline)?;
        bytes_written += newline.len() as u64;
        lines_written += 1;
    }

    writer.flush()?;
    let elapsed = start_time.elapsed();
    let mb = bytes_written as f64 / (1024.0 * 1024.0);
    let sec = elapsed.as_secs_f64().max(0.0001);
    let speed = mb / sec;

    println!(
        "Generated {} lines ({:.2} MB) in {:.3}s ({:.1} MB/s) -> {}",
        lines_written,
        mb,
        sec,
        speed,
        config.output_path.display()
    );

    Ok((lines_written, bytes_written))
}

fn main() {
    match parse_args() {
        Ok(config) => {
            println!(
                "Starting loggen: target={}MB seed={} format={:?} crlf={}",
                config.size_mb, config.seed, config.format, config.use_crlf
            );
            if let Err(e) = run_generator(&config) {
                eprintln!("Error generating log file: {}", e);
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}
