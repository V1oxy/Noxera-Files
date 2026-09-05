import { Button } from "@/components/Button";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import type { Project } from "@/types";

interface ProjectDescriptionModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

/** Full project description on demand - the header itself no longer shows it inline, so toolbar spacing below never depends on whether one is set. */
export function ProjectDescriptionModal({ open, project, onClose }: ProjectDescriptionModalProps) {
  const { t } = useLanguage();

  return (
    <Modal open={open} onClose={onClose} width={400}>
      <ModalHeader title={project?.name ?? ""} />
      <ModalBody>
        <ExpandableDescription
          text={project?.description}
          textClassName="text-[13px] leading-relaxed text-label-primary"
          collapsedLines={6}
          expandedMaxHeight={280}
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
