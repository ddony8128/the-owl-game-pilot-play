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

/**
 * ITER6 B4 — 라운드 투표 결과(보드 공개용). 지목자 닉네임과 마피아 여부만 담는다 —
 * 득표수·누가 누구에게 투표했는지는 절대 넣지 않는다(룰지: 득표수 비공개).
 *  outcome: "mafia" = 경제사범이 마피아였음 / "citizen" = 마피아가 아니었음 / "none" = 경제사범 없음(동점·무투표)
 */
export type VoteResult = { round: number; outcome: "mafia" | "citizen" | "none"; nickname: string | null };

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
  /** ITER6 B4 — 현재 라운드가 end 일 때만(그 라운드의 경제사범 결과). 최종 결과 공개 토글과 무관. */
  voteResult: VoteResult | null;
  serverNow: string;
};

/** voteToEnd 가 라운드 종료 때 남기는 능력 결과(category)로 투표 결과를 만든다. 없으면 null. */
export function voteResultFromAbilityRows(
  rows: { category: string | null; payload: unknown; message?: string | null }[],
  round: number,
): VoteResult | null {
  const nickOf = (r: { payload: unknown; message?: string | null }) => {
    const p = r.payload as { econ_target_nickname?: unknown } | null;
    if (p && typeof p.econ_target_nickname === "string") return p.econ_target_nickname;
    const m = /지목되었던 (.+?)은\(는\)/.exec(r.message ?? "");
    return m ? m[1]! : null;
  };
  const mafia = rows.find((r) => r.category === "econ_mafia");
  if (mafia) return { round, outcome: "mafia", nickname: nickOf(mafia) };
  const citizen = rows.find((r) => r.category === "econ_not_mafia");
  if (citizen) return { round, outcome: "citizen", nickname: nickOf(citizen) };
  if (rows.some((r) => r.category === "vote_no_econ")) return { round, outcome: "none", nickname: null };
  return null;
}

/**
 * 기록이 없을 때의 대체 계산(voteToEnd 와 같은 규칙): 최다 득표자가 한 명이면 그 사람, 동점·무투표면 없음.
 * 반환에는 지목자와 마피아 여부만 — 표 수는 내보내지 않는다.
 */
export function voteResultFromVotes(
  votes: { target_id: string | null; vote_count: number | null }[],
  round: number,
  nicknameOf: (id: string) => string | null,
  isMafiaOf: (id: string) => boolean,
): VoteResult {
  const tally = new Map<string, number>();
  for (const v of votes) {
    const n = typeof v.vote_count === "number" ? v.vote_count : 0;
    if (!v.target_id || n <= 0) continue;
    tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + n);
  }
  let max = 0;
  for (const n of tally.values()) max = Math.max(max, n);
  const top = [...tally.entries()].filter(([, n]) => n === max && max > 0).map(([id]) => id);
  if (top.length !== 1) return { round, outcome: "none", nickname: null };
  const id = top[0]!;
  return { round, outcome: isMafiaOf(id) ? "mafia" : "citizen", nickname: nicknameOf(id) };
}

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

