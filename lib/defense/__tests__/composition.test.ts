import { describe, it, expect } from "vitest";
import {
  recommendedMonsterCounts,
  DEFENSE_PLAYER_MIN,
  DEFENSE_PLAYER_MAX,
} from "@/lib/defense/composition";

// 기획: 총 마릿수 = 인원 × 3, 원본 비율 유지.
describe("recommendedMonsterCounts (인원별 몬스터 조합)", () => {
  it("총 마릿수 = 인원 × 3 (7~12명)", () => {
    for (let n = DEFENSE_PLAYER_MIN; n <= DEFENSE_PLAYER_MAX; n += 1) {
      const counts = recommendedMonsterCounts(n);
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      expect(total).toBe(n * 3);
    }
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
    expect(recommendedMonsterCounts(6)).toEqual(recommendedMonsterCounts(7));
    expect(recommendedMonsterCounts(20)).toEqual(recommendedMonsterCounts(12));
    expect(recommendedMonsterCounts(0)).toEqual(recommendedMonsterCounts(8));
  });
});
