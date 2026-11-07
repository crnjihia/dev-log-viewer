// path: crates/logcore/src/search/mod.rs

pub mod json_query;
pub mod regex_engine;

pub use json_query::{
    compile_query, evaluate_predicate, extract_field_paths, resolve_field, sample_json_fields,
    search_json_mmap, Operator, Predicate, QueryValue,
};
pub use regex_engine::{
    build_regex, byte_range_to_utf16_range, search_mmap, SearchBatch, SearchOptions,
};
