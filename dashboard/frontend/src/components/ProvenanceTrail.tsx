import type { MemoryDetail } from "../api/client";
import RecallFeedback from "./RecallFeedback";

export default function ProvenanceTrail({ detail }: { detail: MemoryDetail }) {
  const hasAny = detail.edges_in.length || detail.edges_out.length || detail.recalled_by.length;
  if (!hasAny) return <div className="text-sm text-zinc-500">no provenance recorded</div>;
  return (
    <div className="space-y-3 text-sm">
      {detail.recalled_by.length > 0 ? (
        <section>
          <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Recalled by</h4>
          <ul className="space-y-1">
            {detail.recalled_by.map((r) => (
              <li key={r.id} className="font-mono text-xs text-zinc-300 flex items-center gap-2">
                <span className="text-zinc-500">#{r.id}</span>
                <span className="text-zinc-200 truncate flex-1">“{r.query}”</span>
                <span className="text-zinc-500">{r.agent_id ?? "—"}</span>
                <RecallFeedback recall={r} invalidateKeys={[["memory-detail", detail.id]]} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {detail.edges_out.length > 0 ? (
        <section>
          <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Cites</h4>
          <ul className="font-mono text-xs text-zinc-400 space-y-0.5">
            {detail.edges_out.map((e) => (
              <li key={e.id}>{e.relation} → {e.dst_type}:{e.dst_id}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {detail.edges_in.filter(e => e.src_type !== "recall").length > 0 ? (
        <section>
          <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Cited by</h4>
          <ul className="font-mono text-xs text-zinc-400 space-y-0.5">
            {detail.edges_in.filter(e => e.src_type !== "recall").map((e) => (
              <li key={e.id}>{e.src_type}:{e.src_id} — {e.relation}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
