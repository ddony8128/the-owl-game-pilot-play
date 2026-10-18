import { DEFENSE_MONSTERS, type DefenseMonsterDefinition } from "@/lib/defense/monsters";

// 디펜스 대기열 칸 수는 참가 인원에 따라 유동적으로 정해진다.
//  - 6~9명  : 4칸 (원본 설계 기준 7~9 · 2026-10-16 6명 추가)
//  - 10~12명 : 5칸
// 범위(6~12) 밖 값도 안전하게 clamp 한다.
export const DEFENSE_QUEUE_MIN = 4;
export const DEFENSE_QUEUE_MAX = 5;

export function computeQueueSize(playerCount: number): number {
  if (!Number.isFinite(playerCount) || playerCount <= 0) {
    return DEFENSE_QUEUE_MIN;
  }
  return playerCount >= 10 ? DEFENSE_QUEUE_MAX : DEFENSE_QUEUE_MIN;
}

/**
 * 대기열 빈 칸에 올릴 몬스터 하나를 고른다(ITER6 C3 — initGame·advanceRound 의 같은 규칙을 순수 함수로 분리, 동작 불변).
 * 규칙: 풀에 남은 종류 중 **대기열에 이미 있는 종류(exclude)가 아닌 것**에서 무작위로 고르고,
 * 그런 종류가 없을 때만 남은 종류 전체에서 고른다 → "대기열에는 같은 종류가 최대한 겹치지 않게 나온다".
 * 풀이 비었으면 null.
 */
export function pickQueueMonster(
  counts: Map<number, number>,
  exclude: Set<number>,
  rand: () => number = Math.random,
  defs: readonly DefenseMonsterDefinition[] = DEFENSE_MONSTERS,
): DefenseMonsterDefinition | null {
  let pool = defs.filter((m) => (counts.get(m.id) ?? 0) > 0 && !exclude.has(m.id));
  // 남은 겹치지 않는 몬스터가 없다면, 단순히 남은 몬스터 중에서 선택
  if (pool.length === 0) pool = defs.filter((m) => (counts.get(m.id) ?? 0) > 0);
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)] ?? null;
}
