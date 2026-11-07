// path: crates/logcore/tests/json_query_test.rs

use logcore::{
    build_line_index, compile_query, evaluate_predicate, sample_json_fields, search_json_mmap,
    CoreError, MmapView, Operator, Predicate, QueryValue,
};
use serde_json::json;
use std::io::Write;
use tempfile::NamedTempFile;

#[test]
fn test_query_parser_nested_and_operators() {
    let query = r#"Body.stkCallback.ResultCode=0 AND (amount>=1000 OR currency:"KES")"#;
    let pred = compile_query(query).expect("Failed to compile structured query");

    match pred {
        Predicate::And(left, right) => {
            assert_eq!(
                *left,
                Predicate::Comparison {
                    field_path: "Body.stkCallback.ResultCode".into(),
                    op: Operator::Equal,
                    val: QueryValue::Number(0.0),
                }
            );

            match *right {
                Predicate::Or(inner_l, inner_r) => {
                    assert_eq!(
                        *inner_l,
                        Predicate::Comparison {
                            field_path: "amount".into(),
                            op: Operator::GreaterThanOrEqual,
                            val: QueryValue::Number(1000.0),
                        }
                    );
                    assert_eq!(
                        *inner_r,
                        Predicate::Comparison {
                            field_path: "currency".into(),
                            op: Operator::Colon,
                            val: QueryValue::String("KES".into()),
                        }
                    );
                }
                _ => panic!("Expected inner Or predicate"),
            }
        }
        _ => panic!("Expected outer And predicate"),
    }
}

