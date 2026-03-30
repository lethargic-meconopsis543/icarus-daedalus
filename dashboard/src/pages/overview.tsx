import { Stat } from "../components/stat.tsx"
import { AgentCard } from "../components/agent-card.tsx"
import { EntryRow } from "../components/entry-row.tsx"
import { bytes, uptime } from "../lib/format.ts"
import type { DashboardData } from "../lib/types.ts"
import type { Page } from "../components/sidebar.tsx"

export function Overview({ data, onNavigate }: { data: DashboardData; onNavigate: (p: Page) => void }) {
  const { agents, entries, stats, telemetry } = data
  const uniqueProjects = new Set(entries.map((e) => e.project_id).filter(Boolean)).size
  const topAgents = [...agents].sort((a, b) => b.entries - a.entries).slice(0, 5)
  const statusCounts = [
    { label: "Healthy", value: telemetry.health.healthyAgents, color: "text-success" },
    { label: "Stale", value: telemetry.health.staleAgents, color: "text-warning" },
    { label: "Idle", value: telemetry.health.idleAgents, color: "text-text-3" },
    { label: "Offline", value: telemetry.health.offlineAgents, color: "text-error" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Agents" value={`${stats.activeAgents}/${stats.totalAgents}`} />
        <Stat label="Entries" value={stats.totalEntries} />
        <Stat label="Today" value={stats.entriesToday} />
        <Stat label="Hot" value={stats.hot} />
        <Stat label="Brain" value={bytes(stats.brainSize)} />
        <Stat label="Uptime" value={uptime(stats.uptime)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-medium text-text-2">System health</h2>
            <span className="text-[11px] text-text-3 tabular-nums">{telemetry.health.silentAgents} silent</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statusCounts.map((item) => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg">
                <span className="text-[11px] text-text-3 uppercase font-semibold">{item.label}</span>
                <span className={`text-[18px] font-semibold tabular-nums ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg">
              <span className="text-[11px] text-text-3">Hot rate</span>
              <span className="text-[13px] font-medium tabular-nums">{Math.round(telemetry.memory.hotRate * 100)}%</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg">
              <span className="text-[11px] text-text-3">Coverage</span>
              <span className="text-[13px] font-medium tabular-nums">{Math.round(telemetry.memory.projectCoverage * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-medium text-text-2">Coordination</h2>
            <span className="text-[11px] text-text-3 tabular-nums">{uniqueProjects} projects</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCell label="Entries/session" value={telemetry.coordination.avgEntriesPerSession} />
            <MetricCell label="Multi-platform" value={telemetry.coordination.multiPlatformAgents} />
            <MetricCell label="Avg platforms" value={telemetry.coordination.avgPlatformsPerAgent} />
            <MetricCell label="Entries/agent" value={telemetry.coordination.avgEntriesPerAgent} />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-medium text-text-2">Top agents</h2>
          <button onClick={() => onNavigate("fleet")} className="text-[11px] text-accent hover:underline">
            View fleet →
          </button>
        </div>
        <div className="space-y-px">
          {topAgents.map((agent, i) => (
            <div key={agent.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer" onClick={() => onNavigate("fleet")}>
              <span className="text-[11px] font-mono tabular-nums text-text-3 w-5">{String(i + 1).padStart(2, "0")}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.online ? "var(--color-success)" : "var(--color-text-3)" }} />
              <span className="flex-1 text-[13px] font-medium truncate">{agent.name}</span>
              <span className="text-[11px] text-text-3 hidden md:block truncate max-w-[180px]">{agent.role}</span>
              <span className="font-mono text-[12px] tabular-nums text-text-2">{agent.entries}</span>
            </div>
          ))}
          {topAgents.length === 0 && <p className="text-[13px] text-text-3">No agents</p>}
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-medium text-text-2">Fleet</h2>
          <button onClick={() => onNavigate("fleet")} className="text-[11px] text-accent hover:underline">
            Manage →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.slice(0, 6).map((a) => (
            <AgentCard key={a.name} agent={a} onClick={() => onNavigate("fleet")} />
          ))}
          {agents.length === 0 && <p className="text-[13px] text-text-3 col-span-full">No agents configured</p>}
          {agents.length > 6 && (
            <button
              onClick={() => onNavigate("fleet")}
              className="flex items-center justify-center border border-border rounded-lg p-4 text-[13px] text-text-3 hover:text-text-2 hover:border-border-2 transition-colors"
            >
              +{agents.length - 6} more agents
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-medium text-text-2">Recent entries</h2>
          <button onClick={() => onNavigate("logs")} className="text-[11px] text-accent hover:underline">
            View logs →
          </button>
        </div>
        {entries.length > 0 ? (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Time</th>
                  <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Agent</th>
                  <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Platform</th>
                  <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Type</th>
                  <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Tier</th>
                  <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Summary</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 8).map((e) => (
                  <EntryRow key={e.file} entry={e} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-text-3">No entries yet</p>
        )}
      </section>
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg">
      <span className="text-[11px] text-text-3">{label}</span>
      <span className="font-mono text-[14px] font-medium tabular-nums">{value}</span>
    </div>
  )
}
