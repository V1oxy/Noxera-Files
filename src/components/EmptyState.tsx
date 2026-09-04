import { FileStack, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = FileStack, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex h-full flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
        <Icon size={26} strokeWidth={1.5} className="text-label-tertiary" />
      </div>
      <h3 className="text-[14px] font-semibold text-label-primary">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-label-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
