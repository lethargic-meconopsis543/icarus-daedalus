import { AGENT_COLORS } from "../lib/format.ts"
import type { DashboardData } from "../lib/types.ts"

export function ActivityPage({ data }: { data: DashboardData }) {
  const { timeline, platDist, typeDist, stats, telemetry } = data
  const days = Object.keys(timeline)
  const agentNames = days.length > 0 ? Object.keys(timeline[days[0]]) : []
  const maxPerDay = Math.max(
    1,
    ...days.map((d) => Object.values(timeline[d]).reduce((a, b) => a + b, 0))
  )
  const dayTotals = days.map((day) => ({
    day,
    total: Object.values(timeline[day]).reduce((a, b) => a + b, 0),
  }))
  const busiestDay = [...dayTotals].sort((a, b) => b.total - a.total)[0]
  const avgPerDay = dayTotals.length === 0 ? 0 : Math.round((dayTotals.reduce((sum, d) => sum + d.total, 0) / dayTotals.length) * 10) / 10
  const agentTotals = agentNames
    .map((name) => ({
      name,
      total: days.reduce((sum, day) => sum + (timeline[day][name] || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <SignalCard label="Daily avg" value={avgPerDay} />
        <SignalCard label="Busiest day" value={busiestDay?.total ?? 0} detail={busiestDay?.day ?? "n/a"} />
        <SignalCard label="Cross-platform" value={stats.xRecalls} />
        <SignalCard label="Multi-platform" value={telemetry.coordination.multiPlatformAgents} />
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-medium text-text-2">14-day timeline</h2>
          <div className="flex gap-3">
            {agentNames.map((name, i) => (
              <span key={name} className="flex items-center gap-1 text-[11px] text-text-3">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: AGENT_COLORS[i % AGENT_COLORS.length] }} />
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-px h-32">
          {days.map((day) => {
            const vals = agentNames.map((n) => timeline[day][n] || 0)
            const total = vals.reduce((a, b) => a + b, 0)
            return (
              <div key={day} className="flex-1 flex flex-col items-stretch" title={`${day}: ${total}`}>
                <div className="flex flex-col-reverse overflow-hidden rounded-t-sm bg-surface-2" style={{ height: 112 }}>
                  {vals.map((v, i) =>
                    v > 0 ? (
                      <div
                        key={agentNames[i]}
                        className="min-h-[2px]"
                        style={{
                          height: `${(v / maxPerDay) * 100}%`,
                          backgroundColor: AGENT_COLORS[i % AGENT_COLORS.length],
                        }}
                      />
                    ) : null
                  )}
                </div>
                <span className="mt-1.5 text-center font-mono text-[9px] text-text-3 tabular-nums">
                  {day.slice(5)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BarChart title="By platform" data={platDist} />
        <BarChart title="By type" data={typeDist} />
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-[14px] font-medium text-text-2 mb-3">Cross-platform</h2>
          <div className="flex flex-col items-center justify-center h-16">
            <span className="text-[28px] font-semibold tabular-nums">{stats.xRecalls}</span>
            <span className="text-[11px] text-text-3">recalls</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-medium text-text-2">Agent throughput</h2>
          <span className="text-[11px] text-text-3">14-day totals</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {agentTotals.map((agent) => (
            <div key={agent.name} className="px-3 py-2 bg-surface-2 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium truncate">{agent.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-text-3">{agent.total}</span>
              </div>
              <div className="mt-2 h-1 bg-bg rounded overflow-hidden">
                <div
                  className="h-full bg-accent rounded"
                  style={{ width: `${agentTotals[0]?.total ? (agent.total / agentTotals[0].total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
          {agentTotals.length === 0 && <p className="text-[13px] text-text-3">No activity data</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-medium text-text-2">Leaders today</h2>
            <span className="text-[11px] text-text-3">most active</span>
          </div>
          <LeaderList items={telemetry.leaders.byToday} empty="No activity today" />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-medium text-text-2">Project reach</h2>
            <span className="text-[11px] text-text-3">breadth by agent</span>
          </div>
          <LeaderList items={telemetry.leaders.byProjects} empty="No project data" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-medium text-text-2">Platform states</h2>
            <span className="text-[11px] text-text-3 tabular-nums">{Object.keys(telemetry.platformStates).length} configured</span>
          </div>
          <div className="space-y-1">
            {Object.entries(telemetry.platformStates).map(([name, states]) => (
              <div key={name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors">
                <span className="text-[13px] font-medium">{name}</span>
                <div className="flex gap-1">
                  {Object.entries(states).map(([state, count]) => (
                    <span key={state} className="inline-flex items-center h-5 px-1.5 text-[11px] rounded bg-surface-2 text-text-3">
                      {state}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(telemetry.platformStates).length === 0 && <p className="text-[13px] text-text-3">No platforms configured</p>}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-medium text-text-2">Top projects</h2>
            <span className="text-[11px] text-text-3">by entries</span>
          </div>
          <div className="space-y-1">
            {telemetry.projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors">
                <span className="text-[13px] font-medium truncate">{project.id}</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center h-5 px-1.5 text-[11px] rounded bg-surface-2 text-text-3">
                    {project.agents}a / {project.sessions}s
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-text-3">{project.entries}</span>
                </div>
              </div>
            ))}
            {telemetry.projects.length === 0 && <p className="text-[13px] text-text-3">No project data</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function SignalCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[11px] text-text-3 uppercase font-semibold">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-[11px] text-text-3">{detail}</div>}
    </div>
  )
}

function LeaderList({ items, empty }: { items: Array<{ name: string; value: number }>; empty: string }) {
  return items.length > 0 ? (
    <div className="space-y-px">
      {items.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors">
          <span className="text-[11px] font-mono tabular-nums text-text-3 w-5">{String(i + 1).padStart(2, "0")}</span>
          <span className="flex-1 text-[13px] font-medium truncate">{item.name}</span>
          <span className="font-mono text-[12px] tabular-nums text-text-2">{item.value}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-[13px] text-text-3">{empty}</p>
  )
}

function BarChart({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h2 className="text-[14px] font-medium text-text-2 mb-3">{title}</h2>
      <div className="space-y-2">
        {entries.map(([label, count]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[11px] text-text-3 w-14 truncate text-right">{label}</span>
            <div className="flex-1 h-1.5 bg-surface-2 rounded overflow-hidden">
              <div className="h-full bg-accent rounded" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-[11px] text-text-3 font-mono tabular-nums w-5 text-right">{count}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-[11px] text-text-3">No data</p>}
      </div>
    </div>
  )
}
