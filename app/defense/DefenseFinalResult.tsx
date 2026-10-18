"use client";

// ITER6 A6 — 16(최종 결과)에서 폰 정보 탭 맨 위에 내 최종 점수·등수와 조기 종료 안내를 보여준다.
// 등수는 보드와 같은 /api/defense/board-scores 를 읽는다(순위 계산은 서버 한 곳).
import { useMemo } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import { earlyEndSentence, finalSummaryFor, type FinalScoreRow } from "@/lib/defense/finalSummary";

type BoardScores = { round: number; scores: FinalScoreRow[] };

export function DefenseFinalResult({
  room,
  playerId,
  endedEarlyFrom,
}: {
  room: string;
  playerId: string;
  endedEarlyFrom: number | null | undefined;
}) {
  const url = `/api/defense/board-scores?${new URLSearchParams({ room, round: "16" })}`;
  const poll = usePolling<BoardScores>(url, 8000);
  const summary = useMemo(
    () => (poll.data ? finalSummaryFor(poll.data.scores ?? [], playerId) : null),
    [poll.data, playerId],
  );
  const early = earlyEndSentence(endedEarlyFrom);

  return (
    <section
      data-testid="final-result"
      className="mb-4 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-zinc-900 p-4"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">FINAL RESULT</p>
      <h2 className="mt-1 text-xl font-bold text-zinc-50">최종 결과</h2>
      {early && (
        <p data-testid="final-early" className="mt-2 text-sm leading-relaxed text-zinc-300">
          {early}
        </p>
      )}
      {summary ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-400">내 점수</p>
            <p data-testid="final-points" className="mt-1 text-3xl font-black text-amber-300">
              {summary.points}
              <span className="ml-0.5 text-base font-semibold text-zinc-300">점</span>
            </p>
          </div>
          <div className="rounded-xl bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-400">등수 · {summary.total}명 중</p>
            <p data-testid="final-rank" className="mt-1 text-3xl font-black text-zinc-50">
              {summary.rankText}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">{poll.error ? "순위를 불러오지 못했습니다." : "순위를 집계하는 중입니다…"}</p>
      )}
    </section>
  );
}
