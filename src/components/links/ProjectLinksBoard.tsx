import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { DeleteModal } from "@/components/DeleteModal";
import { LinkCard, LinkCardOverlay } from "@/components/links/LinkCard";
import { NewGroupModal } from "@/components/links/NewGroupModal";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/useToast";
import {
  ApiError,
  createLinkGroup,
  deleteLink,
  deleteLinkGroup,
  moveLink,
  reorderLinkGroups,
  updateLinkGroup,
} from "@/services/api";
import type { Link, LinkGroup } from "@/types";

const UNGROUPED = "__ungrouped__";

type Columns = Record<string, Link[]>;

function groupLinks(groups: LinkGroup[], links: Link[]): Columns {
  const columns: Columns = { [UNGROUPED]: [] };
  for (const g of groups) columns[g.id] = [];
  for (const link of links) {
    const key = link.groupId ?? UNGROUPED;
    (columns[key] ??= []).push(link);
  }
  return columns;
}

interface ProjectLinksBoardProps {
  projectId: string;
  projectName: string;
  showProjectHeader: boolean;
  links: Link[];
  groups: LinkGroup[];
  showProjectOnCard: boolean;
  onOpenLink: (link: Link) => void;
  onEditLink: (link: Link) => void;
  onChanged: () => void;
}

