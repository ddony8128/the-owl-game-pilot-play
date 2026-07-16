// 참가 인원(7~12명)별 권장 몬스터 조합.
//  설계 원칙: 총 마릿수 = 인원 × 3, 원본 비율(6:4:5:4:3:2) 유지.
//  → HP/인 · 점수/인 이 인원과 무관하게 거의 일정(밸런스 보존).
//  몬스터 id: 1 스컬스파이더 · 2 종이연구원 · 3 복싱팩맨 · 4 슬렌더맨 · 5 문어의악마 · 6 서브웨이맨
export type MonsterCounts = Record<number, number>;

export const DEFENSE_PLAYER_MIN = 7;
export const DEFENSE_PLAYER_MAX = 12;

const TABLE: Record<number, MonsterCounts> = {
  7: { 1: 5, 2: 3, 3: 4, 4: 4, 5: 3, 6: 2 }, // 총 21
  8: { 1: 6, 2: 4, 3: 5, 4: 4, 5: 3, 6: 2 }, // 총 24 (원본)
  9: { 1: 7, 2: 4, 3: 6, 4: 5, 5: 3, 6: 2 }, // 총 27
  10: { 1: 7, 2: 5, 3: 6, 4: 5, 5: 4, 6: 3 }, // 총 30
  11: { 1: 8, 2: 5, 3: 7, 4: 6, 5: 4, 6: 3 }, // 총 33
  12: { 1: 9, 2: 6, 3: 7, 4: 6, 5: 5, 6: 3 }, // 총 36
};

// 범위(7~12) 밖 인원은 가까운 경계 행으로 clamp 한다. 인원 정보가 없으면 기준(8명).
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
