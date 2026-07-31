import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { fromTipTap, toTipTap, type DocNode } from "./doc";

// The draft mark: AI-authored spans awaiting human blessing (ADR 0001).
const Draft = Mark.create({
  name: "draft",
  parseHTML() {
    return [{ tag: "span[data-draft]" }];
  },
  renderHTML() {
    return [
      "span",
      { "data-draft": "", class: "rounded bg-amber-950 text-amber-200" },
      0,
    ];
  },
});

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    strike: false,
    hardBreak: false,
    underline: false,
  }),
  Draft,
];

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${
        active
          ? "bg-neutral-200 text-neutral-900"
          : "text-neutral-400 hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 px-2 py-1.5">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </ToolbarButton>
      {([1, 2, 3] as const).map((level) => (
        <ToolbarButton
          key={level}
          title={`Heading ${level}`}
          active={editor.isActive("heading", { level })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level }).run()
          }
        >
          H{level}
        </ToolbarButton>
      ))}
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        ••
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <ToolbarButton
        title="Mark selection as draft"
        active={editor.isActive("draft")}
        onClick={() => editor.chain().focus().toggleMark("draft").run()}
      >
        draft
      </ToolbarButton>
      <ToolbarButton
        title="Promote selection to canon (removes draft mark)"
        onClick={() => editor.chain().focus().unsetMark("draft").run()}
      >
        ✓ canon
      </ToolbarButton>
    </div>
  );
}

export function BodyEditor({
  doc,
  onChange,
}: {
  doc: DocNode;
  onChange: (doc: DocNode) => void;
}) {
  const editor = useEditor({
    extensions,
    content: toTipTap(doc),
    editorProps: {
      attributes: {
        class:
          "prose-invert min-h-40 p-3 text-sm leading-relaxed outline-none",
      },
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
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
