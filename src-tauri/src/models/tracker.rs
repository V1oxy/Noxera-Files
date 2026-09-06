use serde::{Deserialize, Deserializer, Serialize};

// ---- Enums ------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FieldType {
    Text,
    Number,
    Date,
    Datetime,
    Select,
    Boolean,
    Url,
}

impl FieldType {
    pub fn as_str(self) -> &'static str {
        match self {
            FieldType::Text => "text",
            FieldType::Number => "number",
            FieldType::Date => "date",
            FieldType::Datetime => "datetime",
            FieldType::Select => "select",
            FieldType::Boolean => "boolean",
            FieldType::Url => "url",
        }
    }

    pub fn parse(s: &str) -> FieldType {
        match s {
            "number" => FieldType::Number,
            "date" => FieldType::Date,
            "datetime" => FieldType::Datetime,
            "select" => FieldType::Select,
            "boolean" => FieldType::Boolean,
            "url" => FieldType::Url,
            _ => FieldType::Text,
        }
    }
}

// ---- Boards / statuses / fields / labels -------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub card_size: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub task_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub is_default: bool,
    pub is_done: bool,
    pub created_at: String,
    pub updated_at: String,
    pub task_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub field_type: FieldType,
    pub options: Vec<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub created_at: String,
}

/// A priority level - per board, edited from board settings, exactly like
/// `Status`. A task's `priority` column stores one of these rows' id.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Priority {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
    pub task_count: i64,
}

// ---- Tasks --------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldValue {
    pub field_id: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskFile {
    pub id: String,
    pub task_id: String,
    pub file_id: String,
    pub file_name: String,
    pub file_exists: bool,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub folder_id: Option<String>,
    pub always_latest: bool,
    pub version_id: Option<String>,
    pub version_exists: bool,
    pub version_number: Option<i64>,
    pub version_date: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub unseen_update: bool,
    pub added_at: String,
}

/// A file attached "from the computer" rather than picked from the app's own
/// storage - its bytes exist only for this task and are never versioned.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskLocalFile {
    pub id: String,
    pub task_id: String,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEvent {
    pub id: String,
    pub task_id: String,
    pub kind: String,
    pub payload: Option<serde_json::Value>,
    pub author: Option<String>,
    pub created_at: String,
}

/// One Kanban card / row - shared by the board view and the cross-board "All
/// Tasks" view, so `board_name`/`status_name`/`status_color` are always
/// populated (not just when listing across boards).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub board_id: String,
    pub board_name: String,
    pub status_id: String,
    pub status_name: String,
    pub status_color: String,
    pub status_is_done: bool,
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub customer: Option<String>,
    pub assignee: Option<String>,
    pub priority_id: String,
    pub priority_name: String,
    pub priority_color: String,
    pub priority_position: i64,
    pub pinned: bool,
    pub archived: bool,
    pub position: i64,
    pub received_at: String,
    pub due_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub file_count: i64,
    pub has_unseen_update: bool,
    pub label_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetail {
    #[serde(flatten)]
    pub task: Task,
    pub field_values: Vec<FieldValue>,
    pub files: Vec<TaskFile>,
    pub local_files: Vec<TaskLocalFile>,
    pub events: Vec<TaskEvent>,
}

// ---- Command inputs -----------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusInput {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldInput {
    pub name: String,
    pub field_type: FieldType,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelInput {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityInput {
    pub name: String,
    pub color: String,
}

/// Serde's standard "double option" trick: a field that's absent from the
/// JSON payload means "leave unchanged" (`None`), while a field present but
/// set to `null` means "clear it" (`Some(None)`) - the only way an
/// `Option<T>` alone can distinguish "not sent" from "sent as null", which
/// several nullable task fields (due date, completion date, project, ...)
/// need for their "clear" actions.
fn double_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub board_id: String,
    pub status_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
    pub customer: Option<String>,
    pub assignee: Option<String>,
    pub priority_id: Option<String>,
    pub received_at: Option<String>,
    pub due_at: Option<String>,
    pub label_ids: Option<Vec<String>>,
    pub field_values: Option<Vec<FieldValue>>,
    pub files: Option<Vec<NewTaskFile>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTaskFile {
    pub file_id: String,
    pub version_id: Option<String>,
    pub always_latest: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TaskSortField {
    Created,
    ReceivedAt,
    DueAt,
    Priority,
    UpdatedAt,
    CompletedAt,
    Title,
    Customer,
}

/// Every filter is optional and they combine with AND (spec: "фильтры можно
/// комбинировать") - applied in Rust over the already-loaded task list
/// (`tracker_tasks::list_all`) rather than as dynamic SQL, since a single
/// user's local task list is small enough that this is simpler and safer
/// than building a query string field-by-field.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskFilter {
    pub search: Option<String>,
    pub project_id: Option<String>,
    pub board_id: Option<String>,
    pub status_id: Option<String>,
    pub customer: Option<String>,
    pub assignee: Option<String>,
    pub priority_id: Option<String>,
    pub label_id: Option<String>,
    pub has_files: Option<bool>,
    pub overdue_only: Option<bool>,
    pub include_archived: Option<bool>,
    pub due_before: Option<String>,
    pub due_after: Option<String>,
    pub received_before: Option<String>,
    pub received_after: Option<String>,
    pub sort_field: Option<TaskSortField>,
    pub sort_dir: Option<super::SortDirection>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpdateInput {
    pub title: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub description: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub project_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub customer: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub assignee: Option<Option<String>>,
    pub priority_id: Option<String>,
    pub received_at: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub due_at: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub completed_at: Option<Option<String>>,
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateOptions {
    pub description: bool,
    pub field_values: bool,
    pub priority: bool,
    pub assignee: bool,
    pub files: bool,
    pub due_at: bool,
}

// ---- Tracker-wide settings (spec section 32: Display) -------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardDisplayConfig {
    pub show_project: bool,
    pub show_priority: bool,
    pub show_due_date: bool,
    pub show_assignee: bool,
    pub show_file_count: bool,
    pub show_update_indicator: bool,
}

impl Default for CardDisplayConfig {
    fn default() -> Self {
        Self {
            show_project: true,
            show_priority: true,
            show_due_date: true,
            show_assignee: true,
            show_file_count: true,
            show_update_indicator: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerSettings {
    pub card_display: CardDisplayConfig,
}

impl Default for TrackerSettings {
    fn default() -> Self {
        Self { card_display: CardDisplayConfig::default() }
    }
}
