import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WikiPageDetail } from "../api/client";
import { timeAgo } from "../lib/format";

type Props = { detail: WikiPageDetail; onNavigate: (path: string) => void };

function rewriteBody(body: string, resolve: (target: string) => string | null): string {
  return body.replace(/\[\[([^\[\]]+?)\]\]/g, (_, raw) => {
    const target = String(raw).trim();
    const label = target.includes("/") ? target.split("/").pop()! : target;
    const path = resolve(target);
    if (path) return `[${label}](icarus://${encodeURIComponent(path)})`;
    return `[${label}](icarus-missing://${encodeURIComponent(target)})`;
  });
}

export default function WikiPage({ detail, onNavigate }: Props) {
  const resolver = useMemo(() => {
    const map = new Map<string, string>();
    detail.forward_links.forEach((l) => {
      if (l.path) map.set(l.target, l.path);
    });
    return (target: string) => map.get(target) ?? null;
  }, [detail.forward_links]);

  const body = useMemo(() => rewriteBody(detail.body_md, resolver), [detail.body_md, resolver]);

  return (
    <div className="flex-1 min-w-0 space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono truncate">{detail.path}</div>
          <h1 className="mt-1 text-xl text-zinc-100 truncate">{detail.title}</h1>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">{timeAgo(detail.updated_at)}</span>
      </header>

      <article className="wiki-body text-sm text-zinc-200 leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              if (href?.startsWith("icarus://")) {
                const path = decodeURIComponent(href.slice("icarus://".length));
                return (
                  <button
                    type="button"
                    className="text-sky-300 hover:text-sky-200 underline decoration-sky-500/40"
                    onClick={(e) => { e.preventDefault(); onNavigate(path); }}
                  >
                    {children}
                  </button>
                );
              }
              if (href?.startsWith("icarus-missing://")) {
                return <span className="text-zinc-500 underline decoration-dashed" title="page not found">{children}</span>;
              }
              return <a href={href} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 underline decoration-sky-500/40">{children}</a>;
            },
            h1: ({ children }) => <h2 className="mt-4 mb-2 text-lg text-zinc-100">{children}</h2>,
            h2: ({ children }) => <h3 className="mt-4 mb-2 text-base text-zinc-100">{children}</h3>,
            h3: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-medium text-zinc-200">{children}</h4>,
            ul: ({ children }) => <ul className="list-disc ml-5 space-y-0.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-5 space-y-0.5">{children}</ol>,
            code: ({ children }) => <code className="font-mono bg-zinc-900/70 text-zinc-200 px-1 py-0.5 rounded text-[12px]">{children}</code>,
            pre: ({ children }) => <pre className="bg-zinc-900/70 border border-zinc-800 rounded p-3 overflow-x-auto text-[12px] my-2">{children}</pre>,
            blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-700 pl-3 text-zinc-400 italic">{children}</blockquote>,
            p: ({ children }) => <p className="my-2">{children}</p>,
          }}
        >
          {body}
        </ReactMarkdown>
      </article>

      {detail.backlinks.length > 0 ? (
        <section className="pt-4 border-t border-zinc-800">
          <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Backlinks</h4>
          <ul className="space-y-1 text-sm">
            {detail.backlinks.map((b) => (
              <li key={b.path}>
                <button type="button" className="text-sky-300 hover:text-sky-200" onClick={() => onNavigate(b.path)}>
                  {b.title}
                </button>
                <span className="ml-2 text-[11px] font-mono text-zinc-500">{b.path}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
