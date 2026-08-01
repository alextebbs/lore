import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { api } from "./api";
import { Picker, EntrySkeleton } from "./ui";

// The world has no separate listing page — its home IS the World meta
// entry. WorldAdmin renders the world-scoped controls (new entry,
// settings, exports) inside that entry's page; the /w route redirects.

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
    <Collapsible.Root id="world-settings" className="rounded border border-neutral-800 p-3">
      <Collapsible.Trigger className="group flex cursor-pointer items-center gap-1 text-neutral-400 hover:text-white">
        <ChevronRight
          size={13}
          className="transition-transform group-data-[panel-open]:rotate-90"
        />
        World settings
      </Collapsible.Trigger>
      <Collapsible.Panel className="mt-3 space-y-3">
        <label className="block">
          <span className="text-neutral-500">
            Vibe — global context for the AI ("It's Elden Ring", …)
          </span>
          <textarea
            defaultValue={s.vibe ?? ""}
            onChange={(e) => setVibe(e.target.value)}
            rows={2}
            className="input mt-1 h-auto w-full py-1"
          />
        </label>
        <label className="block">
          <span className="text-neutral-500">
            Style prompt — how AI prose should read
          </span>
          <textarea
            defaultValue={s.style_prompt ?? ""}
            onChange={(e) => setStyle(e.target.value)}
            rows={2}
            className="input mt-1 h-auto w-full py-1"
          />
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">Humans author as</span>
            <Picker
              value={(authorAs ?? s.humans_author_as ?? "canon") as string}
              onChange={setAuthorAs}
              placeholder="canon"
              items={[
                { value: "canon", label: "canon" },
                { value: "draft", label: "draft" },
              ]}
            />
          </label>
          <label className="flex items-center gap-2 text-neutral-500">
            <input
              type="checkbox"
              defaultChecked={s.ai_can_edit_canon ?? false}
              onChange={(e) => setAiCanon(e.target.checked)}
            />
            AI may edit canon
          </label>
        </div>
        <button onClick={() => save.mutate()} className="btn btn-solid">
          Save settings
        </button>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function WorldAdmin({ worldId }: { worldId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
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
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && typeId) create.mutate();
        }}
      >
        <Picker
          value={typeId}
          onChange={setTypeId}
          placeholder="Type…"
          items={(world.data?.types ?? [])
            .filter((t) => t.name !== "World")
            .map((t) => ({ value: t.id, label: t.name }))}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New entry title"
          className="input flex-1"
        />
        <button className="btn btn-solid" disabled={create.isPending}>
          Add
        </button>
      </form>
      <div className="flex items-center gap-2">
        <a href={`/api/worlds/${worldId}/export`} className="btn">
          <Download size={12} /> export vault
        </a>
        <a
          href={`/api/worlds/${worldId}/dump`}
          target="_blank"
          rel="noreferrer"
          className="btn"
        >
          <Download size={12} /> export dump
        </a>
      </div>
      <WorldSettingsPanel worldId={worldId} />
    </div>
  );
}

// /w/$worldId is a redirect: the world's home is its meta entry.
export function WorldPage({ worldId }: { worldId: string }) {
  const navigate = useNavigate();
  const entries = useQuery({
    queryKey: ["entries", worldId],
    queryFn: () => api.listEntries(worldId),
  });
  const meta = (entries.data ?? []).find((e) => e.type_name === "World");
  useEffect(() => {
    if (meta) {
      navigate({
        to: "/e/$entryId",
        params: { entryId: meta.id },
        replace: true,
      });
    }
  }, [meta, navigate]);
  if (entries.data && !meta) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <WorldAdmin worldId={worldId} />
      </div>
    );
  }
  return <EntrySkeleton />;
}
