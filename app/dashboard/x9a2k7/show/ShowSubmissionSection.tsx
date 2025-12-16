import type { QuizSubmission } from "@/lib/types";

type Props = {
  subs: QuizSubmission[];
  playerNames: Record<string, string>;
  onUpdateResult: (id: number, result: string) => void;
};

export function ShowSubmissionSection({
  subs,
  playerNames,
  onUpdateResult,
}: Props) {
  return (
    <section className="flex flex-1 flex-col gap-2 text-xs">
      <h2 className="text-base font-semibold">제출 현황 / 채점</h2>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-2">
        {subs.map((s) => (
          <div key={s.id} className="rounded bg-zinc-950 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span>
                {playerNames[s.player_id ?? ""] ?? s.player_id} / Q
                {s.question_id}
              </span>
              <span className="text-[10px] text-zinc-500">
                result: {s.result ?? "-"}
              </span>
            </div>
            <p className="text-xs text-zinc-200">{s.answer}</p>
            <div className="mt-1 flex gap-1 text-[10px]">
              {[
                ["correct", "정답"],
                ["wrong", "오답"],
                ["skip", "스킵"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`rounded px-2 py-0.5 ${
                    s.result === value
                      ? "bg-amber-400 text-zinc-950"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                  onClick={() => onUpdateResult(s.id, value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {subs.length === 0 && (
          <p className="text-zinc-400">아직 제출된 답안이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
