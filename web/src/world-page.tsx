import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, type VaultImportResult } from "./api";
import { Button, EntrySkeleton, LinkButton, Picker } from "./ui";
import { WorldSidebar } from "./sidebar";
import { TypeManager } from "./schema-editor";

// World-scoped pages: settings (+ exports) and the schema editor, each
// a dedicated route reached from the sidebar's world row. The world's
// home remains its meta entry; /w/$worldId redirects there.

function WorldSettingsForm({ worldId }: { worldId: string }) {
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
  if (!world.data) return null;
  return (
    <div className="space-y-3">
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
      <Button intent="solid" onClick={() => save.mutate()}>
        Save settings
      </Button>
    </div>
  );
}

function VaultImport({ worldId }: { worldId: string }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<VaultImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <label className="btn btn-add inline-flex cursor-pointer">
        {busy ? "importing…" : "import vault (.zip of markdown)"}
        <input
          type="file"
          accept=".zip"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              setResult(await api.importVault(worldId, f));
              qc.invalidateQueries({ queryKey: ["entries", worldId] });
              qc.invalidateQueries({ queryKey: ["world", worldId] });
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {result && (
        <div className="space-y-1 rounded border border-neutral-800 p-2 text-neutral-400">
          <div>
            {result.created} entries imported
            {result.created > 0 && " (as drafts unless marked canon)"}
          </div>
          {(result.skipped ?? []).map((s: string) => (
            <div key={s} className="text-neutral-600">
              skipped: {s}
            </div>
          ))}
          {(result.warnings ?? []).map((w: string) => (
            <div key={w} className="text-neutral-600">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsPage({ worldId }: { worldId: string }) {
  return (
    <div>
      <WorldSidebar worldId={worldId} />
      <div
        style={{ marginLeft: "var(--sidebar-w)" }}
        className="max-w-3xl space-y-6 p-6"
      >
        <h2 className="">World settings</h2>
        <WorldSettingsForm worldId={worldId} />
        <div className="space-y-2 border-t border-neutral-800 pt-4">
          <h3 className="text-neutral-500">Export</h3>
          <div className="flex items-center gap-2">
            <LinkButton href={`/api/worlds/${worldId}/export`}>
              <Download size={12} /> vault (Obsidian zip)
            </LinkButton>
            <LinkButton
              href={`/api/worlds/${worldId}/dump`}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={12} /> dump (JSON fixture)
            </LinkButton>
          </div>
        </div>
        <div className="space-y-2 border-t border-neutral-800 pt-4">
          <h3 className="text-neutral-500">Import</h3>
          <VaultImport worldId={worldId} />
        </div>
      </div>
    </div>
  );
}

export function SchemaPage({ worldId }: { worldId: string }) {
  return (
    <div>
      <WorldSidebar worldId={worldId} />
      <div
        style={{ marginLeft: "var(--sidebar-w)" }}
        className="max-w-3xl space-y-6 p-6"
      >
        <h2 className="">Entry types</h2>
        <TypeManager worldId={worldId} />
      </div>
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
  return <EntrySkeleton />;
}
