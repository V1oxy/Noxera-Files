export type WhatsNewSectionKey = "added" | "fixed" | "improved";

export interface WhatsNewSection {
  key: WhatsNewSectionKey;
  items: string[];
}

const SECTION_KEYS: Record<string, WhatsNewSectionKey> = {
  added: "added",
  fixed: "fixed",
  improved: "improved",
};

/**
 * Reads back the exact heading structure scripts/generate-release-notes.mjs
 * writes into the GitHub Release body (and from there, latest.json's
 * "notes" field the updater already downloads) - "### Added" / "### Fixed" /
 * "### Improved" headings followed by "- " bullet items. Any other markdown
 * a release body might contain is ignored rather than misparsed.
 */
export function parseReleaseNotes(notes: string): WhatsNewSection[] {
  const sections: WhatsNewSection[] = [];
  let current: WhatsNewSection | null = null;

  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const key = SECTION_KEYS[heading[1].trim().toLowerCase()];
      current = key ? { key, items: [] } : null;
      if (current) sections.push(current);
      continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item && current) current.items.push(item[1].trim());
  }

  return sections.filter((s) => s.items.length > 0);
}
