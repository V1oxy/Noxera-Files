import { FolderPlus, Link2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { ContextMenu } from "@/components/ContextMenu";
import { DeleteModal } from "@/components/DeleteModal";
import { EmptyState } from "@/components/EmptyState";
import { NameModal } from "@/components/links/NameModal";
import { NewLinkModal } from "@/components/links/NewLinkModal";
import { ProjectLinksBoard } from "@/components/links/ProjectLinksBoard";
import { LINKS_ALL_TAB as ALL } from "@/constants/links";
import { useLanguage } from "@/hooks/useLanguage";
import { useAllLinkGroups, useLinks } from "@/hooks/useLinks";
import { useToast } from "@/hooks/useToast";
import { ApiError, createLinkProject, deleteLinkProject, openLink, updateLinkProject } from "@/services/api";
import type { Link as LinkType, LinkProject } from "@/types";

interface LinksViewProps {
  projects: LinkProject[];
  onProjectsChanged: () => void;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
}

export function LinksView({ projects, onProjectsChanged, activeTab, onActiveTabChange }: LinksViewProps) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkType | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [renameProjectTarget, setRenameProjectTarget] = useState<LinkProject | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<LinkProject | null>(null);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; project: LinkProject } | null>(null);

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

  async function handleCreateProject(name: string) {
    const project = await createLinkProject({ name });
    setNewProjectOpen(false);
    onProjectsChanged();
    onActiveTabChange(project.id);
  }

  async function handleRenameProject(name: string) {
    if (!renameProjectTarget) return;
    await updateLinkProject(renameProjectTarget.id, { name });
    setRenameProjectTarget(null);
    onProjectsChanged();
  }

  async function handleDeleteProject() {
    if (!deleteProjectTarget) return;
    await deleteLinkProject(deleteProjectTarget.id);
    if (activeTab === deleteProjectTarget.id) onActiveTabChange(ALL);
    setDeleteProjectTarget(null);
    onProjectsChanged();
    refreshAll();
  }

  const isSearching = search.trim().length > 0;
  const candidateProjects = activeTab === ALL ? projects : projects.filter((p) => p.id === activeTab);
  const visibleProjects = candidateProjects.filter((p) => {
    if (links.some((l) => l.projectId === p.id)) return true;
    if (isSearching) return false;
    if (activeTab === p.id) return true;
    return allGroups.some((g) => g.projectId === p.id);
  });

  const nothingAtAll = projects.length === 0;
  const noLinksYet = !isSearching && links.length === 0 && allGroups.length === 0;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="drag-region flex shrink-0 items-center justify-between gap-3 px-6 pb-2 pt-10">
        <h1 className="text-[20px] font-semibold text-label-primary">{t("sidebar.links")}</h1>
        <div className="no-drag">
          <Button variant="primary" size="sm" onClick={handleAdd}>
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
              onClick={() => onActiveTabChange(ALL)}
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
                onClick={() => onActiveTabChange(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabMenu({ x: e.clientX, y: e.clientY, project: p });
                }}
                title={t("links.tabContextHint")}
                className={`max-w-[160px] truncate rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  activeTab === p.id
                    ? "bg-accent/[0.14] text-accent"
                    : "text-label-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => setNewProjectOpen(true)}
              title={t("links.newProject")}
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-label-tertiary transition-colors hover:bg-black/[0.04] hover:text-label-primary dark:hover:bg-white/[0.06]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {tabMenu && (
        <ContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          onClose={() => setTabMenu(null)}
          items={[
            { label: t("menu.rename"), icon: Pencil, onClick: () => setRenameProjectTarget(tabMenu.project) },
            { label: t("menu.delete"), icon: Trash2, onClick: () => setDeleteProjectTarget(tabMenu.project), danger: true, dividerBefore: true },
          ]}
        />
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {nothingAtAll ? (
          <EmptyState
            icon={FolderPlus}
            title={t("links.noProjectsTitle")}
            description={t("links.noProjectsDescription")}
            action={
              <Button variant="primary" onClick={() => setNewProjectOpen(true)}>
                <Plus size={13} />
                {t("links.newProject")}
              </Button>
            }
          />
        ) : noLinksYet && activeTab === ALL ? (
          <EmptyState
            icon={Link2}
            title={t("links.emptyAllTitle")}
            description={t("links.emptyAllDescription")}
            action={
              <Button variant="primary" onClick={handleAdd}>
                <Plus size={13} />
                {t("links.addLink")}
              </Button>
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
        onProjectCreated={() => onProjectsChanged()}
      />

      <NameModal
        open={newProjectOpen}
        createTitle={t("links.newProject")}
        renameTitle={t("links.renameProject")}
        label={t("links.projectName")}
        placeholder={t("links.projectNamePlaceholder")}
        onCancel={() => setNewProjectOpen(false)}
        onConfirm={handleCreateProject}
      />
      <NameModal
        open={renameProjectTarget !== null}
        createTitle={t("links.newProject")}
        renameTitle={t("links.renameProject")}
        label={t("links.projectName")}
        placeholder={t("links.projectNamePlaceholder")}
        initialName={renameProjectTarget?.name}
        onCancel={() => setRenameProjectTarget(null)}
        onConfirm={handleRenameProject}
      />
      <DeleteModal
        open={deleteProjectTarget !== null}
        title={t("links.deleteProjectTitle")}
        message={t("links.deleteProjectMessage")}
        confirmValue={deleteProjectTarget?.name}
        onCancel={() => setDeleteProjectTarget(null)}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
