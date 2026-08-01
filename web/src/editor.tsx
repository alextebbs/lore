import { useEffect, useMemo, useRef, useState } from "react";
import { Code, Lock, LockOpen } from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension, Mark, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { EntrySummary } from "./api";
import { fromTipTap, toTipTap, type DocNode } from "./doc";

// Invisible, Notion-like editing: no chrome until you ask for it.
// Formatting lives in a bubble menu that appears on selection; blocks
// are inserted with "/" commands; "[[" opens entry autocomplete.

// The draft mark: AI-authored spans awaiting human blessing (ADR 0001).
const Draft = Mark.create({
  name: "draft",
  parseHTML() {
    return [{ tag: "span[data-draft]" }];
  },
  renderHTML() {
    return [
      "span",
      { "data-draft": "", class: "text-neutral-500" },
      0,
    ];
  },
});

// Entry mentions: atomic inline chips that carry the linked entry's ID,
// rendered by title with no bracket syntax (tenet: links persist through
// IDs, titles are display-only).
const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: "" },
      label: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-mention-id]",
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute("data-mention-id") ?? "",
          label: (el as HTMLElement).textContent ?? "",
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "span",
      {
        "data-mention-id": node.attrs.id,
        class:
          "rounded bg-sky-950/60 px-1 text-sky-300 cursor-pointer hover:bg-sky-900/60",
      },
      node.attrs.label || "…",
    ];
  },
  renderText({ node }) {
    return node.attrs.label ?? "";
  },
});

type MenuState = {
  kind: "slash" | "entity";
  items: MenuItem[];
  rect: { left: number; bottom: number };
  command: (item: MenuItem) => void;
};

type MenuItem = { key: string; label: string; hint?: string };

