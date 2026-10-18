// ITER6 A6 — 디펜스 폰의 최종 결과 안내(순수 함수). 등수는 보드와 같은 /api/defense/board-scores(rankPlayers) 결과에서
// 내 행만 고른다. 순위 번호를 따로 매기지 않는다(순위 계산은 lib/defense/rank.ts 한 곳뿐).
import { rankLabel } from "@/lib/defense/rank";

export type FinalScoreRow = {
  playerId: string;
  nickname: string | null;
  points: number;
  rank: number;
  tieCount: number;
};

export type FinalSummary = {
  points: number;
  rank: number;
  tieCount: number;
  total: number;
  rankText: string;
};

/** 내 행이 없으면(아직 집계 전·강퇴) null. */
export function finalSummaryFor(rows: readonly FinalScoreRow[], playerId: string): FinalSummary | null {
  const me = rows.find((r) => r.playerId === playerId);
  if (!me) return null;
  return {
    points: me.points,
    rank: me.rank,
    tieCount: me.tieCount,
    total: rows.length,
    rankText: rankLabel(me.rank, me.tieCount),
  };
}

/** 조기 종료 문장 — endedEarlyFrom 은 DB 라운드(본게임 4~15). 본게임 N라운드 = DB − 3. 조기 종료가 아니면 null. */
export function earlyEndSentence(endedEarlyFrom: number | null | undefined): string | null {
  if (typeof endedEarlyFrom !== "number" || endedEarlyFrom < 4 || endedEarlyFrom > 15) return null;
  return `대기열과 남은 몬스터가 모두 사라져 본게임 ${endedEarlyFrom - 3}라운드에서 게임이 끝났습니다.`;
}
