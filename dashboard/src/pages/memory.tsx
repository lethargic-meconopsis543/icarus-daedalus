import { useState, useMemo } from "react"
import { Search, ArrowUpDown, X } from "lucide-react"
import { EntryRow } from "../components/entry-row.tsx"
import type { DashboardData } from "../lib/types.ts"

function unique(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))].sort()
}

type SortKey = "timestamp" | "agent" | "platform" | "type" | "tier"

export function Memory({ data }: { data: DashboardData }) {
  const [agent, setAgent] = useState("")
  const [type, setType] = useState("")
  const [tier, setTier] = useState("")
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("timestamp")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  const agents = useMemo(() => unique(data.entries.map((e) => e.agent)), [data.entries])
  const types = useMemo(() => unique(data.entries.map((e) => e.type)), [data.entries])
  const tiers = useMemo(() => unique(data.entries.map((e) => e.tier)), [data.entries])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return data.entries.filter((e) => {
      if (agent && e.agent !== agent) return false
      if (type && e.type !== type) return false
      if (tier && e.tier !== tier) return false
      if (q && !e.summary.toLowerCase().includes(q) && !e.body.toLowerCase().includes(q)) return false
      return true
    })
  }, [data.entries, agent, type, tier, query])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] || ""
      const vb = b[sortKey] || ""
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const activeFilters = [
    agent && { label: `Agent: ${agent}`, clear: () => setAgent("") },
    type && { label: `Type: ${type}`, clear: () => setType("") },
    tier && { label: `Tier: ${tier}`, clear: () => setTier("") },
    query && { label: `"${query}"`, clear: () => setQuery("") },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            placeholder="Search entries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-surface-2 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-text placeholder:text-text-3 focus:outline-none focus:border-accent/50 w-48"
          />
        </div>
        <Select value={agent} onChange={setAgent} options={agents} placeholder="All agents" />
        <Select value={type} onChange={setType} options={types} placeholder="All types" />
        <Select value={tier} onChange={setTier} options={tiers} placeholder="All tiers" />
        <span className="text-[11px] text-text-3 tabular-nums ml-auto">{sorted.length} results</span>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {activeFilters.map((f) => (
            <button
              key={f.label}
              onClick={f.clear}
              className="inline-flex items-center gap-1 h-6 px-2 text-[11px] rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              {f.label}
              <X size={10} />
            </button>
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={() => { setAgent(""); setType(""); setTier(""); setQuery("") }}
              className="h-6 px-2 text-[11px] text-text-3 hover:text-text-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <SortHeader label="Time" sortKey="timestamp" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Agent" sortKey="agent" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Platform" sortKey="platform" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Type" sortKey="type" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Tier" sortKey="tier" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase">Summary</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <EntryRow
                key={e.file}
                entry={e}
                expanded={expandedEntry === e.file}
                onToggle={() => setExpandedEntry(expandedEntry === e.file ? null : e.file)}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[13px] text-text-3">
                  No entries match filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortHeader({ label, sortKey, currentKey, dir, onSort }: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: "asc" | "desc"
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <th
      className="py-1.5 px-3 text-[11px] text-text-3 font-semibold uppercase cursor-pointer select-none hover:text-text-2 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          <span className="text-accent">{dir === "asc" ? "↑" : "↓"}</span>
        ) : (
          <ArrowUpDown size={10} className="opacity-30" />
        )}
      </div>
    </th>
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50 appearance-none cursor-pointer pr-6"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
