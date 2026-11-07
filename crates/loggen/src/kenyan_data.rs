// path: crates/loggen/src/kenyan_data.rs

/// Deterministic 64-bit linear congruential / XorShift pseudo-random number generator
#[derive(Debug, Clone)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    pub fn new(seed: u64) -> Self {
        // Ensure state is never 0
        let s = if seed == 0 { 0x853c49e6748fea9b } else { seed };
        Self { state: s }
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.state = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }

    pub fn next_range(&mut self, min: usize, max: usize) -> usize {
        if min >= max {
            return min;
        }
        let span = (max - min) as u64;
        min + (self.next_u64() % span) as usize
    }

    pub fn next_bool(&mut self, probability_percent: usize) -> bool {
        self.next_range(0, 100) < probability_percent
    }
}

pub static SERVICES: &[&str] = &[
    "daraja-stk-push",
    "daraja-c2b-validator",
    "daraja-b2c-disbursement",
    "africas-talking-sms-router",
    "africas-talking-ussd-engine",
    "nairobi-matatu-fare-ledger",
    "ecitizen-revenue-gateway",
    "kplc-token-service",
];

pub static LOG_LEVELS: &[&str] = &["INFO", "INFO", "INFO", "WARN", "DEBUG", "ERROR", "TRACE"];

pub static SYNTHETIC_MSISDNS: &[&str] = &[
    "+254700000010",
    "+254700000021",
    "+254700000034",
    "+254700000042",
    "+254700000055",
    "+254700000067",
    "+254700000078",
    "+254700000089",
    "+254700000095",
    "+254100000015",
    "+254100000028",
    "+254100000039",
];

pub static ERROR_MESSAGES: &[&str] = &[
    "Daraja callback timeout: Safaricom peer host 196.201.214.200 connection reset by peer",
    "STK Push cancelled by user via SIM Toolkit PIN prompt timeout",
    "Africa's Talking SMS delivery failed: Network route 63902 unreachable",
    "USSD session expired: User inactivity exceeding 180 seconds on *384*100#",
    "Database connection pool exhausted for pesa_ledger_db",
    "Rate limit exceeded: 429 Too Many Requests on /api/v1/daraja/stkpush",
    "Invalid signature on inbound M-Pesa webhook header X-Daraja-Signature",
];

pub static INFO_MESSAGES: &[&str] = &[
    "Daraja STK push initiated successfully for customer checkout",
    "M-Pesa payment confirmation settled to merchant till",
    "Africa's Talking SMS delivery receipt received: status=Success",
    "USSD menu navigation step processed for registration flow",
    "Settlement batch completed for Nairobi matatu operator sacco",
    "eCitizen service fee payment validated via Daraja C2B confirmation",
    "Customer token generated and dispatched via Africa's Talking gateway",
];

/// Generates a synthetic ISO timestamp pegged to Africa/Nairobi (+03:00)
pub fn generate_nairobi_timestamp(rng: &mut DeterministicRng, line_index: u64) -> String {
    let base_seconds = 1794052800 + (line_index % 86400); // 2026-11-07
    let hours = 14 + (base_seconds / 3600 % 10);
    let minutes = base_seconds / 60 % 60;
    let seconds = base_seconds % 60;
    let millis = rng.next_range(100, 999);
    format!(
        "2026-11-07T{:02}:{:02}:{:02}.{:03}+03:00",
        hours, minutes, seconds, millis
    )
}

/// Generates a synthetic M-Pesa receipt number e.g. SYN-KES-948172
pub fn generate_receipt(rng: &mut DeterministicRng) -> String {
    format!("SYN-KES-{:06}", rng.next_range(100000, 999999))
}

/// Generates a realistic plain text log line
pub fn generate_plain_line(rng: &mut DeterministicRng, line_index: u64) -> String {
    let ts = generate_nairobi_timestamp(rng, line_index);
    let level = LOG_LEVELS[rng.next_range(0, LOG_LEVELS.len())];
    let service = SERVICES[rng.next_range(0, SERVICES.len())];
    let duration_ms = rng.next_range(12, 1450);
    let msisdn = SYNTHETIC_MSISDNS[rng.next_range(0, SYNTHETIC_MSISDNS.len())];
    let trace_id = format!("trc-{:016x}", rng.next_u64());

    if level == "ERROR" {
        let err = ERROR_MESSAGES[rng.next_range(0, ERROR_MESSAGES.len())];
        format!(
            "{} [{}] {} trace_id={} duration_ms={} user_msisdn={} error=\"{}\"",
            ts, level, service, trace_id, duration_ms, msisdn, err
        )
    } else {
        let msg = INFO_MESSAGES[rng.next_range(0, INFO_MESSAGES.len())];
        let receipt = generate_receipt(rng);
        let kes = rng.next_range(50, 25000);
        format!(
            "{} [{}] {} trace_id={} duration_ms={} user_msisdn={} receipt={} amount_kes={} msg=\"{}\"",
            ts, level, service, trace_id, duration_ms, msisdn, receipt, kes, msg
        )
    }
}

