import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { NewGroupModal } from "@/components/links/NewGroupModal";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import { useLinkGroups } from "@/hooks/useLinks";
import { ApiError, createLink, createLinkGroup, updateLink } from "@/services/api";
import type { Link, Project } from "@/types";

const CREATE_NEW_GROUP = "__create_new__";

interface NewLinkModalProps {
  open: boolean;
  projects: Project[];
  defaultProjectId?: string | null;
  link?: Link | null;
  onCancel: () => void;
  onSaved: (link: Link) => void;
}

export function NewLinkModal({ open, projects, defaultProjectId, link, onCancel, onSaved }: NewLinkModalProps) {
  const { t, translateError } = useLanguage();
  const [projectId, setProjectId] = useState("");
  const { groups, refresh: refreshGroups } = useLinkGroups(projectId || null);
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId(link?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "");
    setGroupId(link?.groupId ?? "");
    setTitle(link?.title ?? "");
    setUrl(link?.url ?? "");
    setDescription(link?.description ?? "");
    setError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, link]);

  async function handleConfirm() {
    if (!title.trim()) {
      setError(t("links.titleRequired"));
      return;
    }
    if (!url.trim()) {
      setError(t("links.urlRequired"));
      return;
    }
    if (!projectId) {
      setError(t("links.projectRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = link
        ? await updateLink(link.id, {
            title: title.trim(),
            url: url.trim(),
            description: description.trim() || null,
            groupId: groupId || null,
          })
        : await createLink({
            projectId,
            groupId: groupId || undefined,
            title: title.trim(),
            url: url.trim(),
            description: description.trim() || undefined,
          });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? translateError(e.message) : t("links.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup(name: string) {
    const group = await createLinkGroup(projectId, { name });
    setNewGroupOpen(false);
    await refreshGroups();
    setGroupId(group.id);
  }

  const inputClass =
    "mt-1 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]";
  const labelClass = "text-[11px] font-medium uppercase tracking-wide text-label-tertiary";

  return (
    <>
      <Modal open={open} onClose={onCancel} width={460}>
      <ModalHeader title={link ? t("links.editLink") : t("links.addLink")} />
      <ModalBody>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>{t("links.fieldUrl")}</label>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("links.fieldTitle")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t("links.fieldDescription")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              rows={2}
              className="mt-1 w-full resize-none rounded-apple-sm border border-surface-border bg-black/[0.03] p-2 text-[13px] text-label-primary outline-none focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("links.fieldProject")}</label>
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setGroupId(""); }}
                disabled={busy || !!link}
                className={inputClass}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("links.fieldGroup")}</label>
              <select
                value={groupId}
                onChange={(e) => {
                  if (e.target.value === CREATE_NEW_GROUP) {
                    setNewGroupOpen(true);
                    return;
                  }
                  setGroupId(e.target.value);
                }}
                disabled={busy || !projectId}
                className={inputClass}
              >
                <option value="">{t("links.noGroup")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value={CREATE_NEW_GROUP}>+ {t("links.newGroup")}</option>
              </select>
            </div>
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {link ? t("common.save") : t("common.create")}
        </Button>
      </ModalFooter>
    </Modal>
    <NewGroupModal open={newGroupOpen} onCancel={() => setNewGroupOpen(false)} onConfirm={handleCreateGroup} />
    </>
  );
}
