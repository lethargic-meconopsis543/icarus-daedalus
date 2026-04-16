import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { pct } from "../lib/format";
import MetricTile from "../components/MetricTile";
import FleetStatus from "../components/FleetStatus";
import ActivityFeed from "../components/ActivityFeed";
import MemoryCard from "../components/MemoryCard";
import { Link } from "react-router-dom";

export default function Overview() {
  const fleet = useQuery({
    queryKey: ["fleet"],
    queryFn: api.fleet,
    refetchInterval: 5000,
  });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.activity(50),
    refetchInterval: 5000,
  });
  const health = useQuery({
    queryKey: ["wiki", "health"],
    queryFn: api.wikiHealth,
    refetchInterval: 60_000,
  });

  if (fleet.isLoading) return <div className="text-zinc-500">loading…</div>;
  if (fleet.error) return <div className="text-rose-400">backend error: {(fleet.error as Error).message}</div>;
  const f = fleet.data!;
  const m = f.metrics;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricTile
          label="Recall success"
          value={m.recall_sample_size > 0 ? pct(m.recall_success_rate) : "—"}
          hint={m.recall_sample_size > 0 ? `n=${m.recall_sample_size} · 7d` : "no labeled recalls yet"}
        />
        <MetricTile label="Reuse rate" value={pct(m.reuse_rate)} hint="entries reused, 7d" />
        <MetricTile label="Verification" value={pct(m.verification_rate)} hint="entries verified, 7d" />
        <MetricTile label="Entries today" value={m.entries_today} hint={`${f.counts.healthy} healthy · ${f.counts.blocked} blocked`} />
        <MetricTile
          label="Knowledge health"
          value={health.data?.page_count ?? "—"}
          hint={
            health.data
              ? `${m.promotions_today} promotions today · ${health.data.broken_links.length} broken · ${health.data.orphan_pages.length} orphans`
              : "wiki worker off"
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <FleetStatus agents={f.agents} />
        </div>
        <div className="lg:col-span-3">
          <ActivityFeed events={activity.data ?? []} />
        </div>
      </section>

      {f.projects.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-zinc-200 mb-2">Projects · last 24h</h2>
          <div className="flex flex-wrap gap-2">
            {f.projects.map((p) => (
              <div key={p.project_id} className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm flex items-baseline gap-2">
                <span className="text-zinc-100">{p.name}</span>
                <span className="font-mono text-xs text-zinc-500">{p.entries_24h}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-200">High-value decisions today</h2>
          <Link to="/memory?kind=decision" className="text-xs text-zinc-500 hover:text-zinc-300">more →</Link>
        </div>
        {f.highlights.length === 0 ? (
          <div className="text-sm text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-6">
            no decisions recorded today yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {f.highlights.map((h) => (
              <MemoryCard key={h.id} entry={h} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
