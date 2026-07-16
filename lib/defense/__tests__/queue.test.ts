import { describe, it, expect } from "vitest";
import { computeQueueSize } from "@/lib/defense/queue";

// 기획: 대기열 칸 수 = 7~9명 4칸 / 10~12명 5칸.
describe("computeQueueSize (인원별 대기열 칸 수)", () => {
  it("7~9명은 4칸", () => {
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
    // 소수/6명 이하는 하한(4), 13명 이상은 상한(5)
    expect(computeQueueSize(6)).toBe(4);
    expect(computeQueueSize(13)).toBe(5);
    expect(computeQueueSize(0)).toBe(4);
    expect(computeQueueSize(-3)).toBe(4);
    expect(computeQueueSize(NaN)).toBe(4);
  });
});
