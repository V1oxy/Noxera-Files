# Noxera Files

A local-first desktop app for keeping every project and every file's version
history in one place. Built with **Tauri 2 + React + TypeScript + Rust +
SQLite** — no browser, no server, no internet connection required.

```
Noxera Files
│
├── Project 1
│   ├── Files
│   │   ├── Technical Spec.docx
│   │   │   ├── v1
│   │   │   ├── v2
│   │   │   └── v3 ← current
│   │   └── Financial Model.xlsx
│   │       ├── v1
│   │       └── v2 ← current
│   └── ...
├── Project 2
└── Settings
```

You work with a **logical file** — the list only ever shows the current
version, while every earlier version stays in the file's history. Uploading
a new version, restoring an old one, or deleting a version never touches the
others: each version is an independent, checksummed copy on disk.

## Requirements

- [Node.js](https://nodejs.org/) 18+ and npm
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Platform build tools for Tauri — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/):
  - **Windows**: Microsoft C++ Build Tools + WebView2 (preinstalled on modern Windows)
  - **macOS**: Xcode Command Line Tools
  - **Linux** (development only): `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libjavascriptcoregtk-4.1-dev`, `libsoup-3.0-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

## Install & run in development

```bash
npm install
npm run tauri dev
```

This starts the Vite dev server and opens the app in a native window (not a
browser). Hot reload works for the React frontend; Rust changes trigger a
rebuild.

## Production build

```bash
npm run build          # type-check + bundle the frontend only
npm run tauri build     # build the full native app + installer for the current OS
```

Output lands in `src-tauri/target/release/bundle/`:

- **Windows** → `nsis/NoxeraFiles-Setup.exe` (and/or `msi/*.msi`), plus the
  raw `noxera-files.exe` in `target/release/`
- **macOS** → `macos/Noxera Files.app` and `dmg/*.dmg`
- **Linux** → `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage`

Tauri does not cross-compile GUI apps between OSes, so build on (or via CI
runners for) the target platform:

- macOS: run `npm run tauri build` on Apple Silicon and/or Intel Macs, or add
  `--target universal-apple-darwin` on Apple Silicon with both Rust targets
  installed (`rustup target add x86_64-apple-darwin
  aarch64-apple-darwin`) for a single universal binary.
- Windows: run `npm run tauri build` on Windows (x64).

See `.github/workflows/build.yml` for a ready-to-use GitHub Actions workflow
that builds installers for Windows and macOS (Intel + Apple Silicon) on their
native runners whenever you push a version tag.

## Project structure

```
noxera-files/
├── src/                      React + TypeScript frontend
│   ├── components/           Reusable UI: Sidebar, FileList, FileRow,
│   │                         modals, Toast, EmptyState, context menu...
│   ├── pages/                Onboarding, ProjectView (files), Settings
│   ├── hooks/                useProjects, useFiles, useVersions,
│   │                         useTheme, useToast, useSettings
│   ├── services/api.ts       Typed wrappers around Tauri commands
│   ├── types/                Shared TypeScript types (mirrors Rust models)
│   └── utils/                Formatting helpers
│
└── src-tauri/                 Rust backend
    ├── src/
    │   ├── commands/          #[tauri::command] handlers exposed to the frontend
    │   ├── database/          SQLite schema + query layer (rusqlite)
    │   ├── storage/           Path safety, versioned file storage, checksums
    │   ├── models/            Shared data structs (Project, FileEntry, FileVersion...)
    │   ├── state.rs           App state (open DB connection + storage root)
    │   └── lib.rs / main.rs   Tauri app bootstrap
    └── tauri.conf.json
```

The frontend never touches the filesystem directly — every operation goes
through a Tauri command in `src-tauri/src/commands/`, which validates input
and delegates to the `storage` and `database` layers.

## Local storage layout

On first launch you choose where to keep your data (a normal folder on your
computer, e.g. `D:\NoxeraFiles` or `~/NoxeraFiles`). That choice is
remembered outside the database (`config.json` in the OS app-config
directory) so it can be read before the database itself is opened.

```
<your chosen folder>/
├── database.sqlite          All metadata: projects, files, versions
├── projects/
│   └── <project-id>/
│       └── files/
│           └── <file-id>/
│               ├── v1/<original filename>
│               ├── v2/<original filename>
│               └── v3/<original filename>
├── backups/                 Zip archives created from Settings → Backup
├── logs/                    app.log — technical details behind user-facing errors
└── temp/                    Scratch space for in-progress uploads; swept on every launch
```

Physical files are the source of truth; SQLite stores metadata and the
relative path to each version's file. A version is only considered to exist
once **both** the file on disk and its database row are written — uploads
stream to a temp file first and are only moved into place (and only then
recorded in the database) once the copy and checksum succeed, so a crash
mid-upload can never leave an orphaned file or a dangling database row.

## Database schema

```sql
projects(id, name, description, position, created_at, updated_at)

folders(id, project_id, parent_folder_id, name, position, created_at, updated_at)

files(id, project_id, folder_id, name, current_version_id, next_version_number,
      position, created_at, updated_at)

file_versions(id, file_id, version_number, storage_path, original_filename,
              file_size, mime_type, checksum, description, created_at)

settings(key, value)
```

- Every `id` is a UUID — never a filename — so projects, files, and versions
  stay unambiguous even when names collide.
- `position` on projects/folders/files drives their manual drag-and-drop
  order and survives a restart; dragging a file also switches that project's
  sort mode to "Custom Order" so the arrangement is what's displayed again on
  the next launch.
- Version numbers stay **contiguous**: deleting version *N* shifts every
  version above it (and its on-disk `v{N}/` directory) down by one, so the
  file always shows `v1..v{count}` with no gaps. Every other version keeps
  its id, description, checksum and file untouched — only its number and
  storage path move. `files.next_version_number` is kept in sync so the next
  upload always continues right after the new highest version.
- `UNIQUE(file_id, version_number)` plus indexes on `files.project_id` and
  `file_versions.file_id` keep the common queries (a project's files, a
  file's version history) fast even with thousands of rows.
- **Restore** copies the source version's bytes into a brand-new version
  directory and a brand-new database row — it is never a link, so deleting
  the version you restored *from* never affects the restored copy.

## Security notes

- All physical paths are built from UUIDs the app generates itself, or
  validated to resolve inside the chosen storage root before use — user
  input can never escape the storage directory (no path traversal).
- "Open" hands the file to the OS's default application via the system
  opener; the app never executes an uploaded file itself, regardless of its
  extension (`.exe`, `.dmg`, `.sh`, etc. are all just bytes to it).
- Every file format is accepted — there is no extension whitelist — because
  the app never interprets file contents, only stores and moves them.

## Roadmap-readiness (not implemented yet)

The data model is intentionally ID-based so a future Kanban board can attach
a card to a `file_id` (optionally pinned to a specific `version_id`) without
ever storing a physical path. Sync, sharing, previews, and other
collaborative/cloud features are out of scope for this local-first release
but don't require a data model change to add later.
