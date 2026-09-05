import { Button } from "@/components/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { useLanguage } from "@/hooks/useLanguage";
import type { WhatsNewData } from "@/hooks/useWhatsNew";
import type { WhatsNewSectionKey } from "@/utils/whatsNew";

const SECTION_LABEL_KEYS: Record<WhatsNewSectionKey, string> = {
  added: "appWhatsNew.added",
  fixed: "appWhatsNew.fixed",
  improved: "appWhatsNew.improved",
};

interface WhatsNewModalProps {
  data: WhatsNewData | null;
  onClose: () => void;
}

/** Shown once per version, right after the app first launches on it - see useWhatsNew. */
export function WhatsNewModal({ data, onClose }: WhatsNewModalProps) {
  const { t } = useLanguage();

  return (
    <Modal open={data !== null} onClose={onClose} width={400}>
      <ModalHeader title={t("appWhatsNew.title", { app: t("onboarding.appName") })} subtitle={data ? `v${data.version}` : undefined} />
      <ModalBody>
        <div className="space-y-4">
          {data?.sections.map((section) => (
            <div key={section.key}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
                {t(SECTION_LABEL_KEYS[section.key])}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-label-primary">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t("appWhatsNew.gotIt")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
