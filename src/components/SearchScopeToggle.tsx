import { Check, ChevronDown, FolderSearch, SearchCheck } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "@/hooks/useLanguage";

export type SearchScope = "project" | "global";

interface SearchScopeToggleProps {
  scope: SearchScope;
  onChange: (scope: SearchScope) => void;
}

const OPTIONS: { value: SearchScope; icon: typeof FolderSearch }[] = [
  { value: "project", icon: FolderSearch },
  { value: "global", icon: SearchCheck },
];

/**
 * Compact dropdown next to the search bar - mirrors FileList's own sort
 * menu (button + chevron, absolute panel, animate-scale-in) so it reads as
 * part of the same toolbar rather than a bolted-on new control.
 */
export function SearchScopeToggle({ scope, onChange }: SearchScopeToggleProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const active = OPTIONS.find((o) => o.value === scope) ?? OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="no-drag flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 text-[12.5px] text-label-primary hover:bg-black/[0.05] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
      >
        <ActiveIcon size={13} />
        <span className="whitespace-nowrap">{t(`search.scope.${scope}`)}</span>
        <ChevronDown size={13} className="shrink-0 text-label-tertiary" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="animate-scale-in absolute left-0 top-9 z-40 w-52 rounded-apple border border-surface-border bg-surface-modal p-1 shadow-popover backdrop-blur-apple">
            {OPTIONS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-apple-sm px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-accent hover:text-white ${
                  value === scope ? "text-accent" : "text-label-primary"
                }`}
              >
                <Icon size={13} className="shrink-0" />
                <span className="flex-1">{t(`search.scope.${value}`)}</span>
                {value === scope && <Check size={13} className="shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
