import { useState, useMemo } from "react"
import { cn } from "../lib/cn.ts"
import type { DashboardData, Entry } from "../lib/types.ts"

const TIER_BORDER: Record<string, string> = {
  hot: "border-l-amber-400",
  warm: "border-l-yellow-400",
  cold: "border-l-blue-400",
}

const TIER_FILTER_STYLE: Record<string, string> = {
  hot: "bg-amber-500/15 text-amber-500",
  warm: "bg-yellow-500/15 text-yellow-500",
  cold: "bg-blue-500/15 text-blue-500",
}

export function Logs({ data }: { data: DashboardData }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [agentFilter, setAgentFilter] = useState<string>("")

  const agents = useMemo(() => [...new Set(data.entries.map((e) => e.agent))].sort(), [data.entries])

  const filtered = useMemo(() => {
    return data.entries.filter((e) => {
      if (tierFilter !== "all" && e.tier !== tierFilter) return false
      if (agentFilter && e.agent !== agentFilter) return false
      return true
    })
  }, [data.entries, tierFilter, agentFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, Entry[]> = {}
    for (const e of filtered) {
      const date = e.timestamp.slice(0, 10) || "unknown"
      if (!groups[date]) groups[date] = []
      groups[date].push(e)
    }
    return groups
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1">
          {["all", "hot", "warm", "cold"].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={cn(
                "h-6 px-2 text-[11px] rounded font-medium transition-colors",
                tierFilter === t
                  ? (t === "all" ? "bg-surface-3 text-text" : TIER_FILTER_STYLE[t])
                  : "text-text-3 hover:text-text-2"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-[11px] text-text focus:outline-none focus:border-accent/50 appearance-none cursor-pointer pr-5"
        >
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[11px] text-text-3 tabular-nums ml-auto">{filtered.length} events</span>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([date, entries]) => (
          <div key={date}>
            <div className="text-[11px] text-text-3 uppercase font-semibold mb-2 sticky top-0 bg-bg py-1">{date}</div>
            <div className="space-y-px">
              {entries.map((entry) => (
                <LogEntry
                  key={entry.file}
                  entry={entry}
                  expanded={expanded === entry.file}
                  onToggle={() => setExpanded(expanded === entry.file ? null : entry.file)}
                />
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-[13px] text-text-3">No log entries match filters</p>
        )}
      </div>
    </div>
  )
}

function LogEntry({ entry, expanded, onToggle }: { entry: Entry; expanded: boolean; onToggle: () => void }) {
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 border-l-2 rounded-r-lg hover:bg-surface-3 cursor-pointer transition-colors",
          TIER_BORDER[entry.tier] || "border-l-text-3"
        )}
        onClick={onToggle}
      >
        <span className="font-mono text-[11px] text-text-3 tabular-nums shrink-0 w-10">
          {entry.timestamp.slice(11, 16)}
        </span>
        <span className="text-[12px] font-medium shrink-0 w-28 truncate">{entry.agent}</span>
        <span className="inline-flex items-center h-5 px-1.5 text-[11px] rounded bg-surface-2 text-text-3 shrink-0">
          {entry.platform || "cli"}
        </span>
        <span className="inline-flex items-center h-5 px-1.5 text-[11px] rounded bg-surface-2 text-text-3 shrink-0">
          {entry.type}
        </span>
        <span className="text-[12px] text-text-2 truncate">{entry.summary}</span>
      </div>
      {expanded && (
        <div className="ml-[18px] border-l-2 border-border pl-4 py-2">
          <div className="flex gap-4 text-[11px] text-text-3 mb-2">
            <span>ID: <span className="font-mono text-text-2">{entry.id || "none"}</span></span>
            <span>Project: <span className="font-mono text-text-2">{entry.project_id || "unscoped"}</span></span>
            <span>Session: <span className="font-mono text-text-2">{entry.session_id || "none"}</span></span>
          </div>
          <p className="text-[12px] text-text-2 leading-relaxed whitespace-pre-wrap bg-surface-2 rounded-lg p-3">
            {entry.body || "No additional content"}
          </p>
        </div>
      )}
    </div>
  )
}
