import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, children, width = 420 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in rounded-apple-lg border border-surface-border bg-surface-modal shadow-modal backdrop-blur-apple"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 pt-5">
      <h2 className="text-[15px] font-semibold text-label-primary">{title}</h2>
      {subtitle && <p className="mt-1 text-[12.5px] leading-relaxed text-label-secondary">{subtitle}</p>}
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-3.5">
      {children}
    </div>
  );
}
