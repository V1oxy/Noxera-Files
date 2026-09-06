/** Sentinel `activeTab`/`linksTab` value meaning "every link project" - the
 * literal is shared (rather than duplicated per file) since App.tsx,
 * LinksView, and Sidebar all need to agree on it. */
export const LINKS_ALL_TAB = "__all__";
