import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type MemoryEntry } from "../api/client";
import MemoryCard from "../components/MemoryCard";
import ProvenanceTrail from "../components/ProvenanceTrail";
import WikiBacklinks from "../components/WikiBacklinks";
import { timeAgo, kindColor } from "../lib/format";

const KINDS = ["decision", "fact", "failure", "fix", "preference", "observation"];

export default function Memory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const kind = searchParams.get("kind") ?? "";
  const verifiedParam = searchParams.get("verified");
  const verified = verifiedParam === "true" ? true : verifiedParam === "false" ? false : undefined;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const queryParams = useMemo(
    () => ({
      q: searchParams.get("q") || undefined,
      kind: kind || undefined,
      verified,
      limit: 40,
    }),
    [searchParams, kind, verified],
  );

  const list = useQuery({
    queryKey: ["memory", queryParams],
    queryFn: () =>
      queryParams.q
        ? api.retrieve({
            query: queryParams.q,
            kind: queryParams.kind,
            verified: queryParams.verified,
            limit: queryParams.limit,
          })
        : api.memory(queryParams),
    refetchOnWindowFocus: false,
  });

  const topRecalled = useQuery({ queryKey: ["top-recalled"], queryFn: api.topRecalled });
  const topReused = useQuery({ queryKey: ["top-reused"], queryFn: api.topReused });
  const detail = useQuery({
    queryKey: ["memory-detail", selectedId],
    queryFn: () => api.memoryDetail(selectedId!),
    enabled: selectedId !== null,
  });

  function update(k: string, v: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (v === undefined || v === "") next.delete(k);
    else next.set(k, v);
    setSearchParams(next);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update("q", q.trim() || undefined);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
      <aside className="space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Kind</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => update("kind", undefined)}
                className={`px-2 py-0.5 rounded text-xs font-mono ${!kind ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
              >
                all
              </button>
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => update("kind", kind === k ? undefined : k)}
                  className={`px-2 py-0.5 rounded text-xs font-mono ${
                    kind === k
                      ? "bg-zinc-100 text-zinc-900"
                      : `bg-zinc-800 hover:text-zinc-200 ${kindColor[k] ?? "text-zinc-400"}`
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Verified</div>
            <div className="flex gap-1">
              {[
                { label: "all", v: undefined },
                { label: "yes", v: "true" },
                { label: "no", v: "false" },
              ].map((o) => (
                <button
                  type="button"
                  key={o.label}
                  onClick={() => update("verified", o.v)}
                  className={`px-2 py-0.5 rounded text-xs font-mono ${
                    (verifiedParam ?? "") === (o.v ?? "")
                      ? "bg-zinc-100 text-zinc-900"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="space-y-3">
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search memory (ranked by relevance, recency, reuse, trust)"
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="rounded-md px-3 py-2 text-sm bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
          >
            search
          </button>
        </form>
        {list.isLoading ? (
          <div className="text-zinc-500">loading…</div>
        ) : (list.data?.length ?? 0) === 0 ? (
          <div className="text-sm text-zinc-500 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-6">
            no entries match
          </div>
        ) : (
          <div className="space-y-2">
            {list.data!.map((e) => (
              <MemoryCard key={e.id} entry={e} onClick={() => setSelectedId(e.id)} />
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <RightList title="Top recalled (7d)" entries={topRecalled.data ?? []} onPick={setSelectedId} />
        <RightList title="Top reused" entries={topReused.data ?? []} onPick={setSelectedId} />
      </aside>

      {selectedId !== null ? (
        <Drawer onClose={() => setSelectedId(null)}>
          {detail.isLoading ? <div className="text-zinc-500">loading…</div> : detail.data ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className={kindColor[detail.data.kind] ?? "text-zinc-400"}>{detail.data.kind}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">{detail.data.author_agent_id ?? "—"}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">{timeAgo(detail.data.created_at)}</span>
                  {detail.data.verified_at ? (
                    <span className="ml-auto text-emerald-400">verified {timeAgo(detail.data.verified_at)}</span>
                  ) : (
                    <span className="ml-auto text-zinc-600">unverified</span>
                  )}
                </div>
                <h3 className="mt-1 text-lg text-zinc-100">{detail.data.title}</h3>
                <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{detail.data.body}</p>
              </div>
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Promoted to</h4>
                <WikiBacklinks memoryEntryId={detail.data.id} />
              </div>
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Provenance</h4>
                <ProvenanceTrail detail={detail.data} />
              </div>
            </div>
          ) : null}
        </Drawer>
      ) : null}
    </div>
  );
}

function RightList({
  title, entries, onPick,
}: { title: string; entries: MemoryEntry[]; onPick: (id: number) => void }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="px-3 py-2 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="px-3 py-3 text-xs text-zinc-600">no data</div>
      ) : (
        <ul className="divide-y divide-zinc-800/80">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onPick(e.id)}
                className="block w-full text-left px-3 py-2 hover:bg-zinc-900/70 transition-colors"
              >
                <div className="text-sm text-zinc-200 truncate">{e.title}</div>
                <div className="text-[11px] font-mono text-zinc-500">
                  <span className={kindColor[e.kind] ?? "text-zinc-400"}>{e.kind}</span>
                  <span className="mx-1">·</span>
                  reuse {e.reuse_count}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-zinc-950 border-l border-zinc-800 p-6 overflow-y-auto">
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 mb-4">close ✕</button>
        {children}
      </aside>
    </div>
  );
}
