import { describe, expect, it } from "vitest";
import {
  MAFIA_MIN_PLAYERS,
  MAFIA_RECOMMENDED_MAX,
  MAFIA_RECOMMENDED_MIN,
  MAFIA_WARN_FROM,
  checkDefenseAdvance,
  checkMafiaStart,
} from "@/lib/admin/headcount";

// Iteration 5 계약: 마피아 권장 6~12, 5명 미만 시작 불가, 13명 이상 경고. 디펜스 6명 미만 경고(차단 없음).
describe("checkMafiaStart", () => {
  it("상수가 계약과 같다", () => {
    expect(MAFIA_MIN_PLAYERS).toBe(5);
    expect(MAFIA_RECOMMENDED_MIN).toBe(6);
    expect(MAFIA_RECOMMENDED_MAX).toBe(12);
    expect(MAFIA_WARN_FROM).toBe(13);
  });

  it("0~4명은 차단(사유 포함)", () => {
    for (const n of [0, 1, 4]) {
      const c = checkMafiaStart(n);
      expect(c.ok).toBe(false);
      expect(c.block).toContain("5명 이상");
      expect(c.block).toContain(`현재 ${n}명`);
    }
  });

  it("5명은 시작 가능하지만 권장 미만 경고", () => {
    const c = checkMafiaStart(5);
    expect(c.ok).toBe(true);
    expect(c.block).toBeUndefined();
    expect(c.warn).toContain("권장 인원");
  });

  it("6~12명은 경고 없음", () => {
    for (let n = 6; n <= 12; n += 1) {
      expect(checkMafiaStart(n)).toEqual({ ok: true });
    }
  });

  it("13명 이상은 진행 가능 + 경고", () => {
    for (const n of [13, 20]) {
      const c = checkMafiaStart(n);
      expect(c.ok).toBe(true);
      expect(c.warn).toContain("13명 이상");
    }
  });

  it("비정상 입력(NaN·음수)은 0명으로 취급해 차단", () => {
    expect(checkMafiaStart(Number.NaN).ok).toBe(false);
    expect(checkMafiaStart(-3).ok).toBe(false);
  });
});

describe("checkDefenseAdvance", () => {
  it("6명 미만은 차단 없이 경고만", () => {
    const c = checkDefenseAdvance(4);
    expect(c.ok).toBe(true);
    expect(c.warn).toContain("4명");
    expect(c.warn).toContain("6~12명");
  });
  it("6~12명은 경고 없음, 13명 이상은 경고", () => {
    expect(checkDefenseAdvance(6)).toEqual({ ok: true });
    expect(checkDefenseAdvance(12)).toEqual({ ok: true });
    expect(checkDefenseAdvance(13).warn).toContain("권장 범위");
  });
});
