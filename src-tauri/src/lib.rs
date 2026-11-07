// path: src-tauri/src/lib.rs
use tauri::Manager;

#[tauri::command]
fn get_cli_file_arg() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    for arg in args.into_iter().skip(1) {
        if !arg.starts_with('-') {
            let p = std::path::Path::new(&arg);
            if p.exists()
                || arg.ends_with(".log")
                || arg.ends_with(".jsonl")
                || arg.ends_with(".txt")
            {
                return Some(arg);
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_cli_file_arg])
        .setup(|app| {
            let _window = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running dev-log-viewer application");
}
