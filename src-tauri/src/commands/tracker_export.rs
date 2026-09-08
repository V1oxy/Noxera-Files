use std::collections::HashMap;
use std::path::Path;

use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook, Worksheet, XlsxError};
use tauri::State;

use crate::database::{tracker_field_values, tracker_fields, tracker_tasks};
use crate::models::{Task, TrackerExportFilter};
use crate::state::AppState;
use crate::utils::{AppError, AppResult};

use super::with_ready;

#[tauri::command]
pub fn count_tracker_export(state: State<AppState>, filter: TrackerExportFilter) -> AppResult<i64> {
    with_ready(&state, |conn, _| Ok(tracker_tasks::list_for_export(conn, &filter)?.len() as i64))
}

/// Writes the Excel report straight to `dest_path` - the frontend has
/// already resolved that path via the OS save dialog, the same flow
/// `download_version` uses.
#[tauri::command]
pub fn export_tracker_tasks_excel(
    state: State<AppState>,
    filter: TrackerExportFilter,
    dest_path: String,
) -> AppResult<()> {
    with_ready(&state, |conn, storage| {
        let tasks = tracker_tasks::list_for_export(conn, &filter)?;
        if tasks.is_empty() {
            return Err(AppError::user("No tasks matched the selected export filters."));
        }

        // Custom fields (spec: "other existing user fields, if used") are
        // per-board, and an export can span several boards at once - so
        // columns are the union of every distinct field *name* across every
        // board any exported task belongs to. Two boards' fields sharing a
        // name are treated as the same column; a task only ever fills in
        // whichever of that name's field ids it actually has a value for.
        let mut board_ids: Vec<&str> = tasks.iter().map(|t| t.board_id.as_str()).collect();
        board_ids.sort_unstable();
        board_ids.dedup();

        let mut field_names: Vec<String> = Vec::new();
        let mut field_ids_by_name: HashMap<String, Vec<String>> = HashMap::new();
        for board_id in &board_ids {
            for f in tracker_fields::list_for_board(conn, board_id)? {
                if !field_ids_by_name.contains_key(&f.name) {
                    field_names.push(f.name.clone());
                }
                field_ids_by_name.entry(f.name).or_default().push(f.id);
            }
        }

        let mut task_field_values: Vec<HashMap<String, String>> = Vec::with_capacity(tasks.len());
        for task in &tasks {
            let values = tracker_field_values::list_for_task(conn, &task.id)?;
            let by_id: HashMap<String, String> =
                values.into_iter().filter_map(|fv| fv.value.map(|v| (fv.field_id, v))).collect();
            let mut by_name: HashMap<String, String> = HashMap::new();
            for name in &field_names {
                if let Some(ids) = field_ids_by_name.get(name) {
                    if let Some(v) = ids.iter().find_map(|id| by_id.get(id)) {
                        by_name.insert(name.clone(), v.clone());
                    }
                }
            }
            task_field_values.push(by_name);
        }

        write_workbook(&tasks, &field_names, &task_field_values, Path::new(&dest_path))
            .map_err(|e| AppError::with_details("Unable to create the Excel file.", e))?;

        crate::utils::logger::info(
            storage,
            &format!("Tracker export: {} task(s) -> {dest_path}", tasks.len()),
        );
        Ok(())
    })
}

/// Best-effort ISO date parsing that accepts both a full RFC3339 timestamp
/// (`created_at`-style fields) and a plain `YYYY-MM-DD` date (the shape
/// `received_at` is actually stored in, since it comes straight from an
/// `<input type="date">`) - returns `None` rather than erroring so a single
/// malformed value never breaks the whole export.
fn parse_date(value: &str) -> Option<chrono::NaiveDate> {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(value) {
        return Some(dt.naive_utc().date());
    }
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
}

fn write_opt_string(worksheet: &mut Worksheet, row: u32, col: u16, value: Option<&str>) -> Result<(), XlsxError> {
    if let Some(v) = value.filter(|v| !v.is_empty()) {
        worksheet.write_string(row, col, v)?;
    }
    Ok(())
}

fn write_opt_date(
    worksheet: &mut Worksheet,
    row: u32,
    col: u16,
    value: Option<&str>,
    format: &Format,
) -> Result<(), XlsxError> {
    if let Some(date) = value.and_then(parse_date) {
        worksheet.write_datetime_with_format(row, col, date, format)?;
    }
    Ok(())
}

const HEADERS: [&str; 8] = [
    "Проект",
    "Название задачи",
    "Описание",
    "Статус",
    "Приоритет",
    "Дата создания",
    "Дата завершения",
    "Дата последнего изменения",
];

const DESCRIPTION_COL: u16 = 2;

