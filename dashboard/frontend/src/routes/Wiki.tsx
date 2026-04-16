import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import WikiSidebar from "../components/WikiSidebar";
import WikiPage from "../components/WikiPage";
import { timeAgo } from "../lib/format";

export default function Wiki() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tree = useQuery({ queryKey: ["wiki", "tree"], queryFn: api.wikiTree, refetchInterval: 15_000 });
  const health = useQuery({ queryKey: ["wiki", "health"], queryFn: api.wikiHealth, refetchInterval: 60_000 });

  const subdirFromUrl = searchParams.get("subdir");
  const pathFromUrl = searchParams.get("path");

  const firstNonEmpty = useMemo(() => {
    const s = tree.data?.subdirs.find((d) => d.count > 0);
    return s?.name ?? "entities";
  }, [tree.data]);

  const subdir = subdirFromUrl ?? (pathFromUrl ? pathFromUrl.split("/")[0] : firstNonEmpty);

  const pages = useQuery({
    queryKey: ["wiki", "pages", subdir],
    queryFn: () => api.wikiPages(subdir),
    enabled: !!subdir,
  });

  const page = useQuery({
    queryKey: ["wiki", "page", pathFromUrl],
    queryFn: () => api.wikiPage(pathFromUrl!),
    enabled: !!pathFromUrl,
  });

  useEffect(() => {
    if (!pathFromUrl && pages.data && pages.data.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set("path", pages.data[0].path);
      next.set("subdir", subdir);
      setSearchParams(next, { replace: true });
    }
  }, [pathFromUrl, pages.data, searchParams, setSearchParams, subdir]);

  function selectSubdir(name: string) {
    const next = new URLSearchParams(searchParams);
    next.set("subdir", name);
    next.delete("path");
    setSearchParams(next);
  }

  function selectPath(path: string) {
    const next = new URLSearchParams(searchParams);
    next.set("path", path);
    next.set("subdir", path.split("/")[0]);
    setSearchParams(next);
  }

  if (tree.isLoading) return <div className="text-zinc-500">loading…</div>;
  if (tree.error) return <div className="text-rose-400">error: {(tree.error as Error).message}</div>;
  if (!tree.data) return null;

  return (
    <div className="flex gap-4">
      <WikiSidebar tree={tree.data} health={health.data} selected={subdir} onSelect={selectSubdir} />

      <div className="w-72 shrink-0">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="px-3 py-2 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>{subdir}</span>
            <span className="font-mono text-zinc-400">{pages.data?.length ?? 0}</span>
          </div>
          {pages.isLoading ? (
            <div className="px-3 py-3 text-xs text-zinc-500">loading…</div>
          ) : (pages.data?.length ?? 0) === 0 ? (
            <div className="px-3 py-6 text-xs text-zinc-500">
              {tree.data.total_pages === 0
                ? "wiki is empty — trigger a fabric_write or start the worker"
                : "no pages in this subdir"}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/80 max-h-[calc(100vh-220px)] overflow-y-auto">
              {pages.data!.map((p) => {
                const active = p.path === pathFromUrl;
                return (
                  <li key={p.path}>
                    <button
                      type="button"
                      onClick={() => selectPath(p.path)}
                      className={`block w-full text-left px-3 py-2 transition-colors ${
                        active ? "bg-zinc-900/70 text-zinc-100" : "hover:bg-zinc-900/50"
                      }`}
                    >
                      <div className="text-sm text-zinc-200 truncate">{p.title}</div>
                      <div className="text-[11px] font-mono text-zinc-500">{timeAgo(p.updated_at)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-5">
        {page.isLoading ? (
          <div className="text-zinc-500">loading…</div>
        ) : page.error ? (
          <div className="text-rose-400">error: {(page.error as Error).message}</div>
        ) : page.data ? (
          <WikiPage detail={page.data} onNavigate={selectPath} />
        ) : (
          <div className="text-zinc-500">select a page</div>
        )}
      </div>
    </div>
  );
}
