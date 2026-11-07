// path: crates/logcore/src/encoding.rs

use encoding_rs::{Encoding, UTF_16BE, UTF_16LE, UTF_8, WINDOWS_1252};

/// Detects the text encoding of a raw byte buffer by checking BOM markers and UTF-8 validity
pub fn detect_encoding(bytes: &[u8]) -> (&'static Encoding, &'static str) {
    if bytes.is_empty() {
        return (UTF_8, "UTF-8");
    }

    // Check Byte Order Mark (BOM)
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        return (UTF_8, "UTF-8-BOM");
    }
    if bytes.len() >= 2 {
        if bytes[0] == 0xFF && bytes[1] == 0xFE {
            return (UTF_16LE, "UTF-16LE");
        }
        if bytes[0] == 0xFE && bytes[1] == 0xFF {
            return (UTF_16BE, "UTF-16BE");
        }
    }

    // Check if the sample conforms to valid UTF-8
    let sample_len = bytes.len().min(64 * 1024);
    let sample = &bytes[..sample_len];

    if std::str::from_utf8(sample).is_ok() {
        (UTF_8, "UTF-8")
    } else {
        // Fallback to Windows-1252 / ISO-8859-1 for legacy syslog or Windows logs
        (WINDOWS_1252, "WINDOWS-1252")
    }
}

/// Decodes bytes to a String lossily using the specified encoding, replacing malformed bytes with U+FFFD
pub fn decode_lossy(bytes: &[u8], encoding: &'static Encoding) -> (String, bool) {
    if bytes.is_empty() {
        return (String::new(), false);
    }

    if encoding == UTF_8 {
        match std::str::from_utf8(bytes) {
            Ok(valid_str) => (valid_str.to_string(), false),
            Err(_) => {
                let s = String::from_utf8_lossy(bytes).into_owned();
                (s, true)
            }
        }
    } else {
        let (cow, _, had_errors) = encoding.decode(bytes);
        (cow.into_owned(), had_errors)
    }
}
