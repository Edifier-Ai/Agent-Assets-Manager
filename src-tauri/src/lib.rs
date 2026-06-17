pub mod adapters;
pub mod commands;
pub mod db;
pub mod error;
pub mod fileops;
pub mod operations;
pub mod platform;
pub mod scanner;

#[cfg(test)]
mod operations_tests;

#[cfg(test)]
mod scanner_tests;

#[cfg(debug_assertions)]
use tauri::Manager;

fn startup_error_message(stage: &str, error: impl std::fmt::Display) -> String {
    format!("Agent Assets Manager startup failed during {stage}: {error}")
}

fn setup_app(_app: &mut tauri::App) -> anyhow::Result<()> {
    db::get_db_connection()
        .map(|_| ())
        .map_err(|err| anyhow::anyhow!(startup_error_message("database initialization", err)))?;

    #[cfg(debug_assertions)]
    {
        if let Some(window) = _app.get_webview_window("main") {
            window.open_devtools();
        } else {
            log::warn!("debug devtools not opened: main webview window was not found");
        }
    }

    Ok(())
}

#[cfg(test)]
mod startup_tests {
    #[test]
    fn startup_error_message_names_the_failed_stage() {
        let message = super::startup_error_message("database initialization", "permission denied");

        assert!(message.contains("database initialization"));
        assert!(message.contains("permission denied"));
    }
}

pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(platform::PlatformCache::new())
        .setup(|app| setup_app(app).map_err(Into::into))
        .invoke_handler(tauri::generate_handler![
            commands::scan_platforms,
            commands::scan_assets,
            commands::get_platforms,
            commands::get_assets,
            commands::get_model_bindings,
            commands::get_model_profiles,
            commands::get_backups,
            commands::get_operation_logs,
            commands::get_findings,
            commands::get_scan_runs,
            commands::get_asset_detail,
            commands::preview_operation,
            commands::execute_operation,
            commands::preview_skill_sync_plan,
            commands::execute_skill_sync_plan,
            commands::get_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("{}", startup_error_message("tauri runtime", err));
        std::process::exit(1);
    }
}
