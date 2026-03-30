import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "../lib/cn.ts"
import { AgentCard } from "../components/agent-card.tsx"
import { relativeTime } from "../lib/format.ts"
import type { DashboardData, Agent, Entry } from "../lib/types.ts"

const FILTERS = ["all", "healthy", "stale", "idle", "offline"] as const

export function Fleet({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState<string>("all")
  const [selected, setSelected] = useState<Agent | null>(null)

  const agents = filter === "all"
    ? data.agents
    : data.agents.filter((a) => a.status === filter)

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => {
            const count = f === "all" ? data.agents.length : data.agents.filter((a) => a.status === f).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 text-[12px] rounded-lg transition-colors tabular-nums",
                  filter === f
                    ? "bg-surface-3 text-text font-medium"
                    : "text-text-3 hover:text-text-2 hover:bg-surface-3"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1 text-text-3">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map((a) => (
            <AgentCard
              key={a.name}
              agent={a}
              active={selected?.name === a.name}
              onClick={() => setSelected(selected?.name === a.name ? null : a)}
            />
          ))}
          {agents.length === 0 && (
            <p className="text-[13px] text-text-3 col-span-full">No agents match this filter</p>
          )}
        </div>
      </div>

      {selected && (
        <DetailPanel
          agent={selected}
          entries={data.entries}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function DetailPanel({ agent, entries, onClose }: { agent: Agent; entries: Entry[]; onClose: () => void }) {
  const [tab, setTab] = useState<"info" | "entries">("info")
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const agentEntries = entries.filter((e) => e.agent === agent.name)

  return (
    <div className="w-[360px] shrink-0 bg-surface border border-border rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-160px)] sticky top-0 self-start">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", agent.online ? "bg-success animate-pulse" : "bg-text-3")} />
          <h3 className="text-[14px] font-medium">{agent.name}</h3>
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text transition-colors p-1 rounded hover:bg-surface-3">
          <X size={14} />
        </button>
      </div>

      <div className="flex border-b border-border shrink-0">
        {(["info", "entries"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-[12px] font-medium border-b-2 transition-colors",
              tab === t ? "border-accent text-text" : "border-transparent text-text-3 hover:text-text-2"
            )}
          >
            {t === "info" ? "Info" : `Entries (${agentEntries.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "info" && (
          <div className="space-y-4">
            <Field label="Status">
              <StatusBadge status={agent.status} />
            </Field>

            {agent.role && (
              <Field label="Role">
                <p className="text-[12px] text-text-2 leading-relaxed">{agent.role}</p>
              </Field>
            )}

            {agent.platforms.length > 0 && (
              <Field label="Platforms">
                <div className="space-y-1">
                  {agent.platforms.map((p) => (
                    <div key={p.name} className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-[12px] font-medium">{p.name}</span>
                      </div>
                      <span className="text-[11px] text-text-3">{p.state}</span>
                    </div>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Metrics">
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="Total" value={agent.entries} />
                <MiniMetric label="Today" value={agent.entriesToday ?? 0} />
                <MiniMetric label="7d" value={agent.entries7d ?? 0} />
                <MiniMetric label="Projects" value={agent.projectCount ?? 0} />
                <MiniMetric label="Sessions" value={agent.sessionCount ?? 0} />
                <MiniMetric label="Cycles" value={agent.cycles} />
              </div>
            </Field>

            <Field label="Last active">
              <span className="text-[12px] text-text-2">{relativeTime(agent.lastActive)}</span>
            </Field>

            {agent.lastOutput && (
              <Field label="Last output">
                <p className="text-[11px] text-text-3 font-mono leading-relaxed bg-surface-2 rounded-lg p-2">
                  {agent.lastOutput}
                </p>
              </Field>
            )}
          </div>
        )}

        {tab === "entries" && (
          <div className="space-y-1">
            {agentEntries.slice(0, 50).map((entry) => (
              <div key={entry.file}>
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-3 cursor-pointer transition-colors"
                  onClick={() => setExpandedEntry(expandedEntry === entry.file ? null : entry.file)}
                >
                  <TierDot tier={entry.tier} />
                  <span className="font-mono text-[11px] text-text-3 tabular-nums shrink-0">
                    {entry.timestamp.slice(11, 16)}
                  </span>
                  <span className="text-[11px] text-text-3 shrink-0">{entry.type}</span>
                  <span className="text-[12px] text-text-2 truncate">{entry.summary}</span>
                </div>
                {expandedEntry === entry.file && (
                  <div className="ml-6 mt-1 mb-2 p-2 bg-surface-2 rounded-lg text-[11px] text-text-2 leading-relaxed whitespace-pre-wrap">
                    {entry.body || "No content"}
                  </div>
                )}
              </div>
            ))}
            {agentEntries.length === 0 && <p className="text-[12px] text-text-3">No entries from this agent</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-text-3 uppercase font-semibold mb-1">{label}</div>
      {children}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-1.5 bg-surface-2 rounded-lg text-center">
      <div className="text-[14px] font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-text-3">{label}</div>
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const style = {
    healthy: "bg-success/15 text-success",
    stale: "bg-warning/15 text-warning",
    idle: "bg-surface-2 text-text-3",
    offline: "bg-error/15 text-error",
  }[status || "offline"] || "bg-surface-2 text-text-3"

  return (
    <span className={cn("inline-flex items-center h-5 px-1.5 text-[11px] rounded font-medium", style)}>
      {status || "unknown"}
    </span>
  )
}

function TierDot({ tier }: { tier: string }) {
  const color = { hot: "bg-amber-400", warm: "bg-yellow-400", cold: "bg-blue-400" }[tier] || "bg-text-3"
  return <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", color)} />
}