fn write_workbook(
    tasks: &[Task],
    field_names: &[String],
    task_field_values: &[HashMap<String, String>],
    path: &Path,
) -> Result<(), XlsxError> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name("Задачи")?;

    let header_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xE3EBF7))
        .set_border(FormatBorder::Thin);
    let wrap_format = Format::new().set_text_wrap().set_align(FormatAlign::Top);
    let date_format = Format::new().set_num_format("dd.mm.yyyy");

    let mut headers: Vec<&str> = HEADERS.to_vec();
    headers.extend(field_names.iter().map(String::as_str));

    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, *header, &header_format)?;
    }

    for (row_idx, task) in tasks.iter().enumerate() {
        let row = (row_idx + 1) as u32;
        write_opt_string(worksheet, row, 0, task.project_name.as_deref())?;
        worksheet.write_string(row, 1, &task.title)?;
        write_opt_string(worksheet, row, 2, task.description.as_deref())?;
        worksheet.write_string(row, 3, &task.status_name)?;
        worksheet.write_string(row, 4, &task.priority_name)?;
        write_opt_date(worksheet, row, 5, Some(task.received_at.as_str()), &date_format)?;
        write_opt_date(worksheet, row, 6, task.completed_at.as_deref(), &date_format)?;
        write_opt_date(worksheet, row, 7, Some(task.updated_at.as_str()), &date_format)?;
        for (i, name) in field_names.iter().enumerate() {
            let col = HEADERS.len() as u16 + i as u16;
            if let Some(value) = task_field_values[row_idx].get(name) {
                write_opt_string(worksheet, row, col, Some(value.as_str()))?;
            }
        }
    }

    worksheet.set_column_format(DESCRIPTION_COL, &wrap_format)?;
    worksheet.set_freeze_panes(1, 0)?;
    let last_row = tasks.len() as u32;
    let last_col = (headers.len() - 1) as u16;
    worksheet.autofilter(0, 0, last_row, last_col)?;
    worksheet.autofit();
    // autofit sizes the Description column to its longest single line, which
    // can be huge - cap it and rely on the wrap format above for readability.
    worksheet.set_column_width(DESCRIPTION_COL, 50)?;

    workbook.save(path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str) -> Task {
        Task {
            id: id.to_string(),
            board_id: "board-1".to_string(),
            board_name: "Board".to_string(),
            status_id: "status-1".to_string(),
            status_name: "New".to_string(),
            status_color: "#0A84FF".to_string(),
            status_is_done: false,
            title: "Task title".to_string(),
            description: None,
            project_id: None,
            project_name: None,
            customer: None,
            priority_id: "priority-1".to_string(),
            priority_name: "Normal".to_string(),
            priority_color: "#0A84FF".to_string(),
            priority_position: 0,
            pinned: false,
            archived: false,
            position: 0,
            received_at: "2026-09-01".to_string(),
            completed_at: None,
            created_at: "2026-09-01T10:00:00+00:00".to_string(),
            updated_at: "2026-09-02T11:30:00+00:00".to_string(),
            file_count: 0,
            link_count: 0,
            has_unseen_update: false,
            label_ids: Vec::new(),
        }
    }

    /// A full task (every optional field set), one with every optional field
    /// missing, and one with a very long title/description - the export must
    /// handle all three without error and without silently dropping rows.
    #[test]
    fn writes_workbook_with_mixed_and_missing_fields() {
        let full = Task {
            project_id: Some("p1".to_string()),
            project_name: Some("Project One".to_string()),
            description: Some("A normal description.".to_string()),
            completed_at: Some("2026-09-08T09:00:00+00:00".to_string()),
            ..task("task-full")
        };
        let empty = task("task-empty"); // every optional field is None
        let long_text = "x".repeat(5000);
        let long = Task {
            title: "y".repeat(500),
            description: Some(long_text),
            ..task("task-long")
        };

        let tasks = vec![full, empty, long];
        let mut field_names = vec!["Custom Field".to_string()];
        let mut values_by_task = vec![HashMap::new(), HashMap::new(), HashMap::new()];
        values_by_task[0].insert("Custom Field".to_string(), "Value A".to_string());
        // task-empty and task-long deliberately have no value for this field
        // (must render as a blank cell, not break the export).

        let dir = std::env::temp_dir().join(format!("noxera-export-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("export.xlsx");

        write_workbook(&tasks, &field_names, &values_by_task, &path).expect("workbook should write successfully");

        // A valid .xlsx is itself a non-trivial zip archive - opening it back
        // up as one is a cheap way to catch a truncated/corrupt file without
        // needing a full xlsx reader dependency.
        let file = std::fs::File::open(&path).expect("export file should exist");
        let archive = zip::ZipArchive::new(file).expect("export file should be a valid zip/xlsx archive");
        assert!(!archive.is_empty());

        // Also exercise a second export with zero custom-field columns and
        // zero tasks-with-that-field, and with field_names empty entirely -
        // must not panic on the header-only, no-custom-columns shape either.
        field_names.clear();
        values_by_task = vec![HashMap::new(), HashMap::new(), HashMap::new()];
        write_workbook(&tasks, &field_names, &values_by_task, &path).expect("workbook without custom fields should also write");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn parses_both_plain_date_and_rfc3339_timestamp() {
        assert!(parse_date("2026-09-07").is_some());
        assert!(parse_date("2026-09-07T12:34:56+00:00").is_some());
        assert!(parse_date("not-a-date").is_none());
    }
}
