import { Link } from "react-router-dom";
import AgentBadge from "./AgentBadge";
import { timeAgo } from "../lib/format";
import type { Agent } from "../api/client";

export default function FleetStatus({ agents }: { agents: Agent[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">Fleet</h2>
        <span className="text-xs text-zinc-500 font-mono">{agents.length} agents</span>
      </div>
      <ul className="divide-y divide-zinc-800/80">
        {agents.map((a) => (
          <li key={a.id}>
            <Link to={`/agents/${a.id}`} className="block px-4 py-2.5 hover:bg-zinc-900/60 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100">{a.name}</span>
                    <AgentBadge status={a.status} />
                    <span className="text-[11px] text-zinc-500 font-mono">{a.platform}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400 truncate">
                    {a.current_task ?? <span className="text-zinc-600">no current task</span>}
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">{timeAgo(a.last_seen_at)}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
