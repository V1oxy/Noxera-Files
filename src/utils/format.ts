export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** "Modified today, 09:32" / "Modified yesterday, 18:21" / "September 1, 2026" */
export function formatModified(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return `Today, ${timeFormatter.format(date)}`;
  }
  if (isSameDay(date, yesterday)) {
    return `Yesterday, ${timeFormatter.format(date)}`;
  }
  return dateFormatter.format(date);
}

/** "September 4, 2026 · 09:32" */
export function formatFullDateTime(iso: string): string {
  const date = new Date(iso);
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}`;
}
