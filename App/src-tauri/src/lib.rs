mod codex;

#[cfg(desktop)]
const RELOAD_MENU_ID: &str = "reload-app";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        .menu(|app| {
            let menu = tauri::menu::Menu::default(app)?;

            #[cfg(target_os = "macos")]
            if let Some(tauri::menu::MenuItemKind::Submenu(app_menu)) =
                menu.items()?.into_iter().next()
            {
                let reload = tauri::menu::MenuItemBuilder::with_id(RELOAD_MENU_ID, "Reload")
                    .accelerator("CmdOrCtrl+R")
                    .build(app)?;
                let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
                app_menu.insert_items(&[&reload, &separator], 2)?;
            }

            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == RELOAD_MENU_ID {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    if let Err(error) = window.reload() {
                        eprintln!("failed to reload Effortful Learning: {error}");
                    }
                }
            }
        });

    builder
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
