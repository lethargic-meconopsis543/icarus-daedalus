import type { WikiTree, WikiHealth } from "../api/client";

type Props = {
  tree: WikiTree;
  health: WikiHealth | undefined;
  selected: string;
  onSelect: (name: string) => void;
};

export default function WikiSidebar({ tree, health, selected, onSelect }: Props) {
  return (
    <aside className="w-56 shrink-0 space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="px-3 py-2 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 flex items-center justify-between">
          <span>Wiki</span>
          <span className="font-mono text-zinc-400">{tree.total_pages}</span>
        </div>
        <ul className="divide-y divide-zinc-800/80">
          {tree.subdirs.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                onClick={() => onSelect(s.name)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  selected === s.name ? "bg-zinc-900/70 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900/50"
                }`}
              >
                <span>{s.name}</span>
                <span className="font-mono text-xs text-zinc-500">{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {health ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1.5 text-xs">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Health</div>
          <Row label="broken links" value={health.broken_links.length} danger={health.broken_links.length > 0} />
          <Row label="orphans" value={health.orphan_pages.length} danger={health.orphan_pages.length > 0} />
          <Row label="no sources" value={health.pages_without_sources.length} />
          <div className="pt-2 mt-2 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1">
            <span>llm:</span>
            <span className={health.llm.status === "configured" || health.llm.status === "ok" ? "text-emerald-400" : "text-zinc-500"}>
              {health.llm.provider ?? "off"}
            </span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Row({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-mono ${danger ? "text-amber-400" : "text-zinc-300"}`}>{value}</span>
    </div>
  );
}
