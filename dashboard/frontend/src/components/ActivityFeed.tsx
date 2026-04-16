import { timeAgo, kindColor } from "../lib/format";
import type { EventRow } from "../api/client";

export default function ActivityFeed({ events }: { events: EventRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 flex flex-col max-h-[620px]">
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">Activity</h2>
        <span className="text-xs text-zinc-500 font-mono">{events.length} events</span>
      </div>
      <ul className="overflow-y-auto divide-y divide-zinc-800/80">
        {events.map((e) => (
          <li key={e.id} className="px-4 py-2 flex items-baseline gap-3">
            <span className={`w-20 shrink-0 font-mono text-xs ${kindColor[e.kind] ?? "text-zinc-400"}`}>{e.kind}</span>
            <span className="min-w-0 flex-1 text-sm text-zinc-300 truncate">
              {(e.payload?.title as string) ?? (e.payload?.note as string) ?? (e.payload?.query as string) ?? "—"}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono shrink-0">{e.agent_name ?? "—"}</span>
            <span className="text-[11px] text-zinc-500 font-mono shrink-0 w-14 text-right">{timeAgo(e.occurred_at)}</span>
          </li>
        ))}
        {events.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">no activity yet</li>
        ) : null}
      </ul>
    </div>
  );
}
