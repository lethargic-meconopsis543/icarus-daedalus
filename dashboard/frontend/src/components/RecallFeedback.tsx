import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, type Recall } from "../api/client";

type Props = { recall: Recall; invalidateKeys?: QueryKey[] };

export default function RecallFeedback({ recall, invalidateKeys = [] }: Props) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: ({ value }: { value: boolean | null }) => api.rateRecall(recall.id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", recall.agent_id ?? ""] });
      qc.invalidateQueries({ queryKey: ["fleet"] });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });

  const base = "px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors";
  const on = "bg-zinc-100 text-zinc-900";
  const off = "text-zinc-500 hover:text-zinc-200";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); mut.mutate({ value: recall.was_useful === true ? null : true }); }}
        className={`${base} ${recall.was_useful === true ? on : off}`}
        title="mark useful"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); mut.mutate({ value: recall.was_useful === false ? null : false }); }}
        className={`${base} ${recall.was_useful === false ? on : off}`}
        title="mark not useful"
      >
        ↓
      </button>
    </div>
  );
}
