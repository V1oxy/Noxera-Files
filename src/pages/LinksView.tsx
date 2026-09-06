import { Link2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { NewLinkModal } from "@/components/links/NewLinkModal";
import { ProjectLinksBoard } from "@/components/links/ProjectLinksBoard";
import { useLanguage } from "@/hooks/useLanguage";
import { useAllLinkGroups, useLinks } from "@/hooks/useLinks";
import { useToast } from "@/hooks/useToast";
import { ApiError, openLink } from "@/services/api";
import type { Link as LinkType, Project } from "@/types";

const ALL = "__all__";

interface LinksViewProps {
  projects: Project[];
}

export function LinksView({ projects }: LinksViewProps) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(ALL);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkType | null>(null);

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      projectId: activeTab === ALL ? undefined : activeTab,
    }),
    [search, activeTab],
  );

  const { links, refresh: refreshLinks } = useLinks(filter);
  const { groups: allGroups, refresh: refreshAllGroups } = useAllLinkGroups();

  function refreshAll() {
    void refreshLinks();
    void refreshAllGroups();
  }

  async function handleOpen(link: LinkType) {
    try {
      await openLink(link.url);
    } catch (e) {
      showToast({
        title: t("links.openError"),
        description: e instanceof ApiError ? translateError(e.message) : undefined,
        variant: "error",
      });
    }
  }

  function handleEdit(link: LinkType) {
    setEditingLink(link);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingLink(null);
    setModalOpen(true);
  }

  const isSearching = search.trim().length > 0;
  const candidateProjects = activeTab === ALL ? projects : projects.filter((p) => p.id === activeTab);
  const visibleProjects = candidateProjects.filter((p) => {
    if (links.some((l) => l.projectId === p.id)) return true;
    if (isSearching) return false;
    if (activeTab === p.id) return true;
    return allGroups.some((g) => g.projectId === p.id);
  });

  const nothingAtAll = projects.length === 0 || (!isSearching && links.length === 0 && allGroups.length === 0);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="drag-region flex shrink-0 items-center justify-between gap-3 px-6 pb-2 pt-10">
        <h1 className="text-[20px] font-semibold text-label-primary">{t("sidebar.links")}</h1>
        <div className="no-drag">
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={projects.length === 0}>
            <Plus size={13} />
            {t("links.addLink")}
          </Button>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="no-drag flex shrink-0 flex-wrap items-center gap-2 px-6 pb-3">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("links.searchPlaceholder")}
              className="h-8 w-56 rounded-apple-sm border border-surface-border bg-black/[0.03] pl-7 pr-2.5 text-[13px] text-label-primary outline-none placeholder:text-label-tertiary focus:border-accent/50 dark:bg-white/[0.05]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab(ALL)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === ALL
                  ? "bg-accent/[0.14] text-accent"
                  : "text-label-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              {t("links.tabAll")}
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`max-w-[160px] truncate rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  activeTab === p.id
                    ? "bg-accent/[0.14] text-accent"
                    : "text-label-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {nothingAtAll ? (
          <EmptyState
            icon={Link2}
            title={t("links.emptyAllTitle")}
            description={t("links.emptyAllDescription")}
            action={
              projects.length > 0 ? (
                <Button variant="primary" onClick={handleAdd}>
                  <Plus size={13} />
                  {t("links.addLink")}
                </Button>
              ) : undefined
            }
          />
        ) : visibleProjects.length === 0 ? (
          <EmptyState
            icon={isSearching ? Search : Link2}
            title={isSearching ? t("links.searchEmptyTitle") : t("links.emptyProjectTitle")}
            description={isSearching ? t("links.searchEmptyDescription") : t("links.emptyProjectDescription")}
            action={
              !isSearching ? (
                <Button variant="primary" onClick={handleAdd}>
                  <Plus size={13} />
                  {t("links.addLink")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-6 pt-2">
            {visibleProjects.map((p) => (
              <ProjectLinksBoard
                key={p.id}
                projectId={p.id}
                projectName={p.name}
                showProjectHeader={activeTab === ALL}
                links={links.filter((l) => l.projectId === p.id)}
                groups={allGroups.filter((g) => g.projectId === p.id)}
                showProjectOnCard={activeTab === ALL}
                onOpenLink={handleOpen}
                onEditLink={handleEdit}
                onChanged={refreshAll}
              />
            ))}
          </div>
        )}
      </div>

      <NewLinkModal
        open={modalOpen}
        projects={projects}
        defaultProjectId={activeTab === ALL ? null : activeTab}
        link={editingLink}
        onCancel={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          refreshAll();
        }}
      />
    </div>
  );
}
