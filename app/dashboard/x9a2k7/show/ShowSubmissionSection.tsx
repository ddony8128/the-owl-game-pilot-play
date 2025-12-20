import { useMemo } from "react";
import type { QuizQuestion, QuizSubmission } from "@/lib/types";

type Props = {
  subs: QuizSubmission[];
  playerNames: Record<string, string>;
  questions: QuizQuestion[];
  onUpdateResult: (id: number, result: string) => void;
};

export function ShowSubmissionSection({
  subs,
  playerNames,
  questions,
  onUpdateResult,
}: Props) {
  const byId = new Map<number, QuizQuestion>();
  for (const q of questions) {
    byId.set(q.id, q);
  }

  const orderedSubs = useMemo(() => [...subs].slice().reverse(), [subs]);

  return (
    <section className="flex flex-1 flex-col gap-2 text-xs">
      <h2 className="text-base font-semibold">제출 현황 / 채점</h2>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-2">
        {orderedSubs.map((s) => {
          const qid = s.question_id ?? null;
          const q = typeof qid === "number" ? byId.get(qid) ?? null : null;
          return (
            <div key={s.id} className="rounded bg-zinc-950 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span>
                  {playerNames[s.player_id ?? ""] ?? s.player_id} / Q
                  {s.question_id}
                </span>
                <span className="text-base text-zinc-500">
                  result: {s.result ?? "-"}
                </span>
              </div>
              {q && (
                <div className="mb-1 text-[11px] text-zinc-400">
                  <div className="font-semibold">문제 {q.id}</div>
                  <div className="text-zinc-300">{q.question}</div>
                  {Array.isArray(q.options) &&
                    (q.options as string[]).length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-[11px] text-zinc-400">
                        {(q.options as string[]).map((opt, idx) => (
                          <li key={idx}>{opt}</li>
                        ))}
                      </ul>
                    )}
                  {q.correct_answer && (
                    <div className="mt-1 text-[11px] text-emerald-300">
                      정답: {q.correct_answer}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-zinc-200">{s.answer}</p>
              {s.used_chance && (
                <div className="mt-1 text-[11px] text-sky-300">
                  사용 찬스:{" "}
                  {s.used_chance === "peek"
                    ? "컨닝"
                    : s.used_chance === "bet"
                    ? "베팅"
                    : s.used_chance === "safe"
                    ? "무산"
                    : s.used_chance}
                </div>
              )}
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
          );
        })}
        {subs.length === 0 && (
          <p className="text-zinc-400">아직 제출된 답안이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
