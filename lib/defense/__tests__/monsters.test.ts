import { describe, it, expect } from "vitest";
import { DEFENSE_MONSTERS, DEFENSE_MONSTERS_BY_ID } from "@/lib/defense/monsters";

// 기획(GM안내-디펜스.md §4 몬스터): 총 6종 24마리.
//  이름            HP  잔여시간  포인트  마릿수
//  스컬 스파이더    1     2        2      6
//  종이 연구원      5     5        3      4
//  복싱 팩맨        9     5        9      5
//  슬렌더맨        11     3       12      4
//  문어의 악마     13     2       16      3
//  서브웨이맨      15     6       21      2
describe("디펜스 몬스터 정의 (기획 일치)", () => {
  it("6종이 정의되어 있다", () => {
    expect(DEFENSE_MONSTERS).toHaveLength(6);
  });

  it("총 마릿수는 24마리", () => {
    const total = DEFENSE_MONSTERS.reduce((s, m) => s + m.baseCount, 0);
    expect(total).toBe(24);
  });

  it("id 1~6 이 순서대로 매겨져 있다", () => {
    expect(DEFENSE_MONSTERS.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  const expected = [
    { id: 1, maxHp: 1, baseTime: 2, points: 2, baseCount: 6 },
    { id: 2, maxHp: 5, baseTime: 5, points: 3, baseCount: 4 },
    { id: 3, maxHp: 9, baseTime: 5, points: 9, baseCount: 5 },
    { id: 4, maxHp: 11, baseTime: 3, points: 12, baseCount: 4 },
    { id: 5, maxHp: 13, baseTime: 2, points: 16, baseCount: 3 },
    { id: 6, maxHp: 15, baseTime: 6, points: 21, baseCount: 2 },
  ];

  for (const e of expected) {
    it(`몬스터 ${e.id}: HP ${e.maxHp}, 시간 ${e.baseTime}, 점수 ${e.points}, 수 ${e.baseCount}`, () => {
      const m = DEFENSE_MONSTERS_BY_ID[e.id];
      expect(m).toBeDefined();
      expect(m.maxHp).toBe(e.maxHp);
      expect(m.baseTime).toBe(e.baseTime);
      expect(m.points).toBe(e.points);
      expect(m.baseCount).toBe(e.baseCount);
    });
  }

  it("포인트는 id 오름차순으로 단조 증가한다 (깊은 몬스터일수록 고득점)", () => {
    const pts = DEFENSE_MONSTERS.map((m) => m.points);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]).toBeGreaterThan(pts[i - 1]);
    }
  });

  it("BY_ID 조회는 정의와 동일한 객체를 가리킨다", () => {
    for (const m of DEFENSE_MONSTERS) {
      expect(DEFENSE_MONSTERS_BY_ID[m.id]).toBe(m);
    }
  });
});
