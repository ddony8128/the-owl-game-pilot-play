import { describe, expect, it } from "vitest";
import { groupPriceChanges, holdingsValue, isMafiaJob } from "../boardSummary";

describe("groupPriceChanges — 주가 히스토리를 (라운드, 단계) 묶음으로", () => {
  it("거래 정산(meta 없음)은 apply, 투표 결과(source=vote_*)는 vote 로 묶이고 id 순서를 지킨다", () => {
    const g = groupPriceChanges([
      { id: 1, stock_key: "부엉교육", round_number: 1, price_before: 5, price_after: 7, meta: {} },
      { id: 2, stock_key: "국채", round_number: 1, price_before: 5, price_after: 5, meta: {} },
      { id: 3, stock_key: "국채", round_number: 1, price_before: 5, price_after: 6, meta: { source: "vote_econ_mafia" } },
      { id: 4, stock_key: "부엉교육", round_number: 2, price_before: 7, price_after: 6, meta: null },
    ]);
    expect(g.map((x) => x.key)).toEqual(["1:apply", "1:vote", "2:apply"]);
    expect(g[0].items.map((i) => i.stock_key)).toEqual(["부엉교육", "국채"]);
    expect(g[1]).toMatchObject({ round: 1, phase: "vote", items: [{ stock_key: "국채", price_before: 5, price_after: 6 }] });
  });

  it("stock_key·가격이 없는 행은 버린다", () => {
    const g = groupPriceChanges([
      { id: 1, stock_key: null, round_number: 1, price_before: 5, price_after: 7, meta: {} },
      { id: 2, stock_key: "국채", round_number: null, price_before: 5, price_after: 7, meta: {} },
      { id: 3, stock_key: "국채", round_number: 1, price_before: null, price_after: 7, meta: {} },
    ]);
    expect(g).toEqual([]);
  });

  it("묶음에는 직업·현금 같은 비공개 키가 없다(공개 정보만)", () => {
    const g = groupPriceChanges([
      { id: 1, stock_key: "국채", round_number: 3, price_before: 5, price_after: 6, meta: { source: "vote_econ_mafia" } },
    ]);
    expect(JSON.stringify(g)).not.toMatch(/mafia|job|cash|is_mafia/);
  });
});

describe("holdingsValue / isMafiaJob", () => {
  it("보유 수량 × 현재가, 0 이하·알 수 없는 종목은 0", () => {
    const prices = new Map([
      ["부엉교육", 7],
      ["국채", 5],
    ]);
    expect(holdingsValue({ 부엉교육: { amount: 2 }, 국채: { amount: 0 }, 없음: { amount: 3 } }, prices)).toBe(14);
    expect(holdingsValue(null, prices)).toBe(0);
    expect(holdingsValue("x", prices)).toBe(0);
  });
  it("마피아 직업 판정", () => {
    expect(isMafiaJob("robber")).toBe(true);
    expect(isMafiaJob("up_manipulator")).toBe(true);
    expect(isMafiaJob("police")).toBe(false);
    expect(isMafiaJob(null)).toBe(false);
  });
});
