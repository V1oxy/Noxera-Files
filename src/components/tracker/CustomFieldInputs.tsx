import { Select } from "@/components/Select";
import type { TrackerField } from "@/types";

export const fieldInputClass =
  "w-full rounded-apple-sm border border-surface-border bg-black/[0.03] px-2.5 h-8 text-[13px] text-label-primary outline-none transition-colors focus:border-accent/50 focus:bg-surface-content disabled:opacity-50 dark:bg-white/[0.05]";
export const fieldLabelClass = "block text-[10.5px] font-medium uppercase tracking-wide text-label-tertiary";

function inputTypeFor(fieldType: TrackerField["fieldType"]): string {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "url":
      return "url";
    default:
      return "text";
  }
}

interface CustomFieldInputsProps {
  fields: TrackerField[];
  values: Map<string, string | null>;
  /** Fires on every keystroke/toggle - keep the caller's displayed value in
   * sync (a controlled value, never lost to a missed blur). */
  onChange: (fieldId: string, value: string) => void;
  /** Fires when a value should be considered final and persisted -
   * immediately for select/boolean, on blur for free-text fields so typing
   * doesn't trigger a save per keystroke. Defaults to `onChange`. */
  onCommit?: (fieldId: string, value: string) => void;
  columns?: 1 | 2;
  disabled?: boolean;
}

/** Renders every active custom field the same way whether creating a task
 * or editing an existing one (spec section 6: "должны работать так же, как
 * при редактировании") - one implementation, so a styling or behavior fix
 * (see the dropdown/focus-ring audit) applies everywhere at once. */
export function CustomFieldInputs({ fields, values, onChange, onCommit, columns = 2, disabled }: CustomFieldInputsProps) {
  if (fields.length === 0) return null;
  const commit = onCommit ?? onChange;

  return (
    <div className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {fields.map((field) => {
        const value = values.get(field.id) ?? "";
        if (field.fieldType === "select") {
          return (
            <div key={field.id} className="space-y-1">
              <label className={fieldLabelClass}>{field.name}</label>
              <Select
                value={value}
                onChange={(v) => {
                  onChange(field.id, v);
                  commit(field.id, v);
                }}
                disabled={disabled}
                placeholder="—"
                options={[{ value: "", label: "—" }, ...field.options.map((o) => ({ value: o, label: o }))]}
              />
            </div>
          );
        }
        if (field.fieldType === "boolean") {
          return (
            <label key={field.id} className="flex items-end gap-2 pb-1.5">
              <input
                type="checkbox"
                checked={value === "true"}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.checked ? "true" : "false";
                  onChange(field.id, next);
                  commit(field.id, next);
                }}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-[12.5px] text-label-primary">{field.name}</span>
            </label>
          );
        }
        return (
          <div key={field.id} className="space-y-1">
            <label className={fieldLabelClass}>{field.name}</label>
            <input
              type={inputTypeFor(field.fieldType)}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(field.id, e.target.value)}
              onBlur={(e) => commit(field.id, e.target.value)}
              className={fieldInputClass}
            />
          </div>
        );
      })}
    </div>
  );
}
