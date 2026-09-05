import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

import { getSettings, updateSettings } from "@/services/api";
import { parseReleaseNotes, type WhatsNewSection } from "@/utils/whatsNew";

export interface WhatsNewData {
  version: string;
  sections: WhatsNewSection[];
}

/**
 * Detects "this launch follows an update" by comparing the running app
 * version against the last version this popup was resolved for (persisted
 * setting, survives relaunch). Release notes come from whatever
 * useUpdater cached right after the in-app update installed - never a
 * network call of its own, so a stale/offline GitHub API can't block
 * startup or leave the popup half-broken; no cached notes just means no
 * popup, per version, ever again.
 */
export function useWhatsNew() {
  const [data, setData] = useState<WhatsNewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [currentVersion, settings] = await Promise.all([getVersion(), getSettings()]);
        if (cancelled) return;

        const lastSeen = settings.lastWhatsNewVersion;
        if (!lastSeen) {
          // Nothing recorded yet - could be a fresh install or an upgrade
          // from before this feature existed. Either way there's no
          // reliable "previous version" to react to, so just establish a
          // baseline instead of guessing.
          await updateSettings({ lastWhatsNewVersion: currentVersion });
          return;
        }
        if (lastSeen === currentVersion) return;

        const hasPending =
          settings.pendingWhatsNewVersion === currentVersion && !!settings.pendingWhatsNewNotes;
        const sections = hasPending ? parseReleaseNotes(settings.pendingWhatsNewNotes!) : [];

        await updateSettings({
          lastWhatsNewVersion: currentVersion,
          pendingWhatsNewVersion: "",
          pendingWhatsNewNotes: "",
        });

        if (!cancelled && sections.length > 0) {
          setData({ version: currentVersion, sections });
        }
      } catch {
        // Never let this block or break startup - just skip the popup.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, dismiss: () => setData(null) };
}
