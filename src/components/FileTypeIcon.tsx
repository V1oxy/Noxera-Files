import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";

const spreadsheet = new Set(["xls", "xlsx", "csv", "numbers"]);
const presentation = new Set(["ppt", "pptx", "key"]);
const document = new Set(["doc", "docx", "pdf", "txt", "md", "rtf", "pages"]);
const image = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "psd", "ai", "fig", "heic"]);
const audio = new Set(["mp3", "wav", "flac", "aac", "m4a"]);
const video = new Set(["mp4", "mov", "avi", "mkv", "webm"]);
const archive = new Set(["zip", "rar", "7z", "tar", "gz", "iso"]);
const code = new Set(["json", "xml", "js", "ts", "tsx", "jsx", "html", "css", "py", "rs", "go", "java", "c", "cpp"]);

export function FileTypeIcon({ filename, size = 20 }: { filename: string; size?: number }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  let Icon = File;
  if (spreadsheet.has(ext)) Icon = FileSpreadsheet;
  else if (presentation.has(ext)) Icon = Presentation;
  else if (document.has(ext)) Icon = FileText;
  else if (image.has(ext)) Icon = FileImage;
  else if (audio.has(ext)) Icon = FileAudio;
  else if (video.has(ext)) Icon = FileVideo;
  else if (archive.has(ext)) Icon = FileArchive;
  else if (code.has(ext)) Icon = FileCode;

  return <Icon size={size} strokeWidth={1.5} className="text-label-secondary" />;
}
