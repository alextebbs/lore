// Shared UI atoms and doc helpers.
import { Link } from "@tanstack/react-router";
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

// A reference to another entry — identical styling to rich-text
// mention chips (the .entity class both share).
export function EntityChip({
  id,
  title,
  draft = false,
}: {
  id: string;
  title: string;
  draft?: boolean;
}) {
  return (
    <Link
      to="/e/$entryId"
      params={{ entryId: id }}
      className={`entity max-w-56 shrink-0 truncate ${draft ? "entity-draft" : ""}`}
      title={title}
    >
      {title}
    </Link>
  );
}

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
    <div className={`h-4 animate-pulse rounded bg-stone-900 ${w}`} />
  );
  return (
    <div className="max-w-4xl space-y-5 p-6" aria-busy="true">
      <div className="h-7 w-64 animate-pulse rounded bg-stone-900" />
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
  tip,
  title,
  body,
  actionLabel,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: ReactElement;
  tip?: string;
  title: string;
  body?: string;
  actionLabel: string;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger &&
        (tip ? (
          <Tip tip={tip}>
            <AlertDialog.Trigger render={trigger} />
          </Tip>
        ) : (
          <AlertDialog.Trigger render={trigger} />
        ))}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="anim-backdrop fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Popup
          className="anim-fade panel fixed left-1/2 top-1/3 z-50 w-full max-w-sm -translate-x-1/2 p-4"
        >
          <AlertDialog.Title className="">
            {title}
          </AlertDialog.Title>
          {body && (
            <AlertDialog.Description className="mt-1 text-stone-400">
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

function Tip({ tip, children }: { tip: string; children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} aria-label={tip} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" sideOffset={6} className="z-50">
          <Tooltip.Popup className={`anim-fade px-2 py-1 text-stone-300 ${surface}`}>
            {tip}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// THE button. One height, one radius; intent controls the accent color
// (rest text + hover border); `tip` is the one tooltip mechanism — no
// native title attributes on controls anywhere. Raw <button> elements
// are forbidden outside this file (design test).
export type Intent = "default" | "solid" | "danger" | "warning";

const intentCls: Record<Intent, string> = {
  default: "",
  solid: "btn-solid",
  danger: "btn-danger",
  warning: "btn-warning",
};

export function Button({
  intent = "default",
  icon = false,
  active = false,
  tip,
  className = "",
  ...props
}: {
  intent?: Intent;
  icon?: boolean;
  active?: boolean;
  tip?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const btn = (
    <button
      type="button"
      className={[
        "btn",
        icon && "btn-icon",
        active ? "btn-solid" : intentCls[intent],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
  return tip ? <Tip tip={tip}>{btn}</Tip> : btn;
}

// Same contract for anchors (downloads, external links).
export function LinkButton({
  icon = false,
  tip,
  className = "",
  ...props
}: {
  icon?: boolean;
  tip?: string;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const a = (
    <a
      className={["btn", icon && "btn-icon", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
  return tip ? <Tip tip={tip}>{a}</Tip> : a;
}

// List-row button: palette rows, suggestion menus, revision headers.
export function RowButton({
  active = false,
  className = "",
  ...props
}: {
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left ${
        active ? "bg-stone-800 text-white" : "text-stone-300"
      } ${className}`}
      {...props}
    />
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
        className="btn min-w-40 justify-between data-[popup-open]:border-stone-500"
      >
        <Select.Value className="truncate">
          {(v: T | null) =>
            v == null ? (
              <span className="text-stone-600">{placeholder}</span>
            ) : (
              (items.find((i) => i.value === v)?.label ?? v)
            )
          }
        </Select.Value>
        <Select.Icon className="text-stone-600">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50">
          <Select.Popup className={`anim-fade max-h-72 overflow-y-auto py-1 ${surface}`}>
            {items.map((i) => (
              <Select.Item
                key={i.value}
                value={i.value}
                className="cursor-default px-3 py-1 data-[highlighted]:bg-stone-800 data-[selected]:text-white"
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

export const age = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 60 / 24)}d ago`;
};
