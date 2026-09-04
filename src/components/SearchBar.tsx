import { Search, X } from "lucide-react";
import { forwardRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, placeholder = "Search files..." }, ref) => (
    <div className="no-drag relative flex items-center">
      <Search size={14} className="pointer-events-none absolute left-2.5 text-label-tertiary" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-apple-sm border border-surface-border bg-black/[0.03] pl-8 pr-7 text-[13px] text-label-primary placeholder:text-label-tertiary outline-none transition-colors focus:border-accent/50 focus:bg-surface-content dark:bg-white/[0.05]"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 rounded-full p-0.5 text-label-tertiary hover:text-label-primary"
        >
          <X size={13} />
        </button>
      )}
    </div>
  ),
);
SearchBar.displayName = "SearchBar";
