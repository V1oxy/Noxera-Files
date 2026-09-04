import { CheckCircle2, X, XCircle } from "lucide-react";

import { useToast } from "@/hooks/useToast";

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto animate-slide-up flex w-80 items-start gap-2.5 rounded-apple border border-surface-border bg-surface-modal p-3 shadow-popover backdrop-blur-apple"
        >
          {t.variant === "error" ? (
            <XCircle size={17} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-accent" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-label-primary">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-[12px] text-label-secondary">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="no-drag shrink-0 rounded-full p-0.5 text-label-tertiary hover:text-label-primary"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
