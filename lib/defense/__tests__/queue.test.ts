import { describe, it, expect } from "vitest";
import { computeQueueSize, pickQueueMonster } from "@/lib/defense/queue";

// 기획: 대기열 칸 수 = 6~9명 4칸 / 10~12명 5칸 (2026-10-16 6명 추가).
describe("computeQueueSize (인원별 대기열 칸 수)", () => {
  it("6~9명은 4칸", () => {
    expect(computeQueueSize(6)).toBe(4);
    expect(computeQueueSize(7)).toBe(4);
    expect(computeQueueSize(8)).toBe(4);
    expect(computeQueueSize(9)).toBe(4);
  });

  it("10~12명은 5칸", () => {
    expect(computeQueueSize(10)).toBe(5);
    expect(computeQueueSize(11)).toBe(5);
    expect(computeQueueSize(12)).toBe(5);
  });

  it("범위 밖도 안전하게 clamp 된다", () => {
    // 소수/5명 이하는 하한(4), 13명 이상은 상한(5)
    expect(computeQueueSize(5)).toBe(4);
    expect(computeQueueSize(13)).toBe(5);
    expect(computeQueueSize(0)).toBe(4);
    expect(computeQueueSize(-3)).toBe(4);
    expect(computeQueueSize(NaN)).toBe(4);
  });
});

// ITER6 C3 — "대기열에는 같은 종류의 몬스터가 최대한 겹치지 않게 나온다"(initGame·advanceRound 공용 선택 규칙)
describe("pickQueueMonster (겹치지 않게)", () => {
  const counts = (o: Record<number, number>) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));
  it("풀에 대기열에 없는 종류가 남아 있으면, 뽑힌 몬스터는 대기열의 기존 종류와 다르다(난수 전 범위)", () => {
    const pool = counts({ 1: 5, 2: 5, 3: 5, 4: 0, 5: 1, 6: 0 });
    const inQueue = new Set([1, 3]);
    for (let i = 0; i < 100; i += 1) {
      const r = i / 100;
      const m = pickQueueMonster(pool, inQueue, () => r);
      expect(m).not.toBeNull();
      expect(inQueue.has(m!.id), `rand=${r} → ${m!.id}`).toBe(false);
      expect([2, 5]).toContain(m!.id);
    }
  });
  it("남은 종류가 전부 대기열에 있으면 그중에서 고른다(겹침 허용)", () => {
    const m = pickQueueMonster(counts({ 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), new Set([1]), () => 0.5);
    expect(m?.id).toBe(1);
  });
  it("풀이 비면 null", () => {
    expect(pickQueueMonster(counts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), new Set(), () => 0)).toBeNull();
  });
  it("대기열을 처음부터 채울 때(빈 칸 4개) 종류가 4가지 이상 남아 있으면 4칸이 모두 다른 종류", () => {
    const pool = counts({ 1: 4, 2: 3, 3: 4, 4: 3, 5: 2, 6: 2 });
    const chosen = new Set<number>();
    for (let slot = 0; slot < 4; slot += 1) {
      const m = pickQueueMonster(pool, chosen, () => 0.99)!;
      pool.set(m.id, (pool.get(m.id) ?? 0) - 1);
      chosen.add(m.id);
    }
    expect(chosen.size).toBe(4);
  });
});