export function ProjectLinksBoard({
  projectId,
  projectName,
  showProjectHeader,
  links,
  groups,
  showProjectOnCard,
  onOpenLink,
  onEditLink,
  onChanged,
}: ProjectLinksBoardProps) {
  const { t, translateError } = useLanguage();
  const { showToast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [columns, setColumns] = useState<Columns>(() => groupLinks(groups, links));
  const [activeLink, setActiveLink] = useState<Link | null>(null);
  const [overContainerId, setOverContainerId] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LinkGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Link | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<LinkGroup | null>(null);

  useEffect(() => {
    if (!activeLink) setColumns(groupLinks(groups, links));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, links]);

  function findContainer(id: string): string | undefined {
    if (columns[id]) return id;
    return Object.keys(columns).find((key) => columns[key].some((l) => l.id === id));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const container = findContainer(id);
    const link = container ? columns[container].find((l) => l.id === id) : undefined;
    setActiveLink(link ?? null);
    setOverContainerId(container ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      setOverContainerId(null);
      return;
    }
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);
    setOverContainerId(overContainer ?? null);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((l) => l.id === active.id);
      if (activeIndex === -1) return prev;
      const overIndex = overItems.findIndex((l) => l.id === over.id);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;
      const moved = activeItems[activeIndex];
      return {
        ...prev,
        [activeContainer]: activeItems.filter((l) => l.id !== active.id),
        [overContainer]: [...overItems.slice(0, newIndex), moved, ...overItems.slice(newIndex)],
      };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLink(null);
    setOverContainerId(null);
    if (!over) {
      setColumns(groupLinks(groups, links));
      return;
    }
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string) ?? activeContainer;
    if (!activeContainer || !overContainer) return;

    let finalColumn = columns[overContainer];
    if (activeContainer === overContainer) {
      const activeIndex = finalColumn.findIndex((l) => l.id === active.id);
      const overIndex = finalColumn.findIndex((l) => l.id === over.id);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        finalColumn = arrayMove(finalColumn, activeIndex, overIndex);
        setColumns((prev) => ({ ...prev, [overContainer]: finalColumn }));
      }
    }

    try {
      await moveLink(
        active.id as string,
        overContainer === UNGROUPED ? null : overContainer,
        finalColumn.map((l) => l.id),
      );
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
      setColumns(groupLinks(groups, links));
      onChanged();
    }
  }

  function handleDragCancel() {
    setActiveLink(null);
    setOverContainerId(null);
    setColumns(groupLinks(groups, links));
  }

  async function handleCreateGroup(name: string) {
    await createLinkGroup(projectId, { name });
    setNewGroupOpen(false);
    onChanged();
  }

  async function handleRenameGroup(name: string) {
    if (!renameTarget) return;
    await updateLinkGroup(renameTarget.id, { name });
    setRenameTarget(null);
    onChanged();
  }

  async function handleDeleteGroup() {
    if (!deleteGroupTarget) return;
    await deleteLinkGroup(deleteGroupTarget.id);
    setDeleteGroupTarget(null);
    onChanged();
  }

  async function handleDeleteLink() {
    if (!deleteTarget) return;
    await deleteLink(deleteTarget.id);
    setDeleteTarget(null);
    onChanged();
  }

  async function handleMoveGroup(groupId: string, direction: -1 | 1) {
    const index = groups.findIndex((g) => g.id === groupId);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= groups.length) return;
    const next = arrayMove(groups, index, swapWith);
    try {
      await reorderLinkGroups(next.map((g) => g.id));
      onChanged();
    } catch (e) {
      showToast({ title: t("common.actionErrorFallback"), description: e instanceof ApiError ? translateError(e.message) : undefined, variant: "error" });
    }
  }

  const sections: { key: string; group: LinkGroup | null }[] = [
    ...groups.map((g) => ({ key: g.id, group: g })),
    ...(groups.length > 0 || columns[UNGROUPED]?.length > 0 ? [{ key: UNGROUPED, group: null }] : []),
  ];

  return (
    <div>
      {showProjectHeader && (
        <h2 className="mb-2 text-[13px] font-semibold text-label-primary">{projectName}</h2>
      )}
      {sections.length === 0 ? (
        <div className="rounded-apple-lg border border-dashed border-surface-border px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-label-primary">{t("links.emptyProjectTitle")}</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-label-secondary">{t("links.emptyProjectDescription")}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          autoScroll={{ acceleration: 12, threshold: { x: 0.15, y: 0.2 } }}
        >
          <div className="space-y-4">
            {sections.map(({ key, group }, index) => (
              <GroupSection
                key={key}
                id={key}
                title={group ? group.name : t("links.noGroup")}
                links={columns[key] ?? []}
                isDropTarget={overContainerId === key && activeLink !== null}
                showProjectOnCard={showProjectOnCard}
                onOpenLink={onOpenLink}
                onEditLink={onEditLink}
                onDeleteLink={setDeleteTarget}
                onRenameGroup={group ? () => setRenameTarget(group) : undefined}
                onDeleteGroup={group ? () => setDeleteGroupTarget(group) : undefined}
                onMoveUp={group && index > 0 ? () => handleMoveGroup(group.id, -1) : undefined}
                onMoveDown={group && index < groups.length - 1 ? () => handleMoveGroup(group.id, 1) : undefined}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
            {activeLink && <LinkCardOverlay link={activeLink} showProject={showProjectOnCard} />}
          </DragOverlay>
        </DndContext>
      )}

      <button
        onClick={() => setNewGroupOpen(true)}
        className="mt-3 flex items-center gap-1.5 rounded-apple-sm px-2 py-1.5 text-[12px] text-label-secondary transition-colors hover:bg-black/[0.04] hover:text-label-primary dark:hover:bg-white/[0.06]"
      >
        <Plus size={13} />
        {t("links.newGroup")}
      </button>

      <NewGroupModal open={newGroupOpen} onCancel={() => setNewGroupOpen(false)} onConfirm={handleCreateGroup} />
      <NewGroupModal
        open={renameTarget !== null}
        initialName={renameTarget?.name}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRenameGroup}
      />
      <DeleteModal
        open={deleteGroupTarget !== null}
        title={t("links.deleteGroupTitle")}
        message={t("links.deleteGroupMessage")}
        onCancel={() => setDeleteGroupTarget(null)}
        onConfirm={handleDeleteGroup}
      />
      <DeleteModal
        open={deleteTarget !== null}
        title={t("links.deleteLinkTitle")}
        message={t("links.deleteLinkMessage")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteLink}
      />
    </div>
  );
}

function GroupSection({
  id,
  title,
  links,
  isDropTarget,
  showProjectOnCard,
  onOpenLink,
  onEditLink,
  onDeleteLink,
  onRenameGroup,
  onDeleteGroup,
  onMoveUp,
  onMoveDown,
}: {
  id: string;
  title: string;
  links: Link[];
  isDropTarget: boolean;
  showProjectOnCard: boolean;
  onOpenLink: (link: Link) => void;
  onEditLink: (link: Link) => void;
  onDeleteLink: (link: Link) => void;
  onRenameGroup?: () => void;
  onDeleteGroup?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useLanguage();
  const { setNodeRef } = useDroppable({ id });
  const reorderable = onMoveUp !== undefined || onMoveDown !== undefined;

  return (
    <div className="group/section">
      <div className="mb-1.5 flex h-6 items-center gap-1.5 px-1">
        <h3 className="min-w-0 truncate text-[11.5px] font-semibold uppercase tracking-wide text-label-tertiary">{title}</h3>
        <span className="shrink-0 rounded-full bg-black/[0.06] px-1.5 py-px text-[10px] font-medium tabular-nums text-label-tertiary dark:bg-white/[0.08]">
          {links.length}
        </span>
        {reorderable && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/section:opacity-100">
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="rounded-apple-sm p-0.5 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/[0.1]"
            >
              <ChevronUp size={11} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="rounded-apple-sm p-0.5 text-label-tertiary hover:bg-black/[0.06] hover:text-label-primary disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/[0.1]"
            >
              <ChevronDown size={11} />
            </button>
          </div>
        )}
        {onRenameGroup && (
          <button onClick={onRenameGroup} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-label-primary group-hover/section:opacity-100 dark:hover:bg-white/[0.1]">
            <Pencil size={11} />
          </button>
        )}
        {onDeleteGroup && (
          <button onClick={onDeleteGroup} className="shrink-0 rounded-apple-sm p-0.5 text-label-tertiary opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover/section:opacity-100">
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`grid min-h-[56px] grid-cols-1 gap-2 rounded-apple-lg border p-2 transition-colors duration-150 sm:grid-cols-2 lg:grid-cols-3 ${
          isDropTarget ? "border-accent/50 bg-accent/[0.05]" : "border-transparent bg-black/[0.015] dark:bg-white/[0.02]"
        }`}
      >
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {links.map((link) => (
            <LinkCard key={link.id} link={link} showProject={showProjectOnCard} onOpen={onOpenLink} onEdit={onEditLink} onDelete={onDeleteLink} />
          ))}
        </SortableContext>
        {links.length === 0 && <p className="col-span-full px-2 py-3 text-center text-[11.5px] text-label-tertiary">{t("links.emptyGroup")}</p>}
      </div>
    </div>
  );
}
