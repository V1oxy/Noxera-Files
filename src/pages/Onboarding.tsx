import { FolderOpen, Layers } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ApiError, defaultStoragePath, initializeStorage, pickStorageFolder } from "@/services/api";
import type { AppSettings } from "@/types";

interface OnboardingProps {
  onComplete: (settings: AppSettings) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<"welcome" | "storage">("welcome");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    defaultStoragePath().then(setPath).catch(() => {});
  }, []);

  async function handleChooseFolder() {
    const chosen = await pickStorageFolder();
    if (chosen) setPath(chosen);
  }

  async function handleContinue() {
    setBusy(true);
    setError(null);
    try {
      const settings = await initializeStorage(path);
      onComplete(settings);
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Unable to set up storage.");
    }
  }

  return (
    <div className="drag-region flex h-screen w-screen items-center justify-center bg-surface-bg">
      <div className="no-drag w-[420px] rounded-apple-lg border border-surface-border bg-surface-content p-8 shadow-modal">
        {step === "welcome" ? (
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-apple-lg bg-accent/10">
              <Layers size={30} className="text-accent" strokeWidth={1.5} />
            </div>
            <h1 className="text-[20px] font-semibold text-label-primary">Project Manager</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-label-secondary">
              All your projects and files, in one place.
            </p>
            <Button variant="primary" className="mt-7 w-full" onClick={() => setStep("storage")}>
              Get Started
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="text-[16px] font-semibold text-label-primary">Where should we store your data?</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-label-secondary">
              Everything stays on this computer. You can change this later in Settings.
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-apple-sm border border-surface-border bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.05]">
              <FolderOpen size={15} className="shrink-0 text-label-secondary" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-label-primary">{path}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleChooseFolder} disabled={busy}>
                Choose Folder
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => defaultStoragePath().then(setPath)}
                disabled={busy}
              >
                Use Default
              </Button>
            </div>

            {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}

            <Button variant="primary" className="mt-5 w-full" onClick={handleContinue} disabled={busy || !path}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
