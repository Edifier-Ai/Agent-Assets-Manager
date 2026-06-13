pub mod adapters;
pub mod commands;
pub mod db;
pub mod fileops;
pub mod operations;
pub mod platform;
pub mod scanner;

#[cfg(test)]
mod operations_tests;

#[cfg(test)]
mod scanner_tests;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _conn = db::get_db_connection().expect("Failed to initialize database");

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_platforms,
            commands::scan_assets,
            commands::get_platforms,
            commands::get_assets,
            commands::get_model_bindings,
            commands::get_model_profiles,
            commands::get_backups,
            commands::get_findings,
            commands::get_scan_runs,
            commands::get_asset_detail,
            commands::preview_operation,
            commands::execute_operation,
            commands::get_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
