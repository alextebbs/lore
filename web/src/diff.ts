// Word-level diff via LCS — small texts only (entry bodies).

export type DiffPart = { type: "same" | "add" | "del"; text: string };

export function diffWords(a: string, b: string): DiffPart[] {
  const at = a.split(/(\s+)/).filter((t) => t !== "");
  const bt = b.split(/(\s+)/).filter((t) => t !== "");
  const n = at.length;
  const m = bt.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        at[i] === bt[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (at[i] === bt[j]) {
      push("same", at[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", at[i]);
      i++;
    } else {
      push("add", bt[j]);
      j++;
    }
  }
  while (i < n) push("del", at[i++]);
  while (j < m) push("add", bt[j++]);
  return parts;
}
