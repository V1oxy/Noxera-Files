import { useState } from "react";

import { useLanguage } from "@/hooks/useLanguage";

interface ExpandableTextProps {
  text: string;
  className?: string;
  /** Must be a literal Tailwind line-clamp class (e.g. "line-clamp-2") so the JIT compiler picks it up. */
  clampClassName?: string;
}

/** Text that stays clamped to a few lines until the reader asks to see the rest. */
export function ExpandableText({ text, className = "", clampClassName = "line-clamp-3" }: ExpandableTextProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 140;

  return (
    <div className={className}>
      <p className={!expanded && isLong ? clampClassName : undefined}>{text}</p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="no-drag mt-0.5 text-[11px] font-medium text-accent hover:underline"
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}
