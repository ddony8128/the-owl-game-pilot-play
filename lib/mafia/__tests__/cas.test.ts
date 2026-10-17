import { describe, expect, it } from "vitest";
import { casUpdate, computeTrade, computeVoteCost, normalizeStocks, type CasReadState } from "@/lib/mafia/cas";

// Iteration 5 WS-B — 현금/주식 CAS(lost update 방지). 동시 요청 20건을 "가짜 DB"로 흉내 내 차감이 전부 반영되는지 본다.
function fakeDb(initial: CasReadState) {
  let row: CasReadState = { cash: initial.cash, stocks: { ...initial.stocks } };
  return {
    get: () => row,
    read: async () => ({ cash: row.cash, stocks: { ...row.stocks } }),
    write: async (expectCash: number, next: CasReadState) => {
      // 비동기 틱을 끼워 넣어 요청들이 서로 끼어들게 한다
      await new Promise((r) => setTimeout(r, Math.random() * 3));
      if (row.cash !== expectCash) return { updated: 0, error: null };
      row = { cash: next.cash, stocks: { ...next.stocks } };
      return { updated: 1, error: null };
    },
  };
}

describe("computeTrade / computeVoteCost (순수)", () => {
  it("매수: 현금 부족이면 거부, 아니면 차감 + 보유 증가", () => {
    const cur: CasReadState = { cash: 12, stocks: {} };
    expect(computeTrade(cur, { type: "buy", stockKey: "A", amount: 3, price: 5 })).toMatchObject({ ok: false });
    const ok = computeTrade(cur, { type: "buy", stockKey: "A", amount: 2, price: 5 });
    expect(ok.ok && ok.next).toEqual({ cash: 2, stocks: { A: { amount: 2 } } });
  });
  it("매도: 보유 초과 거부, 아니면 현금 증가 + 보유 감소", () => {
    const cur: CasReadState = { cash: 0, stocks: { A: { amount: 2 } } };
    expect(computeTrade(cur, { type: "sell", stockKey: "A", amount: 3, price: 5 })).toMatchObject({ ok: false });
    const ok = computeTrade(cur, { type: "sell", stockKey: "A", amount: 2, price: 5 });
    expect(ok.ok && ok.next).toEqual({ cash: 10, stocks: { A: { amount: 0 } } });
  });
  it("투표 비용", () => {
    expect(computeVoteCost({ cash: 3, stocks: {} }, 4)).toMatchObject({ ok: false });
    expect(computeVoteCost({ cash: 3, stocks: {} }, 3)).toMatchObject({ ok: true, next: { cash: 0 } });
  });
  it("stocks jsonb 정규화", () => {
    expect(normalizeStocks(null)).toEqual({});
    expect(normalizeStocks({ A: { amount: 2 }, B: { amount: "x" }, C: null })).toEqual({ A: { amount: 2 }, B: { amount: 0 }, C: { amount: 0 } });
  });
});

describe("casUpdate — 동시 20건", () => {
  it("매수 20건(현금 30, 주당 5) → 정확히 6건 적용, 14건 현금 부족, 최종 현금 0·6주", async () => {
    const db = fakeDb({ cash: 30, stocks: {} });
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        casUpdate({
          read: db.read,
          write: db.write,
          compute: (cur) => computeTrade(cur, { type: "buy", stockKey: "A", amount: 1, price: 5 }),
          maxAttempts: 50,
        }),
      ),
    );
    const applied = results.filter((r) => r.status === "applied").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(applied).toBe(6);
    expect(rejected).toBe(14);
    expect(db.get()).toEqual({ cash: 0, stocks: { A: { amount: 6 } } });
  });

  it("투표 20건(현금 10, 표값 1) → 10건 적용, 현금 0 (음수 금지)", async () => {
    const db = fakeDb({ cash: 10, stocks: {} });
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        casUpdate({ read: db.read, write: db.write, compute: (cur) => computeVoteCost(cur, 1), maxAttempts: 50 }),
      ),
    );
    expect(results.filter((r) => r.status === "applied").length).toBe(10);
    expect(db.get().cash).toBe(0);
  });

  it("행이 없으면 missing, 재시도 한도를 넘기면 exhausted", async () => {
    expect(await casUpdate({ read: async () => null, write: async () => ({ updated: 1, error: null }), compute: (c) => ({ ok: true, next: c, extra: null }) })).toEqual({ status: "missing" });
    const r = await casUpdate({
      read: async () => ({ cash: 1, stocks: {} }),
      write: async () => ({ updated: 0, error: null }),
      compute: (c) => ({ ok: true, next: c, extra: null }),
      maxAttempts: 3,
    });
    expect(r).toEqual({ status: "exhausted", attempts: 3 });
  });

  it("음성 대조: CAS 없이 '읽은 값으로 덮어쓰기'를 하면 차감이 유실된다", async () => {
    // 옛 방식(read → compute → 무조건 write)을 흉내 내면 20건 중 다수가 서로 덮어써 현금이 0이 되지 않는다.
    let cash = 30;
    const naive = async () => {
      const cur = cash;
      await new Promise((r) => setTimeout(r, Math.random() * 3));
      if (cur - 5 < 0) return false;
      cash = cur - 5; // 덮어쓰기
      return true;
    };
    const ok = (await Promise.all(Array.from({ length: 20 }, naive))).filter(Boolean).length;
    // 20건이 모두 "현금 30"을 읽었으니 전부 성공 처리되고 현금은 25 — 전형적인 lost update
    expect(ok).toBeGreaterThan(6);
    expect(cash).not.toBe(0);
  });
});
