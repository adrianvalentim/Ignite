mod codex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(codex::CodexState::default())
        .plugin(tauri_plugin_fs::init())
        // Restore paths granted by the folder picker before the UI reads them.
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            codex::codex_start,
            codex::codex_send,
            codex::codex_stop
        ])
        .run(tauri::generate_context!())
        .expect("error while running Effortful Learning");
}
