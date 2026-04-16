import { statusColor } from "../lib/format";

export default function AgentBadge({ status }: { status: string }) {
  const cls = statusColor[status] ?? statusColor.offline;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono uppercase ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}
