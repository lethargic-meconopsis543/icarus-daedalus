import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function WikiBacklinks({ memoryEntryId }: { memoryEntryId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["wiki", "backlinks", memoryEntryId],
    queryFn: () => api.wikiBacklinks(memoryEntryId),
  });

  if (isLoading) return <div className="text-xs text-zinc-500">loading…</div>;
  if (!data || data.length === 0) {
    return <div className="text-xs text-zinc-600">not promoted yet</div>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {data.map((b) => (
        <li key={b.path}>
          <Link
            to={`/wiki?path=${encodeURIComponent(b.path)}`}
            className="text-sky-300 hover:text-sky-200"
          >
            {b.title}
          </Link>
          <span className="ml-2 text-[11px] font-mono text-zinc-500">{b.path}</span>
        </li>
      ))}
    </ul>
  );
}