#[test]
fn test_query_parser_syntax_errors() {
    // Unclosed parenthesis
    let err = compile_query("(level:error AND status:500").unwrap_err();
    match err {
        CoreError::QueryParse { position, message } => {
            assert_eq!(position, 0);
            assert!(message.contains("Unclosed parenthesis"));
        }
        _ => panic!("Expected QueryParse error"),
    }

    // Missing operator
    let err2 = compile_query("level").unwrap_err();
    match err2 {
        CoreError::QueryParse { position, message } => {
            assert_eq!(position, 0);
            assert!(message.contains("Expected operator"));
        }
        _ => panic!("Expected QueryParse error"),
    }

    // Missing value
    let err3 = compile_query("level=").unwrap_err();
    match err3 {
        CoreError::QueryParse { position, message } => {
            assert_eq!(position, 5);
            assert!(message.contains("Expected comparison value"));
        }
        _ => panic!("Expected QueryParse error"),
    }

    // Unclosed quoted string
    let err4 = compile_query(r#"user:"Chris"#).unwrap_err();
    match err4 {
        CoreError::QueryParse { position, message } => {
            assert_eq!(position, 5);
            assert!(message.contains("Unterminated quoted string"));
        }
        _ => panic!("Expected QueryParse error"),
    }
}

#[test]
fn test_predicate_nested_fields_and_types() {
    let payload = json!({
        "timestamp": "2026-11-07T16:30:00Z",
        "level": "INFO",
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "29115-4921-1",
                "CheckoutRequestID": "ws_CO_07112026163000_109283",
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        { "Name": "Amount", "Value": 2500.0 },
                        { "Name": "MpesaReceiptNumber", "Value": "SYN-KES-88912" },
                        { "Name": "PhoneNumber", "Value": 254712345678u64 }
                    ]
                }
            }
        },
        "duration_ms": 142.5,
        "is_sandbox": true
    });

    // Test nested dot path and number equality
    let q1 = compile_query("Body.stkCallback.ResultCode=0").unwrap();
    assert!(evaluate_predicate(&q1, &payload));

    // Test number comparison
    let q2 = compile_query("duration_ms<200 AND duration_ms>100").unwrap();
    assert!(evaluate_predicate(&q2, &payload));

    let q3 = compile_query("duration_ms>500").unwrap();
    assert!(!evaluate_predicate(&q3, &payload));

    // Test boolean
    let q4 = compile_query("is_sandbox:true").unwrap();
    assert!(evaluate_predicate(&q4, &payload));

    // Test string equality case-insensitive
    let q5 = compile_query(r#"level="info""#).unwrap();
    assert!(evaluate_predicate(&q5, &payload));

    // Test string loose substring match
    let q6 = compile_query(r#"Body.stkCallback.ResultDesc:"processed successfully""#).unwrap();
    assert!(evaluate_predicate(&q6, &payload));

    // Test negation
    let q7 = compile_query("NOT Body.stkCallback.ResultCode!=0").unwrap();
    assert!(evaluate_predicate(&q7, &payload));
}

#[test]
fn test_missing_fields_and_malformed_lines() {
    let payload = json!({
        "level": "error",
        "message": "Gateway timeout"
    });

    // Non-existent field returns false gracefully
    let q1 = compile_query("user.id:42").unwrap();
    assert!(!evaluate_predicate(&q1, &payload));

    // Missing field in branch of OR returns result of other branch
    let q2 = compile_query("user.id:42 OR level:error").unwrap();
    assert!(evaluate_predicate(&q2, &payload));

    let q3 = compile_query("user.id:42 AND level:error").unwrap();
    assert!(!evaluate_predicate(&q3, &payload));
}

#[test]
fn test_field_picker_sampler() {
    let sample_lines = [
        "2026-11-07 16:30:00 [INFO] Plain text log line",
        r#"{"timestamp":"2026-11-07T16:30:00Z","level":"info","user":{"id":42,"role":"admin"},"active":true}"#,
        "Not a JSON line either",
        r#"{"timestamp":"2026-11-07T16:31:00Z","level":"error","Body":{"stkCallback":{"ResultCode":0,"Amount":1500.0}},"items":["a","b"]}"#,
        "{ malformed json line without closing quote ",
    ];

    let fields = sample_json_fields(&sample_lines);

    assert_eq!(fields.get("timestamp"), Some(&"string"));
    assert_eq!(fields.get("level"), Some(&"string"));
    assert_eq!(fields.get("user.id"), Some(&"number"));
    assert_eq!(fields.get("user.role"), Some(&"string"));
    assert_eq!(fields.get("active"), Some(&"boolean"));
    assert_eq!(fields.get("Body.stkCallback.ResultCode"), Some(&"number"));
    assert_eq!(fields.get("Body.stkCallback.Amount"), Some(&"number"));
    assert_eq!(fields.get("items"), Some(&"array"));
}

#[test]
fn test_search_json_mmap_execution() {
    let mut file = NamedTempFile::new().unwrap();
    let sample_log = concat!(
        "2026-11-07 16:00:00 [INFO] Plain text system startup\n",
        "{\"level\":\"info\",\"source\":\"daraja\",\"amount\":250.0,\"msisdn\":\"+254712345678\"}\n",
        "2026-11-07 16:01:00 [DEBUG] Health check OK\n",
        "{\"level\":\"error\",\"source\":\"daraja\",\"amount\":1200.0,\"error_code\":\"ERR_TIMEOUT\"}\n",
        "{\"level\":\"info\",\"source\":\"africas_talking\",\"amount\":1500.0,\"status\":\"SUCCESS\"}\n",
        "Plain text footer\n"
    );
    file.write_all(sample_log.as_bytes()).unwrap();
    file.flush().unwrap();

    let view = MmapView::open(file.path()).unwrap();
    let index = build_line_index(&view, "json-search-test", None, None).unwrap();

    // Query 1: source is daraja AND amount >= 1000
    let pred1 = compile_query(r#"source:"daraja" AND amount>=1000"#).unwrap();
    let results1 = search_json_mmap(&view, &index, &pred1, None, None, None).unwrap();

    assert_eq!(results1.len(), 1);
    assert_eq!(results1[0].line_number, 4);
    assert!(results1[0].text.contains("ERR_TIMEOUT"));

    // Query 2: amount > 500
    let pred2 = compile_query("amount>500").unwrap();
    let results2 = search_json_mmap(&view, &index, &pred2, None, None, None).unwrap();

    assert_eq!(results2.len(), 2);
    assert_eq!(results2[0].line_number, 4);
    assert_eq!(results2[1].line_number, 5);

    // Query 3: Non-matching query
    let pred3 = compile_query(r#"source:"mpesa_c2b""#).unwrap();
    let results3 = search_json_mmap(&view, &index, &pred3, None, None, None).unwrap();
    assert!(results3.is_empty());
}
