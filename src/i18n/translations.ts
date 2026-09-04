export type Lang = "en" | "ru";

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Onboarding
    "onboarding.appName": "Project Manager",
    "onboarding.tagline": "All your projects and files, in one place.",
    "onboarding.getStarted": "Get Started",
    "onboarding.storageQuestion": "Where should we store your data?",
    "onboarding.storageHint": "Everything stays on this computer. You can change this later in Settings.",
    "onboarding.chooseFolder": "Choose Folder",
    "onboarding.useDefault": "Use Default",
    "onboarding.continue": "Continue",
    "onboarding.errorFallback": "Unable to set up storage.",

    // Sidebar
    "sidebar.projects": "Projects",
    "sidebar.noProjects": "No projects yet",
    "sidebar.newProject": "New Project",
    "sidebar.settings": "Settings",

    // Projects empty state (main content when nothing selected)
    "projects.emptyTitle": "No projects yet",
    "projects.emptyDescription": "Create a project to start organizing your files and their versions.",

    // File list toolbar / sorting
    "files.searchPlaceholder": "Search files...",
    "files.newFolder": "New Folder",
    "files.uploadFile": "Upload File",
    "files.loading": "Loading...",
    "files.emptyTitle": "No files yet",
    "files.emptyDescription": "Upload your first project file, or create a folder to get organized.",
    "files.noMatchTitle": "No matching files",
    "files.noMatchDescription": 'Nothing found for "{search}".',
    "files.dropNewVersion": "Drop to add a new version",
    "files.dropIntoFolder": "Drop to upload into this folder",
    "files.dropHere": "Drop file here",
    "files.noVersions": "No versions",
    "files.modified": "Modified {date} · {size}",
    "sort.name": "Name",
    "sort.lastModified": "Last Modified",
    "sort.created": "Created",
    "sort.size": "Size",

    // Folder row
    "folder.empty": "Empty",
    "folder.itemCount": "{count} item",
    "folder.itemCount_plural": "{count} items",

    // Context menu (files + folders)
    "menu.open": "Open",
    "menu.download": "Download",
    "menu.uploadNewVersion": "Upload New Version",
    "menu.versionHistory": "Version History",
    "menu.rename": "Rename",
    "menu.delete": "Delete",

    // Generic buttons
    "common.cancel": "Cancel",
    "common.create": "Create",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.restore": "Restore",
    "common.download": "Download",
    "common.today": "Today",
    "common.yesterday": "Yesterday",
    "common.actionErrorFallback": "Unable to complete this action.",

    // Upload modal
    "upload.titleAddFile": "Add File",
    "upload.titleNewVersion": "Upload New Version",
    "upload.file": "File",
    "upload.version": "Version",
    "upload.whatChanged": "What changed?",
    "upload.whatChangedPlaceholder": "Describe what changed in this version",
    "upload.uploading": "Uploading...",
    "upload.uploadingProgress": "Uploading... {pct}% · {written} / {total}",
    "upload.confirm": "Upload",
    "upload.errorFallback": "Unable to upload the file.",

    // Restore modal
    "restore.title": "Restore v{version}?",
    "restore.subtitle": "A new version will be created using the contents of this version. Existing versions will not be changed.",
    "restore.description": "Description",
    "restore.defaultDescription": "Restored from version v{version}",
    "restore.confirm": "Restore",
    "restore.errorFallback": "Unable to restore this version.",

    // Delete confirmations (built dynamically in ProjectView)
    "delete.versionTitle": "Delete v{version}?",
    "delete.versionMessage": "The file of this version will be deleted from the computer. This action cannot be undone.",
    "delete.fileTitle": 'Delete "{name}"?',
    "delete.fileMessage": "This file and all of its versions will be deleted from this computer. This action cannot be undone.",
    "delete.folderTitle": 'Delete "{name}"?',
    "delete.folderMessage": "This folder and everything inside it (subfolders and files, with all their versions) will be deleted from this computer. This action cannot be undone.",
    "delete.projectTitle": "Delete Project?",
    "delete.projectMessage": "The project and all associated files will be deleted from this computer. This action cannot be undone.",

    // Rename modals
    "rename.fileTitle": "Rename File",
    "rename.fileEmptyError": "File name cannot be empty.",
    "rename.fileErrorFallback": "Unable to rename this file.",
    "rename.folderTitle": "Rename Folder",
    "rename.folderEmptyError": "Folder name cannot be empty.",
    "rename.folderErrorFallback": "Unable to rename this folder.",

    // New folder modal
    "newFolder.title": "New Folder",
    "newFolder.placeholder": "Folder name",
    "newFolder.emptyError": "Folder name cannot be empty.",
    "newFolder.errorFallback": "Unable to create this folder.",

    // Project modal
    "project.newTitle": "New Project",
    "project.editTitle": "Edit Project",
    "project.name": "Name",
    "project.description": "Description",
    "project.emptyError": "Project name cannot be empty.",
    "project.errorFallback": "Unable to save this project.",

    // Version history modal
    "history.subtitle": "Version History",
    "history.uploadNewVersion": "Upload New Version",

    // Version card
    "version.current": "Current",

    // Toasts
    "toast.fileUploaded": "File uploaded",
    "toast.versionCreated": "Version v{version} created",
    "toast.versionRestored": "Version v{version} restored",
    "toast.newVersionCreated": "New version created",
    "toast.versionDeleted": "Version v{version} deleted",
    "toast.fileDeleted": "File deleted",
    "toast.fileRenamed": "File renamed",
    "toast.folderCreated": "Folder created",
    "toast.folderRenamed": "Folder renamed",
    "toast.folderDeleted": "Folder deleted",
    "toast.downloadComplete": "Download complete",
    "toast.filesUploaded": "{count} file uploaded",
    "toast.filesUploaded_plural": "{count} files uploaded",
    "toast.openFileError": "Unable to open the file",
    "toast.downloadFileError": "Unable to download the file",
    "toast.settingUpdateError": "Unable to update setting",
    "toast.backupCreated": "Backup created",
    "toast.backupError": "Unable to create backup",

    // Settings page
    "settings.title": "Settings",
    "settings.storage": "Storage",
    "settings.storageLocation": "Storage location",
    "settings.openFolder": "Open Folder",
    "settings.dataUsed": "Data used",
    "settings.calculating": "Calculating...",
    "settings.backup": "Backup",
    "settings.createBackup": "Create a backup",
    "settings.createBackupDescription": "Bundles your database and files into one archive.",
    "settings.createBackupButton": "Create Backup",
    "settings.creating": "Creating...",
    "settings.backupsFolder": "Backups folder",
    "settings.appearance": "Appearance",
    "settings.theme.system": "System",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.language": "Language",
    "settings.language.system": "System",
    "settings.language.en": "English",
    "settings.language.ru": "Russian",
    "settings.general": "General",
    "settings.launchAtStartup": "Launch at system startup",
    "settings.logs": "Logs",
    "settings.openLogsFolder": "Open Logs Folder",
  },

  ru: {
    // Onboarding
    "onboarding.appName": "Project Manager",
    "onboarding.tagline": "Все ваши проекты и файлы — в одном месте.",
    "onboarding.getStarted": "Начать",
    "onboarding.storageQuestion": "Где хранить данные?",
    "onboarding.storageHint": "Всё остаётся на этом компьютере. Позже это можно изменить в настройках.",
    "onboarding.chooseFolder": "Выбрать папку",
    "onboarding.useDefault": "Стандартная папка",
    "onboarding.continue": "Продолжить",
    "onboarding.errorFallback": "Не удалось настроить хранилище.",

    // Sidebar
    "sidebar.projects": "Проекты",
    "sidebar.noProjects": "Пока нет проектов",
    "sidebar.newProject": "Новый проект",
    "sidebar.settings": "Настройки",

    // Projects empty state
    "projects.emptyTitle": "Пока нет проектов",
    "projects.emptyDescription": "Создайте проект, чтобы начать организовывать файлы и их версии.",

    // File list toolbar / sorting
    "files.searchPlaceholder": "Поиск файлов...",
    "files.newFolder": "Новая папка",
    "files.uploadFile": "Загрузить файл",
    "files.loading": "Загрузка...",
    "files.emptyTitle": "Пока нет файлов",
    "files.emptyDescription": "Загрузите первый файл проекта или создайте папку для организации.",
    "files.noMatchTitle": "Ничего не найдено",
    "files.noMatchDescription": 'По запросу «{search}» ничего не найдено.',
    "files.dropNewVersion": "Отпустите, чтобы добавить новую версию",
    "files.dropIntoFolder": "Отпустите, чтобы загрузить в эту папку",
    "files.dropHere": "Перетащите файл сюда",
    "files.noVersions": "Нет версий",
    "files.modified": "Изменено {date} · {size}",
    "sort.name": "Имени",
    "sort.lastModified": "Дате изменения",
    "sort.created": "Дате создания",
    "sort.size": "Размеру",

    // Folder row
    "folder.empty": "Пусто",
    "folder.itemCount": "{count} элемент",
    "folder.itemCount_plural": "{count} элементов",

    // Context menu
    "menu.open": "Открыть",
    "menu.download": "Скачать",
    "menu.uploadNewVersion": "Загрузить новую версию",
    "menu.versionHistory": "История версий",
    "menu.rename": "Переименовать",
    "menu.delete": "Удалить",

    // Generic buttons
    "common.cancel": "Отмена",
    "common.create": "Создать",
    "common.save": "Сохранить",
    "common.delete": "Удалить",
    "common.restore": "Восстановить",
    "common.download": "Скачать",
    "common.today": "Сегодня",
    "common.yesterday": "Вчера",
    "common.actionErrorFallback": "Не удалось выполнить это действие.",

    // Upload modal
    "upload.titleAddFile": "Добавить файл",
    "upload.titleNewVersion": "Загрузка новой версии",
    "upload.file": "Файл",
    "upload.version": "Версия",
    "upload.whatChanged": "Что изменилось?",
    "upload.whatChangedPlaceholder": "Опишите, что изменилось в этой версии",
    "upload.uploading": "Загрузка...",
    "upload.uploadingProgress": "Загрузка... {pct}% · {written} / {total}",
    "upload.confirm": "Загрузить",
    "upload.errorFallback": "Не удалось загрузить файл.",

    // Restore modal
    "restore.title": "Восстановить v{version}?",
    "restore.subtitle": "Будет создана новая версия с содержимым этой версии. Существующие версии не изменятся.",
    "restore.description": "Описание",
    "restore.defaultDescription": "Восстановлено из версии v{version}",
    "restore.confirm": "Восстановить",
    "restore.errorFallback": "Не удалось восстановить эту версию.",

    // Delete confirmations
    "delete.versionTitle": "Удалить v{version}?",
    "delete.versionMessage": "Файл этой версии будет удалён с компьютера. Это действие нельзя отменить.",
    "delete.fileTitle": 'Удалить «{name}»?',
    "delete.fileMessage": "Этот файл и все его версии будут удалены с компьютера. Это действие нельзя отменить.",
    "delete.folderTitle": 'Удалить «{name}»?',
    "delete.folderMessage": "Эта папка и всё её содержимое (вложенные папки и файлы со всеми версиями) будут удалены с компьютера. Это действие нельзя отменить.",
    "delete.projectTitle": "Удалить проект?",
    "delete.projectMessage": "Проект и все связанные с ним файлы будут удалены с компьютера. Это действие нельзя отменить.",

    // Rename modals
    "rename.fileTitle": "Переименование файла",
    "rename.fileEmptyError": "Имя файла не может быть пустым.",
    "rename.fileErrorFallback": "Не удалось переименовать файл.",
    "rename.folderTitle": "Переименование папки",
    "rename.folderEmptyError": "Имя папки не может быть пустым.",
    "rename.folderErrorFallback": "Не удалось переименовать папку.",

    // New folder modal
    "newFolder.title": "Новая папка",
    "newFolder.placeholder": "Имя папки",
    "newFolder.emptyError": "Имя папки не может быть пустым.",
    "newFolder.errorFallback": "Не удалось создать папку.",

    // Project modal
    "project.newTitle": "Новый проект",
    "project.editTitle": "Редактирование проекта",
    "project.name": "Название",
    "project.description": "Описание",
    "project.emptyError": "Название проекта не может быть пустым.",
    "project.errorFallback": "Не удалось сохранить проект.",

    // Version history modal
    "history.subtitle": "История версий",
    "history.uploadNewVersion": "Загрузить новую версию",

    // Version card
    "version.current": "Текущая",

    // Toasts
    "toast.fileUploaded": "Файл загружен",
    "toast.versionCreated": "Создана версия v{version}",
    "toast.versionRestored": "Версия v{version} восстановлена",
    "toast.newVersionCreated": "Создана новая версия",
    "toast.versionDeleted": "Версия v{version} удалена",
    "toast.fileDeleted": "Файл удалён",
    "toast.fileRenamed": "Файл переименован",
    "toast.folderCreated": "Папка создана",
    "toast.folderRenamed": "Папка переименована",
    "toast.folderDeleted": "Папка удалена",
    "toast.downloadComplete": "Загрузка завершена",
    "toast.filesUploaded": "Загружен {count} файл",
    "toast.filesUploaded_plural": "Загружено файлов: {count}",
    "toast.openFileError": "Не удалось открыть файл",
    "toast.downloadFileError": "Не удалось скачать файл",
    "toast.settingUpdateError": "Не удалось обновить настройку",
    "toast.backupCreated": "Резервная копия создана",
    "toast.backupError": "Не удалось создать резервную копию",

    // Settings page
    "settings.title": "Настройки",
    "settings.storage": "Хранилище",
    "settings.storageLocation": "Расположение хранилища",
    "settings.openFolder": "Открыть папку",
    "settings.dataUsed": "Занято места",
    "settings.calculating": "Подсчёт...",
    "settings.backup": "Резервное копирование",
    "settings.createBackup": "Создать резервную копию",
    "settings.createBackupDescription": "Объединяет базу данных и файлы в один архив.",
    "settings.createBackupButton": "Создать копию",
    "settings.creating": "Создание...",
    "settings.backupsFolder": "Папка с копиями",
    "settings.appearance": "Оформление",
    "settings.theme.system": "Системная",
    "settings.theme.light": "Светлая",
    "settings.theme.dark": "Тёмная",
    "settings.language": "Язык",
    "settings.language.system": "Системный",
    "settings.language.en": "English",
    "settings.language.ru": "Русский",
    "settings.general": "Общие",
    "settings.launchAtStartup": "Запускать при старте системы",
    "settings.logs": "Журналы",
    "settings.openLogsFolder": "Открыть папку с журналами",
  },
};