const SLASH_COMMANDS: {
  key: string;
  label: string;
  hint: string;
  run: (editor: Editor, range: { from: number; to: number }) => void;
}[] = [
  { key: "h1", label: "Heading 1", hint: "#", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { key: "h2", label: "Heading 2", hint: "##", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { key: "h3", label: "Heading 3", hint: "###", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { key: "text", label: "Text", hint: "plain paragraph", run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { key: "bullet", label: "Bullet list", hint: "•", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { key: "numbered", label: "Numbered list", hint: "1.", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { key: "quote", label: "Quote", hint: ">", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { key: "code", label: "Code block", hint: "```", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { key: "divider", label: "Divider", hint: "---", run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { key: "link", label: "Link an entry", hint: "[[", run: (e, r) => e.chain().focus().deleteRange(r).insertContent("[[").run() },
];

function suggestionRender(
  setMenu: (m: MenuState | null) => void,
  selectedRef: { current: number },
  menuRef: { current: MenuState | null },
) {
  const update = (props: SuggestionProps, kind: "slash" | "entity") => {
    const rect = props.clientRect?.();
    if (!rect) return;
    const items = props.items as MenuItem[];
    selectedRef.current = Math.min(
      selectedRef.current,
      Math.max(items.length - 1, 0),
    );
    setMenu({
      kind,
      items,
      rect: { left: rect.left, bottom: rect.bottom },
      command: (item) => props.command(item),
    });
  };
  return (kind: "slash" | "entity") => () => ({
    onStart: (props: SuggestionProps) => {
      selectedRef.current = 0;
      update(props, kind);
    },
    onUpdate: (props: SuggestionProps) => update(props, kind),
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      const menu = menuRef.current;
      if (!menu) return false;
      if (event.key === "ArrowDown") {
        selectedRef.current = (selectedRef.current + 1) % menu.items.length;
        setMenu({ ...menu });
        return true;
      }
      if (event.key === "ArrowUp") {
        selectedRef.current =
          (selectedRef.current - 1 + menu.items.length) % menu.items.length;
        setMenu({ ...menu });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = menu.items[selectedRef.current];
        if (item) menu.command(item);
        return true;
      }
      if (event.key === "Escape") {
        setMenu(null);
        return true;
      }
      return false;
    },
    onExit: () => setMenu(null),
  });
}

// The "[[" entry autocomplete, shared by the body editor and the inline
// field editors. Inserts a mention node carrying the entry's ID.
function makeEntityLink(
  render: ReturnType<typeof suggestionRender>,
  entriesRef: { current: EntrySummary[] },
) {
  return Extension.create({
    name: "entityLink",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "[[",
          pluginKey: new PluginKey("entitySuggestion"),
          items: ({ query }) =>
            entriesRef.current
              .filter((e) =>
                e.title.toLowerCase().includes(query.toLowerCase()),
              )
              .slice(0, 8)
              .map((e) => ({
                key: e.id,
                label: e.title,
                hint: e.type_name,
              })),
          command: ({ editor, range, props }) => {
            const item = props as MenuItem;
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent([
                {
                  type: "mention",
                  attrs: { id: item.key, label: item.label },
                },
                { type: "text", text: " " },
              ])
              .run();
          },
          render: render("entity"),
        }),
      ];
    },
  });
}

function SuggestionPopup({
  menu,
  selectedRef,
  setMenu,
}: {
  menu: MenuState | null;
  selectedRef: { current: number };
  setMenu: (m: MenuState) => void;
}) {
  if (!menu || menu.items.length === 0) return null;
  return (
    <div
      className="fixed z-50 min-w-52 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-2xl"
      style={{ left: menu.rect.left, top: menu.rect.bottom + 6 }}
    >
      {menu.items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => menu.command(item)}
          onMouseEnter={() => {
            selectedRef.current = i;
            setMenu({ ...menu });
          }}
          className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm ${
            i === selectedRef.current
              ? "bg-neutral-800 text-white"
              : "text-neutral-300"
          }`}
        >
          <span>{item.label}</span>
          {item.hint && (
            <span className="text-xs text-neutral-600">{item.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}

const mentionNavigate = (
  _view: unknown,
  _pos: number,
  node: { type: { name: string }; attrs: Record<string, unknown> },
) => {
  if (node.type.name === "mention" && node.attrs.id) {
    window.location.assign(`/e/${node.attrs.id}`);
    return true;
  }
  return false;
};

export function BodyEditor({
  doc,
  entries,
  onChange,
}: {
  doc: DocNode;
  entries: EntrySummary[];
  onChange: (doc: DocNode) => void;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const selectedRef = useRef(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  const extensions = useMemo(() => {
    const render = suggestionRender(setMenu, selectedRef, menuRef);
    const SlashCommands = Extension.create({
      name: "slashCommands",
      addProseMirrorPlugins() {
        return [
          Suggestion({
            editor: this.editor,
            char: "/",
            pluginKey: new PluginKey("slashSuggestion"),
            items: ({ query }) =>
              SLASH_COMMANDS.filter((c) =>
                c.label.toLowerCase().includes(query.toLowerCase()),
              ),
            command: ({ editor, range, props }) => {
              const item = props as (typeof SLASH_COMMANDS)[number];
              item.run(editor as Editor, range);
            },
            render: render("slash"),
          }),
        ];
      },
    });
    return [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        strike: false,
        hardBreak: false,
        underline: false,
      }),
      Draft,
      Mention,
      Placeholder.configure({
        placeholder: "Write… ('/' for blocks, '[[' to link an entry)",
      }),
      SlashCommands,
      makeEntityLink(render, entriesRef),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    extensions,
    content: toTipTap(doc),
    editorProps: {
      attributes: {
        class: "min-h-48 py-2 text-sm leading-relaxed outline-none",
      },
      handleClickOn: mentionNavigate,
    },
    onUpdate: ({ editor }) => {
      onChange(fromTipTap(editor.getJSON() as DocNode));
    },
  });

  // Sync in external changes (canon promotion, restore) without looping
  // on our own onChange updates.
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(toTipTap(doc));
    if (incoming !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(toTipTap(doc));
    }
  }, [doc, editor]);

  if (!editor) return null;

  const bubbleBtn = (
    active: boolean,
    onClick: () => void,
    label: React.ReactNode,
    title: string,
  ) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2 py-1 text-xs ${
        active ? "text-white" : "text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative">
      <BubbleMenu
        editor={editor}
        className="flex items-center overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl"
      >
        {bubbleBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <b>B</b>, "Bold")}
        {bubbleBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <i>I</i>, "Italic")}
        {bubbleBtn(editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), <Code size={13} />, "Code")}
        <span className="h-4 w-px bg-neutral-700" />
        {bubbleBtn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "H1", "Heading 1")}
        {bubbleBtn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2", "Heading 2")}
        <span className="h-4 w-px bg-neutral-700" />
        {bubbleBtn(editor.isActive("draft"), () => editor.chain().focus().toggleMark("draft").run(), <LockOpen size={13} />, "Mark selection as draft")}
        {bubbleBtn(false, () => editor.chain().focus().unsetMark("draft").run(), <Lock size={13} />, "Promote selection to canon")}
      </BubbleMenu>

      <EditorContent editor={editor} />

      <SuggestionPopup menu={menu} selectedRef={selectedRef} setMenu={setMenu} />
    </div>
  );
}

// --- Inline field editor -------------------------------------------------
// Richtext fields (origin, goals items, …) store plain Markdown strings
// server-side; this editor renders their [[Title]] links as the same
// mention chips the body uses. Only mentions are structured — all other
// text passes through verbatim, so the string round-trips exactly.

const inlineMentionRe = /\[\[([^[\]]+)\]\]/g;

function parseInlineMd(value: string, entries: EntrySummary[]): DocNode {
  const byTitle = new Map(entries.map((e) => [e.title.toLowerCase(), e.id]));
  const paras = value.split("\n").map((line): DocNode => {
    const content: DocNode[] = [];
    let last = 0;
    for (const m of line.matchAll(inlineMentionRe)) {
      if (m.index! > last)
        content.push({ type: "text", text: line.slice(last, m.index) });
      const label = m[1].trim();
      content.push({
        type: "mention",
        attrs: { id: byTitle.get(label.toLowerCase()) ?? "", label },
      });
      last = m.index! + m[0].length;
    }
    if (last < line.length)
      content.push({ type: "text", text: line.slice(last) });
    return { type: "paragraph", content: content.length ? content : undefined };
  });
  return { type: "doc", content: paras };
}

function serializeInlineMd(doc: DocNode): string {
  const para = (p: DocNode) =>
    (p.content ?? [])
      .map((n) =>
        n.type === "mention"
          ? `[[${(n.attrs?.label as string) ?? ""}]]`
          : (n.text ?? ""),
      )
      .join("");
  return (doc.content ?? []).map(para).join("\n");
}

export function InlineField({
  value,
  entries,
  onChange,
  placeholder,
}: {
  value: string;
  entries: EntrySummary[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const selectedRef = useRef(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);
  const valueRef = useRef(value);

  const extensions = useMemo(() => {
    const render = suggestionRender(setMenu, selectedRef, menuRef);
    return [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        code: false,
        strike: false,
        hardBreak: false,
        underline: false,
        link: false,
      }),
      Mention,
      Placeholder.configure({ placeholder: placeholder ?? "—" }),
      makeEntityLink(render, entriesRef),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    extensions,
    content: toTipTap(parseInlineMd(value, entries)),
    editorProps: {
      attributes: {
        class:
          "w-full rounded px-1 py-0.5 text-sm outline-none hover:bg-neutral-900 focus:bg-neutral-900",
      },
      handleClickOn: mentionNavigate,
    },
    onUpdate: ({ editor }) => {
      const next = serializeInlineMd(fromTipTap(editor.getJSON() as DocNode));
      valueRef.current = next;
      onChange(next);
    },
  });

  // Sync in external changes without looping on our own updates.
  useEffect(() => {
    if (!editor || value === valueRef.current) return;
    valueRef.current = value;
    editor.commands.setContent(
      toTipTap(parseInlineMd(value, entriesRef.current)),
    );
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      <SuggestionPopup menu={menu} selectedRef={selectedRef} setMenu={setMenu} />
    </div>
  );
}
