mod commands;
mod database;
mod models;
mod state;
mod storage;
mod utils;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::uninitialized())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            if let Ok(Some(config)) = state::read_storage_config(&handle) {
                if let Err(e) = state::open_storage_into_state(&state, config.storage_path.into())
                {
                    eprintln!("Failed to reopen previous storage location: {e}");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::is_initialized,
            commands::settings::default_storage_path,
            commands::settings::initialize_storage,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::get_storage_info,
            commands::settings::open_data_folder,
            commands::projects::get_projects,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::files::get_files,
            commands::files::get_file,
            commands::files::rename_file,
            commands::files::delete_file,
            commands::folders::get_folders,
            commands::folders::get_folder_path,
            commands::folders::create_folder,
            commands::folders::rename_folder,
            commands::folders::delete_folder,
            commands::versions::get_versions,
            commands::versions::upload_file,
            commands::versions::upload_new_version,
            commands::versions::restore_version,
            commands::versions::delete_version,
            commands::versions::download_version,
            commands::versions::open_version,
            commands::backup::create_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
