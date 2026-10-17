import type { Ranked } from "@/lib/defense/rank";
import type { MafiaPhase } from "@/lib/types";

/** /api/mafia/board-summary 응답 타입과 순수 함수(단위 테스트 대상) — Iteration 5 WS-C. */
export type PlayerAsset = {
  player_id: string;
  nickname: string | null;
  job: string | null;
  is_mafia: boolean;
  cash: number;
  holdings_value: number;
  total_assets: number;
};

export type PriceChangeGroup = {
  /** `${round}:${phase}` — 보드가 "새 변동"을 알아채는 열쇠 */
  key: string;
  round: number;
  /** apply = 거래 마감 정산, vote = 투표 결과(국채) */
  phase: "apply" | "vote";
  items: { stock_key: string; price_before: number; price_after: number }[];
};

export type MafiaBoardSummary = {
  round: number;
  phase: MafiaPhase | null;
  roomStatus: "active" | "ended" | null;
  playerCount: number;
  finished: boolean;
  revealResult: boolean;
  revealed: boolean;
  prices: { stock_key: string; price: number }[];
  changes: PriceChangeGroup[];
  rounds: { round: number; players: PlayerAsset[] }[];
  final: Ranked<PlayerAsset>[];
  serverNow: string;
};

export function isMafiaJob(job: string | null): boolean {
  return job === "up_manipulator" || job === "down_manipulator" || job === "robber";
}

export function holdingsValue(stocks: unknown, priceByStock: Map<string, number>): number {
  if (!stocks || typeof stocks !== "object") return 0;
  let v = 0;
  for (const [key, info] of Object.entries(stocks as Record<string, { amount?: number }>)) {
    const amount = info && typeof info.amount === "number" ? info.amount : 0;
    if (amount <= 0) continue;
    v += amount * (priceByStock.get(key) ?? 0);
  }
  return v;
}

export type StockHistoryRow = {
  id: number;
  stock_key: string | null;
  round_number: number | null;
  price_before: number | null;
  price_after: number | null;
  meta: Record<string, unknown> | null;
};

/** 주가 히스토리를 (라운드, 단계) 묶음으로 — 순차 공개 단위 */
export function groupPriceChanges(rows: StockHistoryRow[]): PriceChangeGroup[] {
  const groups = new Map<string, PriceChangeGroup>();
  for (const h of rows) {
    if (!h.stock_key || typeof h.round_number !== "number") continue;
    if (typeof h.price_before !== "number" || typeof h.price_after !== "number") continue;
    const phase: PriceChangeGroup["phase"] =
      typeof h.meta?.source === "string" && String(h.meta.source).startsWith("vote") ? "vote" : "apply";
    const key = `${h.round_number}:${phase}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, round: h.round_number, phase, items: [] };
      groups.set(key, g);
    }
    g.items.push({ stock_key: h.stock_key, price_before: h.price_before, price_after: h.price_after });
  }
  return Array.from(groups.values());
}