/// Generates a realistic structured JSON-lines record
pub fn generate_json_line(rng: &mut DeterministicRng, line_index: u64) -> String {
    let ts = generate_nairobi_timestamp(rng, line_index);
    let level = LOG_LEVELS[rng.next_range(0, LOG_LEVELS.len())].to_lowercase();
    let service = SERVICES[rng.next_range(0, SERVICES.len())];
    let duration_ms = rng.next_range(8, 2200);
    let msisdn = SYNTHETIC_MSISDNS[rng.next_range(0, SYNTHETIC_MSISDNS.len())];
    let trace_id = format!("trc-{:016x}", rng.next_u64());
    let user_id = rng.next_range(1000, 9999);

    if service == "daraja-stk-push" && rng.next_bool(40) {
        // Realistic Daraja STK Push callback envelope
        let receipt = generate_receipt(rng);
        let amount = rng.next_range(100, 15000) as f64;
        let checkout_id = format!("ws_CO_07112026_{:08}", rng.next_range(10000000, 99999999));
        let result_code = if level == "error" { 1032 } else { 0 };
        let result_desc = if level == "error" {
            "Request cancelled by user"
        } else {
            "The service request is processed successfully."
        };

        format!(
            "{{\"timestamp\":\"{}\",\"level\":\"{}\",\"service\":\"{}\",\"trace_id\":\"{}\",\"duration_ms\":{},\"Body\":{{\"stkCallback\":{{\"MerchantRequestID\":\"29115-92014-1\",\"CheckoutRequestID\":\"{}\",\"ResultCode\":{},\"ResultDesc\":\"{}\",\"CallbackMetadata\":{{\"Item\":[{{\"Name\":\"Amount\",\"Value\":{:.2}}},{{\"Name\":\"MpesaReceiptNumber\",\"Value\":\"{}\"}},{{\"Name\":\"PhoneNumber\",\"Value\":\"{}\"}}]}}}}}}",
            ts, level, service, trace_id, duration_ms, checkout_id, result_code, result_desc, amount, receipt, msisdn
        )
    } else if service == "africas-talking-sms-router" && rng.next_bool(40) {
        // Realistic Africa's Talking Delivery Report
        let msg_id = format!("ATXid_syn_{:08x}", rng.next_u64() as u32);
        let status = if level == "error" {
            "Failed"
        } else {
            "Success"
        };
        let cost = "KES 0.8000";

        format!(
            "{{\"timestamp\":\"{}\",\"level\":\"{}\",\"service\":\"{}\",\"trace_id\":\"{}\",\"user_id\":{},\"duration_ms\":{},\"at_report\":{{\"id\":\"{}\",\"status\":\"{}\",\"phoneNumber\":\"{}\",\"networkCode\":\"63902\",\"cost\":\"{}\"}}}}",
            ts, level, service, trace_id, user_id, duration_ms, msg_id, status, msisdn, cost
        )
    } else {
        // Standard structured application log
        let msg = if level == "error" {
            ERROR_MESSAGES[rng.next_range(0, ERROR_MESSAGES.len())]
        } else {
            INFO_MESSAGES[rng.next_range(0, INFO_MESSAGES.len())]
        };
        let kes = rng.next_range(100, 50000);

        format!(
            "{{\"timestamp\":\"{}\",\"level\":\"{}\",\"service\":\"{}\",\"trace_id\":\"{}\",\"user_id\":{},\"duration_ms\":{},\"msisdn\":\"{}\",\"kes_amount\":{},\"message\":\"{}\"}}",
            ts, level, service, trace_id, user_id, duration_ms, msisdn, kes, msg
        )
    }
}

/// Generates an exceptionally long log line (10KB to 60KB) to test truncation caps
pub fn generate_very_long_line(
    rng: &mut DeterministicRng,
    line_index: u64,
    target_len: usize,
) -> String {
    let mut line = generate_json_line(rng, line_index);
    // Remove closing brace to append synthetic payload
    if line.ends_with('}') {
        line.pop();
    }
    line.push_str(",\"diagnostic_payload_blob\":\"");
    let repeat_chunk = "SYNTHETIC_DIAGNOSTIC_FRAME_KES_AUDIT_TRACE_DATA_NBO_2026_";
    while line.len() < target_len {
        line.push_str(repeat_chunk);
    }
    line.push_str("\"}");
    line
}

/// Injects invalid / malformed UTF-8 byte sequences into a line buffer
pub fn generate_invalid_utf8_line(rng: &mut DeterministicRng, line_index: u64) -> Vec<u8> {
    let mut bytes = generate_plain_line(rng, line_index).into_bytes();
    // Inject invalid UTF-8 bytes at a random valid index
    let inject_idx = bytes.len() / 2;
    bytes.insert(inject_idx, 0xFF);
    bytes.insert(inject_idx + 1, 0xC3);
    bytes.insert(inject_idx + 2, 0x28); // 0xC3 must be followed by 0x80..0xBF; 0x28 is invalid
    bytes
}
