import { cn } from "../lib/cn.ts"
import type { Entry } from "../lib/types.ts"
import { ChevronRight } from "lucide-react"

const TIER_STYLES: Record<string, string> = {
  hot: "bg-amber-500/15 text-amber-400",
  warm: "bg-yellow-500/15 text-yellow-400",
  cold: "bg-blue-500/15 text-blue-400",
}

export function EntryRow({ entry, expanded, onToggle }: {
  entry: Entry
  expanded?: boolean
  onToggle?: () => void
}) {
  return (
    <>
      <tr
        className={cn("hover:bg-surface-3 transition-colors", onToggle && "cursor-pointer")}
        onClick={onToggle}
      >
        <td className="py-1.5 px-3 text-[11px] text-text-3 font-mono tabular-nums whitespace-nowrap">
          <div className="flex items-center gap-1">
            {onToggle && (
              <ChevronRight size={12} className={cn("text-text-3 transition-transform", expanded && "rotate-90")} />
            )}
            {entry.timestamp.slice(0, 16)}
          </div>
        </td>
        <td className="py-1.5 px-3 text-[12px] font-medium">{entry.agent}</td>
        <td className="py-1.5 px-3 text-[12px] text-text-2">{entry.platform || "cli"}</td>
        <td className="py-1.5 px-3">
          <span className="inline-flex items-center h-5 px-1.5 text-[11px] rounded bg-surface-2 text-text-2">
            {entry.type}
          </span>
        </td>
        <td className="py-1.5 px-3">
          <span className={cn("inline-flex items-center h-5 px-1.5 text-[11px] font-medium rounded", TIER_STYLES[entry.tier] || "bg-surface-2 text-text-3")}>
            {entry.tier}
          </span>
        </td>
        <td className="py-1.5 px-3 text-[12px] text-text-2 max-w-xs truncate">{entry.summary}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-3 py-3 bg-surface-2 border-b border-border">
            <div className="ml-4 space-y-2">
              <div className="flex gap-4 text-[11px] text-text-3">
                <span>ID: <span className="font-mono text-text-2">{entry.id || "none"}</span></span>
                <span>Project: <span className="font-mono text-text-2">{entry.project_id || "unscoped"}</span></span>
                <span>Session: <span className="font-mono text-text-2">{entry.session_id || "none"}</span></span>
              </div>
              <p className="text-[12px] text-text-2 leading-relaxed whitespace-pre-wrap">
                {entry.body || "No additional content"}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
