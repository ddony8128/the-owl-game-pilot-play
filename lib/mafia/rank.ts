import { assignSharedRanks, type Ranked } from "@/lib/defense/rank";

/**
 * 자본주의 마피아 최종 순위 — 룰지(자본주의-마피아-룰지 §순위) 정본:
 *   총자산(현금 + 보유 주식 × 현재 주가)이 큰 사람 → 같으면 현금이 많은 쪽 → 그래도 같으면 공동 순위.
 * 등수 번호는 디펜스와 같은 assignSharedRanks 로 매긴다(1, 1, 3). 닉네임으로 가르지 않는다.
 */
export type MafiaRankInput = {
  total_assets: number;
  cash: number;
};

export const MAFIA_RANK_RULE_TEXT = "총자산 → 같으면 현금이 많은 쪽 → 그래도 같으면 공동 순위";

export function compareMafiaRank(a: MafiaRankInput, b: MafiaRankInput): number {
  if (b.total_assets !== a.total_assets) return b.total_assets - a.total_assets;
  return b.cash - a.cash;
}

export function rankMafiaPlayers<T extends MafiaRankInput>(rows: readonly T[]): Ranked<T>[] {
  return assignSharedRanks(rows, compareMafiaRank);
}
