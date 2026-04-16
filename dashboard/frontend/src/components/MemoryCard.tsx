import { timeAgo, kindColor } from "../lib/format";
import type { MemoryEntry } from "../api/client";

type Props = {
  entry: MemoryEntry;
  onClick?: () => void;
  compact?: boolean;
};

export default function MemoryCard({ entry, onClick, compact }: Props) {
  const classes = `w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 ${
    onClick ? "hover:bg-zinc-900/70 hover:border-zinc-700 transition-colors" : ""
  }`;
  const content = (
    <>
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className={kindColor[entry.kind] ?? "text-zinc-400"}>{entry.kind}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">{entry.author_agent_id ?? "—"}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">{timeAgo(entry.created_at)}</span>
        {entry.verified_at ? (
          <span className="ml-auto text-emerald-400">verified</span>
        ) : (
          <span className="ml-auto text-zinc-600">unverified</span>
        )}
      </div>
      <div className="mt-1 text-[15px] text-zinc-100 leading-snug">{entry.title}</div>
      {!compact ? (
        <div className="mt-1 text-sm text-zinc-400 line-clamp-2">{entry.body}</div>
      ) : null}
      <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-zinc-500">
        <span>reuse {entry.reuse_count}</span>
        {entry.score !== undefined ? (
          <>
            <span>·</span>
            <span>score {entry.score.toFixed(2)}</span>
            {entry.signals ? (
              <span className="text-zinc-600">
                (rel {entry.signals.relevance.toFixed(2)} · rec {entry.signals.recency.toFixed(2)} · reuse {entry.signals.reuse.toFixed(2)} · trust {entry.signals.trust.toFixed(2)})
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );

  if (!onClick) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
