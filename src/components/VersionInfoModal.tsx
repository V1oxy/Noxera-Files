import { Button } from "@/components/Button";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import type { FileEntry } from "@/types";
import { formatFullDateTime } from "@/utils/format";

interface VersionInfoModalProps {
  open: boolean;
  file: FileEntry | null;
  onClose: () => void;
}

/** Quick "what changed" popup for a file's current version, without opening the full Version History list. */
export function VersionInfoModal({ open, file, onClose }: VersionInfoModalProps) {
  const { t, locale } = useLanguage();
  const version = file?.currentVersion ?? null;

  return (
    <Modal open={open} onClose={onClose} width={400}>
      <ModalHeader
        title={t("whatsNew.title", { version: version?.versionNumber ?? "" })}
        subtitle={version ? formatFullDateTime(version.createdAt, locale) : undefined}
      />
      <ModalBody>
        <ExpandableDescription
          text={version?.description}
          textClassName="text-[13px] leading-relaxed text-label-primary"
          collapsedLines={6}
          expandedMaxHeight={280}
          emptyPlaceholder={t("whatsNew.empty")}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
