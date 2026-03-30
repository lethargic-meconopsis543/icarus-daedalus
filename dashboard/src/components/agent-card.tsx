import { cn } from "../lib/cn.ts"
import { relativeTime } from "../lib/format.ts"
import type { Agent } from "../lib/types.ts"

const STATUS_STYLE: Record<string, string> = {
  healthy: "bg-success/15 text-success",
  stale: "bg-warning/15 text-warning",
  idle: "bg-surface-2 text-text-3",
  offline: "bg-error/15 text-error",
}

export function AgentCard({ agent, active, onClick }: { agent: Agent; active?: boolean; onClick?: () => void }) {
  return (
    <div
      className={cn(
        "bg-surface border rounded-lg p-4 transition-colors",
        active ? "border-accent" : "border-border hover:border-border-2",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", agent.online ? "bg-success animate-pulse" : "bg-text-3")} />
          <span className="text-[14px] font-medium">{agent.name}</span>
        </div>
        <span className={cn("inline-flex items-center h-5 px-1.5 text-[11px] rounded font-medium", STATUS_STYLE[agent.status || "offline"])}>
          {agent.status || "offline"}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-text-2 leading-relaxed line-clamp-2">{agent.role}</p>
      {agent.platforms.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {agent.platforms.map((p) => (
            <span
              key={p.name}
              className="inline-flex items-center h-5 px-1.5 text-[11px] rounded"
              style={{ backgroundColor: `${p.color}26`, color: p.color }}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-4 mt-3 pt-3 border-t border-border text-[11px] text-text-3">
        <span><span className="font-mono tabular-nums text-text-2">{agent.entries}</span> entries</span>
        <span><span className="font-mono tabular-nums text-text-2">{agent.entriesToday ?? 0}</span> today</span>
        <span className="ml-auto">{relativeTime(agent.lastActive)}</span>
      </div>
    </div>
  )
}
