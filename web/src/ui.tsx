// Shared UI atoms and doc helpers.
import type { DocNode } from "./doc";

// Fields-as-docs: richtext values are docs; legacy strings wrap into a
// minimal doc until their next save migrates them server-side.
export const strToDoc = (s: string): DocNode => ({
  type: "doc",
  content: (s ? s.split("\n") : [""]).map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : undefined,
  })),
});
export const asFieldDoc = (v: unknown): DocNode =>
  v && typeof v === "object" && (v as DocNode).type === "doc"
    ? (v as DocNode)
    : strToDoc(typeof v === "string" ? v : "");

export const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    canon: "chip-canon",
    draft: "chip-draft",
    mixed: "",
  };
  return <span className={`chip ${styles[status] ?? ""}`}>{status}</span>;
}

// Content-area skeleton: same layout bones as the entry page, so a
// cold-load navigation swaps content without moving anything else.
export function EntrySkeleton() {
  const bar = (w: string) => (
    <div className={`h-4 animate-pulse rounded bg-neutral-900 ${w}`} />
  );
  return (
    <div className="max-w-4xl space-y-5 p-6" aria-busy="true">
      <div className="h-7 w-64 animate-pulse rounded bg-neutral-900" />
      <div className="space-y-3 pt-2">
        {["w-3/4", "w-1/2", "w-2/3", "w-1/3"].map((w) => (
          <div key={w} className="flex gap-3">
            <div className="w-44 shrink-0" />
            {bar(w)}
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-4">
        {bar("w-full")}
        {bar("w-full")}
        {bar("w-5/6")}
        {bar("w-2/3")}
      </div>
    </div>
  );
}

// ---- Base UI, spartan-styled -------------------------------------------
// Primitives supply behavior (focus, ARIA, positioning, dismissal); the
// design language stays ours: mono, one type size, neutral surfaces.

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Select } from "@base-ui/react/select";
import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

export const surface = "panel";

// Confirm replaces window.confirm: a real focus-trapped dialog.
export function Confirm({
  trigger,
  title,
  body,
  actionLabel,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: ReactElement;
  title: string;
  body?: string;
  actionLabel: string;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger render={trigger} />}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Popup
          className="panel fixed left-1/2 top-1/3 z-50 w-full max-w-sm -translate-x-1/2 p-4"
        >
          <AlertDialog.Title className="font-semibold">
            {title}
          </AlertDialog.Title>
          {body && (
            <AlertDialog.Description className="mt-1 text-neutral-400">
              {body}
            </AlertDialog.Description>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Close className="btn">cancel</AlertDialog.Close>
            <AlertDialog.Close
              onClick={onConfirm}
              className="btn btn-danger text-red-400"
            >
              {actionLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// IconTip wraps an icon-only control with an accessible tooltip.
export function IconTip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} aria-label={label} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" sideOffset={6}>
          <Tooltip.Popup className={`px-2 py-1 text-neutral-300 ${surface}`}>
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export { Tooltip };

// Picker: the app's one Select style.
export function Picker<T extends string>({
  value,
  onChange,
  items,
  placeholder,
  autoFocus,
}: {
  value: T | "";
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <Select.Root
      value={value === "" ? null : value}
      onValueChange={(v) => v != null && onChange(v as T)}
    >
      <Select.Trigger
        autoFocus={autoFocus}
        className="btn min-w-40 justify-between data-[popup-open]:border-neutral-500"
      >
        <Select.Value className="truncate">
          {(v: T | null) =>
            v == null ? (
              <span className="text-neutral-600">{placeholder}</span>
            ) : (
              (items.find((i) => i.value === v)?.label ?? v)
            )
          }
        </Select.Value>
        <Select.Icon className="text-neutral-600">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50">
          <Select.Popup className={`max-h-72 overflow-y-auto py-1 ${surface}`}>
            {items.map((i) => (
              <Select.Item
                key={i.value}
                value={i.value}
                className="cursor-default px-3 py-1 data-[highlighted]:bg-neutral-800 data-[selected]:text-white"
              >
                <Select.ItemText>{i.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
