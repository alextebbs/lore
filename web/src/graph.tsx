import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

const W = 640;
const H = 360;

type Pos = { x: number; y: number };

// Small deterministic force layout — no dependency needed at ego-network
// scale (a few dozen nodes).
function layout(
  nodeIds: string[],
  edges: { from: string; to: string }[],
): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodeIds.length, 1);
    const r = i === 0 ? 0 : 120 + 40 * (i % 3);
    pos.set(id, {
      x: W / 2 + r * Math.cos(angle),
      y: H / 2 + r * Math.sin(angle),
    });
  });
  const k = 90;
  for (let iter = 0; iter < 200; iter++) {
    const force = new Map<string, Pos>(
      nodeIds.map((id) => [id, { x: 0, y: 0 }]),
    );
    // repulsion
    for (const a of nodeIds) {
      for (const b of nodeIds) {
        if (a === b) continue;
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const f = (k * k) / d2;
        const fa = force.get(a)!;
        fa.x += (dx / Math.sqrt(d2)) * f;
        fa.y += (dy / Math.sqrt(d2)) * f;
      }
    }
    // attraction along edges
    for (const e of edges) {
      const pa = pos.get(e.from);
      const pb = pos.get(e.to);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = (d * d) / k / 40;
      const fa = force.get(e.from)!;
      const fb = force.get(e.to)!;
      fa.x += (dx / d) * f;
      fa.y += (dy / d) * f;
      fb.x -= (dx / d) * f;
      fb.y -= (dy / d) * f;
    }
    const cool = 1 - iter / 200;
    for (const id of nodeIds) {
      const p = pos.get(id)!;
      const f = force.get(id)!;
      // gravity toward center
      f.x += (W / 2 - p.x) * 0.02;
      f.y += (H / 2 - p.y) * 0.02;
      p.x = Math.min(W - 30, Math.max(30, p.x + f.x * 0.5 * cool));
      p.y = Math.min(H - 20, Math.max(20, p.y + f.y * 0.5 * cool));
    }
  }
  return pos;
}

const typeColor: Record<string, string> = {
  Character: "#7dd3fc",
  Place: "#86efac",
  Event: "#fca5a5",
  Item: "#fcd34d",
  Faction: "#c4b5fd",
};

export function EgoGraph({ entryId }: { entryId: string }) {
  const [depth, setDepth] = useState<1 | 2>(1);
  const graph = useQuery({
    queryKey: ["graph", entryId, depth],
    queryFn: () => api.getGraph(entryId, depth),
  });

  const positions = useMemo(() => {
    if (!graph.data) return new Map<string, Pos>();
    return layout(
      (graph.data.nodes ?? []).map((n) => n.id),
      graph.data.edges ?? [],
    );
  }, [graph.data]);

  if (!graph.data) return null;
  const nodes = graph.data.nodes ?? [];
  const edges = graph.data.edges ?? [];
  if (nodes.length <= 1) {
    return (
      <p className="text-neutral-600">
        No connections yet — add relations to see the graph.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">
          Connections
        </span>
        <div className="flex gap-1">
          {([1, 2] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`rounded px-2 py-0.5 ${
                depth === d
                  ? "bg-neutral-200 text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-800"
              }`}
            >
              {d} hop{d > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded border border-neutral-800 bg-neutral-900"
      >
        {edges.map((e) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          return (
            <g key={e.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.status === "draft" ? "#78350f" : "#404040"}
                strokeDasharray={e.status === "draft" ? "4 3" : undefined}
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 4}
                textAnchor="middle"
                className="fill-neutral-600 text-[9px]"
              >
                {e.field}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          return (
            <Link key={n.id} to="/e/$entryId" params={{ entryId: n.id }}>
              <g className="cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={n.depth === 0 ? 10 : 7}
                  fill={typeColor[n.type_name] ?? "#a3a3a3"}
                  stroke={n.depth === 0 ? "#fafafa" : "none"}
                  strokeWidth={2}
                  opacity={n.status === "draft" ? 0.5 : 1}
                />
                <text
                  x={p.x}
                  y={p.y + (n.depth === 0 ? 24 : 20)}
                  textAnchor="middle"
                  className="fill-neutral-300 text-[10px]"
                >
                  {n.title}
                </text>
              </g>
            </Link>
          );
        })}
      </svg>
    </div>
  );
}
