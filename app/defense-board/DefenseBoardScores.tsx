"use client";

import { RankingReveal, type RankingRow } from "@/components/board/RankingReveal";
import type { BoardScore } from "./types";

type Props = {
  scores: BoardScore[];
  /** 최종 발표에서는 동점 기준인 누적 피해도 같이 보여 준다 */
  showDamage?: boolean;
  onDone?: () => void;
};

/** 점수 발표 — rank 는 서버(board-scores → lib/defense/rank.ts)가 매긴 값을 그대로 쓴다. 꼴찌부터 공개. */
export function DefenseBoardScores({ scores, showDamage, onDone }: Props) {
  if (scores.length === 0) {
    return (
      <p className="text-[clamp(1rem,2.6vh,1.6rem)] text-zinc-400" data-testid="board-score-empty">
        아직 점수 정보가 없습니다.
      </p>
    );
  }
  const rows: RankingRow[] = scores.map((s) => ({
    id: s.playerId,
    rank: s.rank,
    tieCount: s.tieCount,
    name: s.nickname ?? s.playerId,
    right: `${s.points}점`,
    sub: showDamage ? `누적 피해 ${s.damage}` : undefined,
  }));
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center" data-testid="board-scores">
      <RankingReveal rows={rows} onDone={onDone} heightVh={66} />
      {showDamage ? (
        <p className="mt-[1.2vh] flex-none text-center text-[clamp(0.75rem,1.7vh,1.1rem)] text-zinc-500">
          점수 → 동점이면 본게임 전투에 낸 카드 숫자의 합(누적 피해)이 큰 쪽 → 그래도 같으면 공동 순위
        </p>
      ) : null}
    </div>
  );
}
