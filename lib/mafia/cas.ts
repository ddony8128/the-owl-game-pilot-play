// 마피아 현금/보유주식 갱신의 lost update 방지(반면교사 1-9: 동시 매수 20건에서 차감 1건만 반영).
// RPC 없이 PostgREST 로만 하는 compare-and-swap: "읽은 cash 값일 때만 갱신" → 0행이면 다시 읽고 재계산.
// 매수·매도·투표는 모두 cash 를 바꾸므로(가격·표값 ≥ 1) cash 가 CAS 열쇠가 된다.

export type CasReadState = { cash: number; stocks: Record<string, { amount: number }> };

export type CasComputeResult<T> =
  | { ok: true; next: CasReadState; extra: T }
  | { ok: false; error: string };

export type CasDeps<T> = {
  /** 현재 상태 읽기 */
  read: () => Promise<CasReadState | null>;
  /** 읽은 상태로 다음 상태 계산(한도 검사 포함). ok:false 면 즉시 400 사유로 끝난다. */
  compute: (cur: CasReadState) => CasComputeResult<T>;
  /** cash 가 expectCash 일 때만 next 를 쓴다. 갱신된 행 수를 돌려준다. */
  write: (expectCash: number, next: CasReadState) => Promise<{ updated: number; error: string | null }>;
  maxAttempts?: number;
};

export type CasOutcome<T> =
  | { status: "applied"; next: CasReadState; extra: T; attempts: number }
  | { status: "rejected"; error: string; attempts: number }
  | { status: "missing" }
  | { status: "db_error"; error: string }
  | { status: "exhausted"; attempts: number };

export async function casUpdate<T>(deps: CasDeps<T>): Promise<CasOutcome<T>> {
  const max = deps.maxAttempts ?? 5;
  for (let attempt = 1; attempt <= max; attempt += 1) {
    const cur = await deps.read();
    if (!cur) return { status: "missing" };
    const computed = deps.compute(cur);
    if (!computed.ok) return { status: "rejected", error: computed.error, attempts: attempt };
    const w = await deps.write(cur.cash, computed.next);
    if (w.error) return { status: "db_error", error: w.error };
    if (w.updated === 1) return { status: "applied", next: computed.next, extra: computed.extra, attempts: attempt };
    // 0행 → 누군가 먼저 바꿈 → 다시 읽는다
  }
  return { status: "exhausted", attempts: max };
}

/** 매수/매도 계산(순수) */
export function computeTrade(
  cur: CasReadState,
  input: { type: "buy" | "sell"; stockKey: string; amount: number; price: number },
): CasComputeResult<{ total: number }> {
  const prevAmount = typeof cur.stocks[input.stockKey]?.amount === "number" ? cur.stocks[input.stockKey].amount : 0;
  const total = input.price * input.amount;
  if (input.type === "buy") {
    if (cur.cash - total < 0) return { ok: false, error: "현금이 부족합니다." };
    return {
      ok: true,
      next: { cash: cur.cash - total, stocks: { ...cur.stocks, [input.stockKey]: { amount: prevAmount + input.amount } } },
      extra: { total },
    };
  }
  if (prevAmount < input.amount) return { ok: false, error: "보유 수량보다 많이 매도할 수 없습니다." };
  return {
    ok: true,
    next: { cash: cur.cash + total, stocks: { ...cur.stocks, [input.stockKey]: { amount: prevAmount - input.amount } } },
    extra: { total },
  };
}

/** 투표 비용 차감 계산(순수) */
export function computeVoteCost(cur: CasReadState, totalCost: number): CasComputeResult<{ totalCost: number }> {
  if (cur.cash - totalCost < 0) return { ok: false, error: "현금이 부족합니다." };
  return { ok: true, next: { cash: cur.cash - totalCost, stocks: cur.stocks }, extra: { totalCost } };
}

export function normalizeStocks(raw: unknown): Record<string, { amount: number }> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, { amount: number }> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const amount = v && typeof v === "object" && typeof (v as { amount?: unknown }).amount === "number" ? (v as { amount: number }).amount : 0;
    out[k] = { amount };
  }
  return out;
}
