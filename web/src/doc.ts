// Our rich-text doc model (mirrors internal/richtext) and the mapping
// to/from TipTap's node names. Ours are snake_case; TipTap's camelCase.

export type DocMark = { type: string };
export type DocNode = {
  type: string;
  text?: string;
  marks?: DocMark[];
  attrs?: Record<string, unknown>;
  content?: DocNode[];
};

const toTipTapName: Record<string, string> = {
  bullet_list: "bulletList",
  ordered_list: "orderedList",
  list_item: "listItem",
  code_block: "codeBlock",
  horizontal_rule: "horizontalRule",
};
const fromTipTapName: Record<string, string> = {
  bulletList: "bullet_list",
  orderedList: "ordered_list",
  listItem: "list_item",
  codeBlock: "code_block",
  horizontalRule: "horizontal_rule",
};

function rename(node: DocNode, table: Record<string, string>): DocNode {
  return {
    ...node,
    type: table[node.type] ?? node.type,
    content: node.content?.map((c) => rename(c, table)),
  };
}

export const toTipTap = (doc: DocNode): DocNode => rename(doc, toTipTapName);
export const fromTipTap = (doc: DocNode): DocNode =>
  rename(doc, fromTipTapName);

export const emptyDoc: DocNode = { type: "doc" };
