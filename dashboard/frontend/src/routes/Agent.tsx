import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { pct, timeAgo } from "../lib/format";
import AgentBadge from "../components/AgentBadge";
import MetricTile from "../components/MetricTile";
import MemoryCard from "../components/MemoryCard";
import RecallFeedback from "../components/RecallFeedback";

type Tab = "writes" | "recalls" | "contribution";

export default function Agent() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("writes");
  const { data, isLoading, error } = useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.agent(id),
    refetchInterval: 10_000,
  });

  if (isLoading) return <div className="text-zinc-500">loading…</div>;
  if (error) return <div className="text-rose-400">error: {(error as Error).message}</div>;
  if (!data) return null;
  const { agent, recent_writes, recent_recalls, contribution, writes_by_day } = data;

  const max = Math.max(1, ...writes_by_day.map((d) => d.count));
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "writes", label: "Writes", count: recent_writes.length },
    { id: "recalls", label: "Recalls", count: recent_recalls.length },
    { id: "contribution", label: "Contribution", count: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300">← fleet</Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-medium text-zinc-100">{agent.name}</h1>
          <AgentBadge status={agent.status} />
          <span className="text-xs text-zinc-500 font-mono">{agent.platform}</span>
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          {agent.current_task ?? <span className="text-zinc-600">no current task</span>}
          <span className="ml-3 text-zinc-600 font-mono text-xs">last seen {timeAgo(agent.last_seen_at)}</span>
        </div>
      </div>

      <div className="border-b border-zinc-800 flex gap-1">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.id
                ? "border-zinc-100 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {t.label}
            {t.count > 0 ? <span className="ml-2 text-xs text-zinc-500 font-mono">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "writes" ? (
        recent_writes.length === 0 ? (
          <div className="text-sm text-zinc-500">no writes yet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recent_writes.map((e) => <MemoryCard key={e.id} entry={e} />)}
          </div>
        )
      ) : null}

      {tab === "recalls" ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80">
          {recent_recalls.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">no recalls yet</div>
          ) : recent_recalls.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
              <span className="font-mono text-sm text-zinc-200 truncate flex-1">“{r.query}”</span>
              <span className="text-[11px] text-zinc-500 font-mono">{(r.returned_entry_ids ?? []).length} hits</span>
              <RecallFeedback recall={r} />
              <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap w-14 text-right">{timeAgo(r.created_at)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "contribution" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MetricTile label="Writes (7d)" value={Math.round(contribution.write_volume_7d)} />
            <MetricTile label="Reuse rate" value={pct(contribution.reuse_rate)} />
            <MetricTile label="Verification" value={pct(contribution.verification_rate)} />
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Writes by day (14d)</div>
            <div className="flex items-end gap-1 h-24">
              {writes_by_day.length === 0 ? (
                <div className="text-sm text-zinc-500">no data</div>
              ) : writes_by_day.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                  <div className="w-full bg-zinc-700 rounded-sm" style={{ height: `${(d.count / max) * 100}%`, minHeight: "2px" }} />
                  <div className="text-[9px] text-zinc-600 font-mono">{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
