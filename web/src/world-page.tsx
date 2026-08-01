import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, type EntrySummary } from "./api";
import { StatusBadge } from "./ui";
import { WorldSidebar } from "./sidebar";
import { ChatPanel } from "./chat";
import { usePageCommands } from "./palette";

function WorldSettingsPanel({ worldId }: { worldId: string }) {
  const qc = useQueryClient();
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const s = world.data?.world.settings ?? {};
  const [vibe, setVibe] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [authorAs, setAuthorAs] = useState<string | null>(null);
  const [aiCanon, setAiCanon] = useState<boolean | null>(null);
  const save = useMutation({
    mutationFn: () =>
      api.updateWorldSettings(worldId, {
        vibe: vibe ?? s.vibe ?? "",
        style_prompt: style ?? s.style_prompt ?? "",
        humans_author_as: (authorAs ?? s.humans_author_as ?? "canon") as
          | "draft"
          | "canon",
        ai_can_edit_canon: aiCanon ?? s.ai_can_edit_canon ?? false,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["world", worldId] }),
  });
  return (
    <details className="rounded-lg border border-neutral-800 p-3 text-sm">
      <summary className="cursor-pointer text-neutral-400">
        World settings
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-neutral-500">
            Vibe — global context for the AI ("It's Elden Ring", …)
          </span>
          <textarea
            defaultValue={s.vibe ?? ""}
            onChange={(e) => setVibe(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 p-2"
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">
            Style prompt — primes AI writing (e.g. WoTC sourcebook voice)
          </span>
          <textarea
            defaultValue={s.style_prompt ?? ""}
            onChange={(e) => setStyle(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 p-2"
          />
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              Humans author as
            </span>
            <select
              defaultValue={s.humans_author_as ?? "canon"}
              onChange={(e) => setAuthorAs(e.target.value)}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
            >
              <option value="canon">canon</option>
              <option value="draft">draft</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={s.ai_can_edit_canon ?? false}
              onChange={(e) => setAiCanon(e.target.checked)}
            />
            <span className="text-xs text-neutral-500">
              AI can modify/delete canon
            </span>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded bg-neutral-100 px-3 py-1 text-neutral-900"
          >
            Save settings
          </button>
          <button
            onClick={async () => {
              if (confirm("Delete this world and everything in it?")) {
                await api.deleteWorld(worldId);
                window.location.href = "/";
              }
            }}
            className="text-xs text-red-500 hover:text-red-300"
          >
            delete world
          </button>
        </div>
      </div>
    </details>
  );
}

// ---------- World home ----------

export function WorldPage({ worldId }: { worldId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const entries = useQuery({
    queryKey: ["entries", worldId],
    queryFn: () => api.listEntries(worldId),
  });
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const create = useMutation({
    mutationFn: () => api.createEntry(worldId, typeId, title.trim()),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["entries", worldId] });
      navigate({ to: "/e/$entryId", params: { entryId: e.id } });
    },
  });

  const grouped = new Map<string, EntrySummary[]>();
  for (const e of entries.data ?? []) {
    grouped.set(e.type_name, [...(grouped.get(e.type_name) ?? []), e]);
  }

  usePageCommands(worldId, [
    {
      id: "export-vault",
      label: "Export vault (Obsidian zip)",
      hint: "download",
      run: () => {
        window.location.href = `/api/worlds/${worldId}/export`;
      },
    },
    {
      id: "export-dump",
      label: "Export world dump (JSON fixture)",
      hint: "download",
      run: () => window.open(`/api/worlds/${worldId}/dump`, "_blank"),
    },
    {
      id: "new-entry",
      label: "New entry…",
      run: () =>
        document
          .querySelector<HTMLInputElement>('input[placeholder="New entry title"]')
          ?.focus(),
    },
    {
      id: "settings",
      label: "World settings",
      run: () => {
        const d = document.querySelector("details");
        if (d) {
          d.open = true;
          d.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
  ]);

  return (
    <div>
      <WorldSidebar worldId={worldId} />
      <div style={{ marginLeft: "var(--sidebar-w)" }} className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{world.data?.world.name}</h2>
        <a
          href={`/api/worlds/${worldId}/export`}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300"
          title="Download Obsidian-style vault (zip)"
        >
          <Download size={12} /> export vault
        </a>
      </div>

      {[...grouped.entries()].map(([typeName, list]) => (
        <section key={typeName}>
          <h3 className="mb-2 text-sm font-medium text-neutral-500">
            {typeName}
          </h3>
          <ul className="space-y-1">
            {list.map((e) => (
              <li key={e.id}>
                <Link
                  to="/e/$entryId"
                  params={{ entryId: e.id }}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 hover:border-neutral-600"
                >
                  <span>{e.title}</span>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {entries.data?.length === 0 && (
        <p className="text-neutral-500">Empty world — create the first entry.</p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && typeId) create.mutate();
        }}
      >
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
        >
          <option value="">Type…</option>
          {world.data?.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New entry title"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-500"
        />
        <button
          className="rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-900 disabled:opacity-50"
          disabled={create.isPending}
        >
          Add
        </button>
      </form>

      <WorldSettingsPanel worldId={worldId} />
      <ChatPanel worldId={worldId} />
      </div>
    </div>
  );
}