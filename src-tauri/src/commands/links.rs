use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::database::{link_groups as groups_db, link_projects as link_projects_db, links as links_db};
use crate::models::{Link, LinkFilter, LinkGroup, LinkGroupInput, LinkInput, LinkProject, LinkProjectInput, LinkUpdateInput};
use crate::state::AppState;
use crate::utils::id::new_id;
use crate::utils::{now_iso, AppError, AppResult};

use super::with_ready;

/// Only ever hand a real `http(s)://` address to the OS opener - never
/// whatever a user (or corrupted data) happens to have typed, which is what
/// stops this from ever being able to "open" something other than a web
/// page (a local file, a custom app-launching scheme, etc).
fn validate_url(url: &str) -> AppResult<()> {
    let lower = url.trim().to_ascii_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return Err(AppError::user("Link must start with http:// or https://"));
    }
    Ok(())
}

// ---- Link projects --------------------------------------------------------------

#[tauri::command]
pub fn get_link_projects(state: State<AppState>) -> AppResult<Vec<LinkProject>> {
    with_ready(&state, |conn, _| Ok(link_projects_db::list_all(conn)?))
}

#[tauri::command]
pub fn create_link_project(state: State<AppState>, input: LinkProjectInput) -> AppResult<LinkProject> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Project name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let id = new_id();
        link_projects_db::create(conn, &id, &name, &now_iso())?;
        link_projects_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create project."))
    })
}

#[tauri::command]
pub fn update_link_project(state: State<AppState>, project_id: String, input: LinkProjectInput) -> AppResult<LinkProject> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Project name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = link_projects_db::update(conn, &project_id, &name, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This project no longer exists."));
        }
        link_projects_db::get(conn, &project_id)?.ok_or_else(|| AppError::user("Failed to update project."))
    })
}

#[tauri::command]
pub fn reorder_link_projects(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            link_projects_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

/// Unlike deleting a link group, this cascades to every group and link
/// inside the project (`ON DELETE CASCADE`) - it deletes the whole
/// collection, matching what deleting a project means everywhere else in
/// the app.
#[tauri::command]
pub fn delete_link_project(state: State<AppState>, project_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        if link_projects_db::get(conn, &project_id)?.is_none() {
            return Err(AppError::user("This project no longer exists."));
        }
        link_projects_db::delete(conn, &project_id)?;
        crate::utils::logger::info(storage, &format!("Link project deleted: {project_id}"));
        Ok(())
    })
}

// ---- Links ------------------------------------------------------------------

#[tauri::command]
pub fn get_links(state: State<AppState>, filter: LinkFilter) -> AppResult<Vec<Link>> {
    with_ready(&state, |conn, _| Ok(links_db::list(conn, &filter)?))
}

#[tauri::command]
pub fn create_link(state: State<AppState>, input: LinkInput) -> AppResult<Link> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::user("Link title cannot be empty."));
    }
    let url = input.url.trim().to_string();
    validate_url(&url)?;
    with_ready(&state, |conn, _| {
        if !link_projects_db::exists(conn, &input.project_id)? {
            return Err(AppError::user("This project no longer exists."));
        }
        if let Some(group_id) = &input.group_id {
            let group = groups_db::get(conn, group_id)?.ok_or_else(|| AppError::user("This group no longer exists."))?;
            if group.project_id != input.project_id {
                return Err(AppError::user("That group doesn't belong to this project."));
            }
        }
        let id = new_id();
        let now = now_iso();
        links_db::create(
            conn, &id, &input.project_id, input.group_id.as_deref(), &title, &url,
            input.description.as_deref(), &now,
        )?;
        links_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create link."))
    })
}

#[tauri::command]
pub fn update_link(state: State<AppState>, link_id: String, patch: LinkUpdateInput) -> AppResult<Link> {
    if let Some(title) = &patch.title {
        if title.trim().is_empty() {
            return Err(AppError::user("Link title cannot be empty."));
        }
    }
    let title = patch.title.as_ref().map(|t| t.trim().to_string());
    let url = match &patch.url {
        Some(u) => {
            let trimmed = u.trim().to_string();
            validate_url(&trimmed)?;
            Some(trimmed)
        }
        None => None,
    };
    with_ready(&state, |conn, _| {
        let description = patch.description.as_ref().map(|d| d.as_deref());
        let updated = links_db::apply_update(conn, &link_id, title.as_deref(), url.as_deref(), description, &now_iso())?;
        if updated.is_none() {
            return Err(AppError::user("This link no longer exists."));
        }
        if let Some(Some(group_id)) = &patch.group_id {
            let link = links_db::get(conn, &link_id)?.ok_or_else(|| AppError::user("This link no longer exists."))?;
            let group = groups_db::get(conn, group_id)?.ok_or_else(|| AppError::user("This group no longer exists."))?;
            if group.project_id != link.project_id {
                return Err(AppError::user("That group doesn't belong to this project."));
            }
            links_db::set_group(conn, &link_id, Some(group_id))?;
        } else if let Some(None) = &patch.group_id {
            links_db::set_group(conn, &link_id, None)?;
        }
        links_db::get(conn, &link_id)?.ok_or_else(|| AppError::user("This link no longer exists."))
    })
}

