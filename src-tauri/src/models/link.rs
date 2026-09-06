use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkGroup {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub link_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub group_id: Option<String>,
    pub group_name: Option<String>,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkGroupInput {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkInput {
    pub project_id: String,
    pub group_id: Option<String>,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
}

/// Serde's "double option" trick (see `TaskUpdateInput` in `tracker.rs` for
/// the full explanation) - lets `group_id`/`description` distinguish "not
/// sent, leave unchanged" from "sent as null, clear it".
fn double_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LinkUpdateInput {
    pub title: Option<String>,
    pub url: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub description: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub group_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LinkFilter {
    pub search: Option<String>,
    pub project_id: Option<String>,
}
