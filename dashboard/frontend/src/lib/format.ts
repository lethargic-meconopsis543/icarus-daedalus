export function timeAgo(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const diff = Math.max(0, (Date.now() - then) / 1000);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const statusColor: Record<string, string> = {
  healthy: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  idle: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  stale: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  blocked: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  offline: "bg-zinc-700/40 text-zinc-400 ring-zinc-600/40",
};

export const kindColor: Record<string, string> = {
  decision: "text-violet-300",
  fact: "text-sky-300",
  failure: "text-rose-300",
  fix: "text-emerald-300",
  preference: "text-amber-300",
  observation: "text-zinc-400",
  handoff: "text-fuchsia-300",
  review: "text-cyan-300",
  completion: "text-emerald-300",
  write: "text-zinc-300",
  recall: "text-slate-300",
  status: "text-zinc-400",
};

export function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`;
}
