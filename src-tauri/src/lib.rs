mod commands;
mod database;
mod models;
mod state;
mod storage;
mod utils;

use tauri::Manager;

use state::{AppState, AppStateInner};

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::uninitialized())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            if let Ok(Some(config)) = state::read_storage_config(&handle) {
                match state::open_storage_into_state(&state, config.storage_path.into()) {
                    Ok(()) => {
                        if let AppStateInner::Ready { storage, .. } =
                            &*state.inner.lock().expect("state mutex poisoned")
                        {
                            utils::logger::info(storage, &format!("App started (v{})", env!("CARGO_PKG_VERSION")));
                        }
                    }
                    Err(e) => eprintln!("Failed to reopen previous storage location: {e}"),
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
            commands::projects::reorder_projects,
            commands::projects::delete_project,
            commands::files::get_files,
            commands::files::search_files_global,
            commands::files::get_file,
            commands::files::rename_file,
            commands::files::reorder_files,
            commands::files::move_file,
            commands::files::delete_file,
            commands::folders::get_folders,
            commands::folders::get_folder_path,
            commands::folders::create_folder,
            commands::folders::rename_folder,
            commands::folders::reorder_folders,
            commands::folders::move_folder,
            commands::folders::delete_folder,
            commands::versions::get_versions,
            commands::versions::upload_file,
            commands::versions::path_is_directory,
            commands::versions::import_folder,
            commands::versions::upload_new_version,
            commands::versions::restore_version,
            commands::versions::update_version_description,
            commands::versions::delete_version,
            commands::versions::download_version,
            commands::versions::open_version,
            commands::backup::create_backup,
            commands::tracker_boards::get_tracker_boards,
            commands::tracker_boards::create_tracker_board,
            commands::tracker_boards::update_tracker_board,
            commands::tracker_boards::set_tracker_board_card_size,
            commands::tracker_boards::reorder_tracker_boards,
            commands::tracker_boards::delete_tracker_board,
            commands::tracker_boards::get_tracker_statuses,
            commands::tracker_boards::create_tracker_status,
            commands::tracker_boards::update_tracker_status,
            commands::tracker_boards::set_tracker_status_default,
            commands::tracker_boards::set_tracker_status_is_done,
            commands::tracker_boards::reorder_tracker_statuses,
            commands::tracker_boards::delete_tracker_status,
            commands::tracker_boards::get_tracker_fields,
            commands::tracker_boards::create_tracker_field,
            commands::tracker_boards::update_tracker_field,
            commands::tracker_boards::reorder_tracker_fields,
            commands::tracker_boards::delete_tracker_field,
            commands::tracker_boards::get_tracker_labels,
            commands::tracker_boards::create_tracker_label,
            commands::tracker_boards::update_tracker_label,
            commands::tracker_boards::reorder_tracker_labels,
            commands::tracker_boards::delete_tracker_label,
            commands::tracker_boards::get_tracker_priorities,
            commands::tracker_boards::create_tracker_priority,
            commands::tracker_boards::update_tracker_priority,
            commands::tracker_boards::set_tracker_priority_default,
            commands::tracker_boards::reorder_tracker_priorities,
            commands::tracker_boards::delete_tracker_priority,
            commands::tracker_tasks::get_tracker_tasks,
            commands::tracker_tasks::get_all_tracker_tasks,
            commands::tracker_tasks::get_project_tracker_tasks,
            commands::tracker_tasks::get_file_tracker_tasks,
            commands::tracker_tasks::get_tracker_task,
            commands::tracker_tasks::create_tracker_task,
            commands::tracker_tasks::update_tracker_task,
            commands::tracker_tasks::set_tracker_task_field_values,
            commands::tracker_tasks::set_tracker_task_labels,
            commands::tracker_tasks::move_tracker_task,
            commands::tracker_tasks::set_tracker_task_pinned,
            commands::tracker_tasks::set_tracker_task_archived,
            commands::tracker_tasks::delete_tracker_task,
            commands::tracker_tasks::duplicate_tracker_task,
            commands::tracker_tasks::attach_tracker_task_file,
            commands::tracker_tasks::detach_tracker_task_file,
            commands::tracker_tasks::set_tracker_task_file_pin,
            commands::tracker_tasks::add_tracker_task_local_file,
            commands::tracker_tasks::remove_tracker_task_local_file,
            commands::tracker_tasks::open_tracker_task_local_file,
            commands::tracker_tasks::add_tracker_task_comment,
            commands::tracker_settings::get_tracker_ui_state,
            commands::tracker_settings::set_tracker_ui_state,
            commands::links::get_link_projects,
            commands::links::create_link_project,
            commands::links::update_link_project,
            commands::links::reorder_link_projects,
            commands::links::delete_link_project,
            commands::links::get_links,
            commands::links::create_link,
            commands::links::update_link,
            commands::links::delete_link,
            commands::links::move_link,
            commands::links::open_link,
            commands::links::get_link_groups,
            commands::links::get_all_link_groups,
            commands::links::create_link_group,
            commands::links::update_link_group,
            commands::links::reorder_link_groups,
            commands::links::delete_link_group,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