/// Best-effort translations for the fixed set of English error messages the
/// Rust backend can return, so ApiError messages read naturally in Russian
/// too without duplicating every backend string as a translation key.
export const backendErrorTranslations: Record<string, string> = {
  "A database error occurred.": "Произошла ошибка базы данных.",
  "Failed to create folder.": "Не удалось создать папку.",
  "Failed to create project.": "Не удалось создать проект.",
  "Failed to rename file.": "Не удалось переименовать файл.",
  "Failed to rename folder.": "Не удалось переименовать папку.",
  "Failed to save the new version.": "Не удалось сохранить новую версию.",
  "Failed to update project.": "Не удалось обновить проект.",
  "File name cannot be empty.": "Имя файла не может быть пустым.",
  "Folder name cannot be empty.": "Имя папки не может быть пустым.",
  "Internal state error.": "Внутренняя ошибка состояния приложения.",
  "Invalid file path.": "Некорректный путь к файлу.",
  "Invalid identifier.": "Некорректный идентификатор.",
  "Invalid language.": "Некорректный язык.",
  "Invalid storage path.": "Некорректный путь хранилища.",
  "Invalid theme.": "Некорректная тема.",
  "Only regular files can be added.": "Можно добавлять только обычные файлы.",
  "Please choose a storage location.": "Пожалуйста, выберите папку для хранения.",
  "Project name cannot be empty.": "Название проекта не может быть пустым.",
  "Storage has not been set up yet.": "Хранилище ещё не настроено.",
  "That version does not belong to this file.": "Эта версия не принадлежит данному файлу.",
  "The chosen folder is not writable.": "В выбранную папку нельзя записывать данные.",
  "The parent folder no longer exists.": "Родительская папка больше не существует.",
  "The referenced file could not be found on disk.": "Файл не найден на диске.",
  "The saved configuration is corrupted.": "Сохранённая конфигурация повреждена.",
  "The selected file could not be found.": "Выбранный файл не найден.",
  "The storage folder is unavailable.": "Папка хранилища недоступна.",
  "This file no longer exists.": "Этот файл больше не существует.",
  "This folder no longer exists.": "Эта папка больше не существует.",
  "This project no longer exists.": "Этот проект больше не существует.",
  "This version no longer exists.": "Эта версия больше не существует.",
  "Unable to create the backup file.": "Не удалось создать файл резервной копии.",
  "Unable to determine a default location.": "Не удалось определить папку по умолчанию.",
  "Unable to finish writing the backup archive.": "Не удалось завершить запись архива резервной копии.",
  "Unable to locate the application config folder.": "Не удалось найти папку конфигурации приложения.",
  "Unable to open the file.": "Не удалось открыть файл.",
  "Unable to open the folder.": "Не удалось открыть папку.",
  "Unable to save configuration.": "Не удалось сохранить конфигурацию.",
  "Unable to save the file.": "Не удалось сохранить файл.",
  "Unable to write to the backup archive.": "Не удалось записать в архив резервной копии.",
  "Unknown folder requested.": "Запрошена неизвестная папка.",
  "Unable to access the storage folder. Check that it is available and try again.":
    "Не удалось получить доступ к папке хранилища. Проверьте, что она доступна, и попробуйте снова.",
  "Unable to create the storage folder. Check that the location is available and try again.":
    "Не удалось создать папку хранилища. Проверьте, что расположение доступно, и попробуйте снова.",
};
