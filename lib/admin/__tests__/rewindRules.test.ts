import { describe, expect, it } from "vitest";
import {
  decideDefenseRewind,
  decideMafiaRewind,
  isSettlementLog,
  parseAwardedPoints,
  parseExpiredPenaltyValue,
  planDefenseRewind,
  resolvePenaltyCard,
} from "@/lib/admin/rewindRules";

// Iteration 5 계약 — 되돌리기 가능 판정.
describe("planDefenseRewind", () => {
  it("1→0, 4→3 은 초기화 전환 되돌리기", () => {
    expect(planDefenseRewind(1)).toEqual({ kind: "init", from: 1, to: 0 });
    expect(planDefenseRewind(4)).toEqual({ kind: "init", from: 4, to: 3 });
  });
  it("그 외는 N-1 정산 되돌리기(2·3·5~16)", () => {
    expect(planDefenseRewind(2)).toEqual({ kind: "settlement", from: 2, to: 1 });
    expect(planDefenseRewind(3)).toEqual({ kind: "settlement", from: 3, to: 2 });
    expect(planDefenseRewind(5)).toEqual({ kind: "settlement", from: 5, to: 4 });
    expect(planDefenseRewind(16)).toEqual({ kind: "settlement", from: 16, to: 15 });
  });
  it("준비(0)·범위 밖은 불가", () => {
    expect(planDefenseRewind(0)).toBeNull();
    expect(planDefenseRewind(17)).toBeNull();
    expect(planDefenseRewind(2.5)).toBeNull();
  });
});

describe("decideDefenseRewind", () => {
  it("현재 라운드 제출 0건이면 가능", () => {
    const d = decideDefenseRewind({ round: 5, actionsAtCurrentRound: 0 });
    expect(d.ok).toBe(true);
  });
  it("현재 라운드에 제출이 있으면 409 사유", () => {
    const d = decideDefenseRewind({ round: 5, actionsAtCurrentRound: 2 });
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.reason).toBe("not_rewindable");
      expect(d.error).toContain("2명");
    }
  });
  it("준비 단계는 불가", () => {
    const d = decideDefenseRewind({ round: 0, actionsAtCurrentRound: 0 });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.error).toContain("준비");
  });
});

describe("정산 로그 파싱", () => {
  it("처치 점수 로그에서 1인당 점수를 읽는다", () => {
    expect(
      parseAwardedPoints("전투: 복싱 팩맨 처치에 참여해, 총 3명이 나누어 1인당 3점을 획득했습니다."),
    ).toBe(3);
    expect(parseAwardedPoints("전투: 스컬 스파이더에게 총 2 피해를 입혔습니다. (남은 HP: 0)")).toBeNull();
    expect(
      parseAwardedPoints("전투: 종이 연구원 처치에 참여했지만, 분배 가능한 점수가 없어 포인트는 얻지 못했습니다."),
    ).toBeNull();
  });
  it("도망 페널티 로그에서 카드 값을 읽는다", () => {
    expect(parseExpiredPenaltyValue("문어의 악마의 시간이 만료되어, 가장 큰 활성 카드(값 4)가 비활성화되었습니다.")).toBe(4);
    expect(parseExpiredPenaltyValue("문어의 악마이(가) 쓰러졌습니다.")).toBeNull();
  });
  it("제출 시점 로그(훈련:/휴식:)는 정산 로그가 아니다", () => {
    expect(isSettlementLog("훈련: 값 1 카드를 비활성화하고 값 4 카드를 5로 강화했습니다.")).toBe(false);
    expect(isSettlementLog("휴식: 1, 2 카드를 다시 활성화했습니다.")).toBe(false);
    expect(isSettlementLog("전투: 복싱 팩맨에게 총 5 피해를 입혔습니다. (남은 HP: 4)")).toBe(true);
    expect(isSettlementLog("슬렌더맨이(가) 쓰러졌습니다.")).toBe(true);
    expect(isSettlementLog("스컬 스파이더의 시간이 만료되어, 가장 큰 활성 카드(값 3)가 비활성화되었습니다.")).toBe(true);
  });
});

describe("resolvePenaltyCard", () => {
  const cards = (spec: [number, number, boolean][]) =>
    spec.map(([card_slot, card_value, is_active]) => ({ card_slot, card_value, is_active }));
  it("값이 같은 비활성 카드가 1장이면 그 슬롯", () => {
    const r = resolvePenaltyCard(cards([[1, 1, true], [2, 2, true], [3, 3, false], [4, 4, false]]), 4);
    expect(r).toEqual({ ok: true, slot: 4 });
  });
  it("전투에 쓴 4 + 페널티 3 — 값 3 비활성 카드 1장 → 슬롯 3", () => {
    const r = resolvePenaltyCard(cards([[1, 1, true], [2, 2, true], [3, 3, false], [4, 4, false]]), 3);
    expect(r).toEqual({ ok: true, slot: 3 });
  });
  it("훈련으로 값이 같아진 비활성 카드 2장은 확정 불가(409 사유)", () => {
    const r = resolvePenaltyCard(cards([[1, 1, true], [2, 3, false], [3, 3, false], [4, 4, true]]), 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2장");
  });
  it("해당 값의 비활성 카드가 없으면 실패", () => {
    expect(resolvePenaltyCard(cards([[1, 1, true], [2, 2, true]]), 4).ok).toBe(false);
  });
});

describe("decideMafiaRewind", () => {
  it("auction→prepare / trade→auction / vote→apply 만 가능", () => {
    expect(decideMafiaRewind({ phase: "auction", submissionsInPhase: 0 })).toEqual({
      ok: true,
      plan: { from: "auction", to: "prepare" },
    });
    expect(decideMafiaRewind({ phase: "trade", submissionsInPhase: 0 })).toEqual({
      ok: true,
      plan: { from: "trade", to: "auction" },
    });
    expect(decideMafiaRewind({ phase: "vote", submissionsInPhase: 0 })).toEqual({
      ok: true,
      plan: { from: "vote", to: "apply" },
    });
  });
  it("apply·end·prepare 는 409", () => {
    for (const phase of ["apply", "end", "prepare"] as const) {
      const d = decideMafiaRewind({ phase, submissionsInPhase: 0 });
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.reason).toBe("not_rewindable");
    }
  });
  it("현재 페이즈에 제출이 있으면 409 + 종류별 사유", () => {
    const a = decideMafiaRewind({ phase: "auction", submissionsInPhase: 3 });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error).toContain("입찰");
    const v = decideMafiaRewind({ phase: "vote", submissionsInPhase: 1 });
    if (!v.ok) expect(v.error).toContain("투표");
  });
});
