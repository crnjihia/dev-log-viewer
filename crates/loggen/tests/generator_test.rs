// path: crates/loggen/tests/generator_test.rs

#[path = "../src/kenyan_data.rs"]
mod kenyan_data;

use kenyan_data::{
    generate_invalid_utf8_line, generate_json_line, generate_plain_line, generate_very_long_line,
    DeterministicRng,
};

#[test]
fn test_deterministic_rng_reproducibility() {
    let mut rng1 = DeterministicRng::new(12345);
    let mut rng2 = DeterministicRng::new(12345);

    for _ in 0..100 {
        assert_eq!(rng1.next_u64(), rng2.next_u64());
        assert_eq!(rng1.next_range(10, 500), rng2.next_range(10, 500));
    }
}

#[test]
fn test_kenyan_plain_log_generation() {
    let mut rng = DeterministicRng::new(42);
    let line = generate_plain_line(&mut rng, 0);

    // Verify Nairobi timezone format
    assert!(line.contains("+03:00"));
    // Verify trace_id is present
    assert!(line.contains("trace_id=trc-"));
    // Verify user MSISDN format (+254...)
    assert!(line.contains("+254"));
}

#[test]
fn test_kenyan_json_log_generation() {
    let mut rng = DeterministicRng::new(42);
    let line = generate_json_line(&mut rng, 0);

    // Parse valid JSON
    let parsed: serde_json::Value = serde_json::from_str(&line).expect("Must be valid JSON");
    assert!(parsed.get("timestamp").is_some());
    assert!(parsed.get("level").is_some());
    assert!(parsed.get("service").is_some());
}

#[test]
fn test_daraja_and_at_payload_generation() {
    let mut rng = DeterministicRng::new(999);
    let mut found_daraja = false;
    let mut found_at = false;

    for i in 0..250 {
        let line = generate_json_line(&mut rng, i);
        if line.contains("stkCallback") {
            found_daraja = true;
            assert!(line.contains("MerchantRequestID"));
            assert!(line.contains("CheckoutRequestID"));
        }
        if line.contains("at_report") {
            found_at = true;
            assert!(line.contains("ATXid_syn_"));
            assert!(line.contains("networkCode"));
        }
    }

    assert!(found_daraja, "Expected synthetic Daraja callback payload");
    assert!(
        found_at,
        "Expected synthetic Africa's Talking report payload"
    );
}

#[test]
fn test_very_long_line_generation() {
    let mut rng = DeterministicRng::new(100);
    let target_len = 25_000;
    let line = generate_very_long_line(&mut rng, 5, target_len);

    assert!(line.len() >= target_len);
    assert!(line.contains("SYNTHETIC_DIAGNOSTIC_FRAME_KES_AUDIT_TRACE_DATA"));
}

#[test]
fn test_invalid_utf8_injection() {
    let mut rng = DeterministicRng::new(777);
    let bytes = generate_invalid_utf8_line(&mut rng, 1);

    // Validate that the byte slice is NOT valid UTF-8
    assert!(std::str::from_utf8(&bytes).is_err());
    // Validate presence of 0xFF marker
    assert!(bytes.contains(&0xFF));
}