#[tauri::command]
pub fn delete_link(state: State<AppState>, link_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        if links_db::get(conn, &link_id)?.is_none() {
            return Err(AppError::user("This link no longer exists."));
        }
        links_db::delete(conn, &link_id)?;
        crate::utils::logger::info(storage, &format!("Link deleted: {link_id}"));
        Ok(())
    })
}

/// Backs both a cross-group drag (group changes) and a same-group reorder
/// (group unchanged) - `ordered_ids` is always the destination group's full
/// new order, moved link included, matching `move_tracker_task`'s contract.
#[tauri::command]
pub fn move_link(state: State<AppState>, link_id: String, group_id: Option<String>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        let link = links_db::get(conn, &link_id)?.ok_or_else(|| AppError::user("This link no longer exists."))?;
        if let Some(gid) = &group_id {
            let group = groups_db::get(conn, gid)?.ok_or_else(|| AppError::user("This group no longer exists."))?;
            if group.project_id != link.project_id {
                return Err(AppError::user("That group doesn't belong to this project."));
            }
        }
        if link.group_id != group_id {
            links_db::set_group(conn, &link_id, group_id.as_deref())?;
        }
        for (i, id) in ordered_ids.iter().enumerate() {
            links_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn open_link(app: AppHandle, url: String) -> AppResult<()> {
    validate_url(&url)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| AppError::with_details("Unable to open this link.", e))
}

// ---- Link groups ---------------------------------------------------------------

#[tauri::command]
pub fn get_link_groups(state: State<AppState>, project_id: String) -> AppResult<Vec<LinkGroup>> {
    with_ready(&state, |conn, _| Ok(groups_db::list_for_project(conn, &project_id)?))
}

#[tauri::command]
pub fn get_all_link_groups(state: State<AppState>) -> AppResult<Vec<LinkGroup>> {
    with_ready(&state, |conn, _| Ok(groups_db::list_all(conn)?))
}

#[tauri::command]
pub fn create_link_group(state: State<AppState>, project_id: String, input: LinkGroupInput) -> AppResult<LinkGroup> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Group name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        if !link_projects_db::exists(conn, &project_id)? {
            return Err(AppError::user("This project no longer exists."));
        }
        let id = new_id();
        groups_db::create(conn, &id, &project_id, &name, &now_iso())?;
        groups_db::get(conn, &id)?.ok_or_else(|| AppError::user("Failed to create group."))
    })
}

#[tauri::command]
pub fn update_link_group(state: State<AppState>, group_id: String, input: LinkGroupInput) -> AppResult<LinkGroup> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::user("Group name cannot be empty."));
    }
    with_ready(&state, |conn, _| {
        let updated = groups_db::update(conn, &group_id, &name, &now_iso())?;
        if updated == 0 {
            return Err(AppError::user("This group no longer exists."));
        }
        groups_db::get(conn, &group_id)?.ok_or_else(|| AppError::user("Failed to update group."))
    })
}

#[tauri::command]
pub fn reorder_link_groups(state: State<AppState>, ordered_ids: Vec<String>) -> AppResult<()> {
    with_ready(&state, |conn, _| {
        for (i, id) in ordered_ids.iter().enumerate() {
            groups_db::set_position(conn, id, i as i64)?;
        }
        Ok(())
    })
}

/// Deleting a group never deletes its links (`group_id` is `ON DELETE SET
/// NULL`) - they just become ungrouped, no confirmation-with-reassignment
/// needed the way deleting a status/priority does.
#[tauri::command]
pub fn delete_link_group(state: State<AppState>, group_id: String) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        if groups_db::get(conn, &group_id)?.is_none() {
            return Err(AppError::user("This group no longer exists."));
        }
        groups_db::delete(conn, &group_id)?;
        crate::utils::logger::info(storage, &format!("Link group deleted: {group_id}"));
        Ok(())
    })
}
