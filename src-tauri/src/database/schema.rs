pub const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    current_version_id  TEXT,
    next_version_number INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_versions (
    id                 TEXT PRIMARY KEY,
    file_id            TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version_number     INTEGER NOT NULL,
    storage_path       TEXT NOT NULL,
    original_filename  TEXT NOT NULL,
    file_size          INTEGER NOT NULL,
    mime_type          TEXT,
    checksum           TEXT NOT NULL,
    description        TEXT,
    created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_versions_file_version
    ON file_versions(file_id, version_number);
"#;
