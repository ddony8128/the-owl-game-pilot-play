import { describe, it, expect } from "vitest";
import {
  recommendedMonsterCounts,
  DEFENSE_PLAYER_MIN,
  DEFENSE_PLAYER_MAX,
} from "@/lib/defense/composition";

// 기획: 총 마릿수 = 인원 × 3, 원본 비율 유지.
describe("recommendedMonsterCounts (인원별 몬스터 조합)", () => {
  it("총 마릿수 = 인원 × 3 (6~12명)", () => {
    for (let n = DEFENSE_PLAYER_MIN; n <= DEFENSE_PLAYER_MAX; n += 1) {
      const counts = recommendedMonsterCounts(n);
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      expect(total).toBe(n * 3);
    }
  });

  it("6명은 18마리(4·3·4·3·2·2) — 2026-10-16 추가", () => {
    expect(recommendedMonsterCounts(6)).toEqual({ 1: 4, 2: 3, 3: 4, 4: 3, 5: 2, 6: 2 });
  });

  it("8명은 원본 조합(6·4·5·4·3·2)", () => {
    expect(recommendedMonsterCounts(8)).toEqual({
      1: 6,
      2: 4,
      3: 5,
      4: 4,
      5: 3,
      6: 2,
    });
  });

  it("12명은 5칸 대응 조합, 총 36마리", () => {
    const c = recommendedMonsterCounts(12);
    expect(c).toEqual({ 1: 9, 2: 6, 3: 7, 4: 6, 5: 5, 6: 3 });
    expect(Object.values(c).reduce((s, v) => s + v, 0)).toBe(36);
  });

  it("범위 밖은 경계 행으로 clamp, 인원 정보 없으면 8명 기준", () => {
    expect(recommendedMonsterCounts(5)).toEqual(recommendedMonsterCounts(6));
    expect(recommendedMonsterCounts(20)).toEqual(recommendedMonsterCounts(12));
    expect(recommendedMonsterCounts(0)).toEqual(recommendedMonsterCounts(8));
  });
});

import { roomMonsterTotals } from "@/lib/defense/composition";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";

describe("roomMonsterTotals — 도감 '전체 n마리'", () => {
  const seed = DEFENSE_MONSTERS.map((m) => ({ id: m.id, base_count: m.baseCount }));
  it("시작 전·구성 미변경이면 지금 입장 인원 기준 권장 구성", () => {
    expect(roomMonsterTotals(seed, DEFENSE_MONSTERS, 0, 6)).toEqual({ 1: 4, 2: 3, 3: 4, 4: 3, 5: 2, 6: 2 });
    expect(roomMonsterTotals([], DEFENSE_MONSTERS, null, 6)).toEqual({ 1: 4, 2: 3, 3: 4, 4: 3, 5: 2, 6: 2 });
  });
  it("시작 뒤에는 방에 저장된 base_count", () => {
    const saved = [1, 2, 3, 4, 5, 6].map((id) => ({ id, base_count: id }));
    expect(roomMonsterTotals(saved, DEFENSE_MONSTERS, 4, 6)).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 });
  });
  it("시작 전이라도 GM이 구성을 바꿨으면 그 값", () => {
    const edited = seed.map((r) => (r.id === 1 ? { ...r, base_count: 1 } : r));
    expect(roomMonsterTotals(edited, DEFENSE_MONSTERS, 0, 6)[1]).toBe(1);
  });
});
