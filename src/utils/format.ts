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

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(locale: string): Intl.DateTimeFormat {
  const key = `time:${locale}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }));
  }
  return formatterCache.get(key)!;
}

function dateFormatter(locale: string): Intl.DateTimeFormat {
  const key = `date:${locale}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }),
    );
  }
  return formatterCache.get(key)!;
}

/** "Today, 09:32" / "Yesterday, 18:21" / "September 1, 2026", localized. */
export function formatModified(iso: string, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return `${todayLabel}, ${timeFormatter(locale).format(date)}`;
  }
  if (isSameDay(date, yesterday)) {
    return `${yesterdayLabel}, ${timeFormatter(locale).format(date)}`;
  }
  return dateFormatter(locale).format(date);
}

/** "September 4, 2026 · 09:32", localized. */
export function formatFullDateTime(iso: string, locale: string): string {
  const date = new Date(iso);
  return `${dateFormatter(locale).format(date)} · ${timeFormatter(locale).format(date)}`;
}
