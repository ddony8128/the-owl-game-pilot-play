// 참가 인원(6~12명)별 권장 몬스터 조합.
//  설계 원칙: 총 마릿수 = 인원 × 3, 원본 비율(6:4:5:4:3:2) 유지.
//  → HP/인 · 점수/인 이 인원과 무관하게 거의 일정(밸런스 보존).
//  몬스터 id: 1 스컬스파이더 · 2 종이연구원 · 3 복싱팩맨 · 4 슬렌더맨 · 5 문어의악마 · 6 서브웨이맨
export type MonsterCounts = Record<number, number>;

export const DEFENSE_PLAYER_MIN = 6;
export const DEFENSE_PLAYER_MAX = 12;

const TABLE: Record<number, MonsterCounts> = {
  // 2026-10-16 또니 결정 — 트레이스 세션 최소 6인. 비율 ×0.75(4.5·3·3.75·3·2.25·1.5)를 반올림,
  // 보스 서브웨이맨은 2마리 유지(7~9명과 같은 보스 경험), 스컬을 4로. 1인당 체력 24.0·점수 27.2(7명 24.1·27.6).
  6: { 1: 4, 2: 3, 3: 4, 4: 3, 5: 2, 6: 2 }, // 총 18
  7: { 1: 5, 2: 3, 3: 4, 4: 4, 5: 3, 6: 2 }, // 총 21
  8: { 1: 6, 2: 4, 3: 5, 4: 4, 5: 3, 6: 2 }, // 총 24 (원본)
  9: { 1: 7, 2: 4, 3: 6, 4: 5, 5: 3, 6: 2 }, // 총 27
  10: { 1: 7, 2: 5, 3: 6, 4: 5, 5: 4, 6: 3 }, // 총 30
  11: { 1: 8, 2: 5, 3: 7, 4: 6, 5: 4, 6: 3 }, // 총 33
  12: { 1: 9, 2: 6, 3: 7, 4: 6, 5: 5, 6: 3 }, // 총 36
};

// 범위(6~12) 밖 인원은 가까운 경계 행으로 clamp 한다. 인원 정보가 없으면 기준(8명).
export function recommendedMonsterCounts(playerCount: number): MonsterCounts {
  if (!Number.isFinite(playerCount) || playerCount <= 0) {
    return { ...TABLE[8] };
  }
  const n = Math.min(
    DEFENSE_PLAYER_MAX,
    Math.max(DEFENSE_PLAYER_MIN, Math.floor(playerCount)),
  );
  return { ...TABLE[n] };
}

/**
 * 이 방의 종류별 전체 마릿수(몬스터 도감 '전체 n마리').
 * - 튜토리얼 시작 전(round 0)이고 GM이 구성을 손대지 않았으면(base_count 가 기본값 그대로) → 지금 입장 인원 기준 권장 구성.
 *   튜토리얼을 시작하는 순간 initGame 이 같은 값으로 base_count 를 저장하므로 시작 전후 숫자가 같다.
 * - 그 밖에는 방에 저장된 base_count(인원 자동 구성 또는 GM 저장값).
 */
export function roomMonsterTotals(
  rows: readonly { id: number; base_count: number | null }[],
  defaults: readonly { id: number; baseCount: number }[],
  round: number | null,
  headcount: number,
): MonsterCounts {
  const untouched = defaults.every((m) => {
    const row = rows.find((r) => r.id === m.id);
    return !row || row.base_count == null || row.base_count === m.baseCount;
  });
  if ((round ?? 0) === 0 && untouched) return recommendedMonsterCounts(headcount);
  const out: MonsterCounts = {};
  for (const m of defaults) {
    const row = rows.find((r) => r.id === m.id);
    out[m.id] = row?.base_count ?? m.baseCount;
  }
  return out;
}
