type Props = {
  label: string;
  value: string | number;
  hint?: string;
  muted?: boolean;
};

export default function MetricTile({ label, value, hint, muted }: Props) {
  return (
    <div className={`rounded-lg border ${muted ? "border-zinc-900 bg-zinc-950/40" : "border-zinc-800 bg-zinc-900/40"} px-4 py-3`}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl ${muted ? "text-zinc-400" : "text-zinc-100"}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}
