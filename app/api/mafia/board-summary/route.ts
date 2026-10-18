import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { rankMafiaPlayers } from "@/lib/mafia/rank";
import {
  groupPriceChanges,
  holdingsValue,
  isMafiaJob,
  voteResultFromAbilityRows,
  voteResultFromVotes,
  type MafiaBoardSummary,
  type VoteResult,
  type PlayerAsset,
  type StockHistoryRow,
} from "@/lib/mafia/boardSummary";
import type { MafiaPhase } from "@/lib/types";

// 마피아 보드(빔) 요약 — Iteration 5 WS-C.
//
// 공개 정보(항상):
//  - round / phase / roomStatus / playerCount / 현재 주가(prices) / 라운드별 주가 변동 묶음(changes)
//    → 주가는 모든 참가자의 폰에 보이는 공개 정보. 보드는 변동을 종목별로 순차 공개한다.
// 비공개 정보(게임 종료 + GM 공개 토글 뒤에만):
//  - rounds(라운드별 직업·자산), final(최종 순위·마피아 여부)
//    → finished(5라운드 end) **이고** rooms.reveal_result = true 일 때만 채운다. 아니면 빈 배열.
//    응답에 is_mafia / job / cash / total_assets / holdings 키가 공개 전에는 **절대** 들어가지 않는다(E2E가 JSON을 단언).

const PHASE_RANK: Record<string, number> = {
  prepare: 0,
  auction: 1,
  trade: 2,
  apply: 3,
  vote: 4,
  end: 5,
};

const FINAL_MAIN_ROUND = 5;
const INITIAL_PRICE = 5;

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  const [roomRes, phaseRes, playersRes, stocksRes, historyRes] = await Promise.all([
    supabase.from("rooms").select("code, status, reveal_result").eq("code", room).maybeSingle(),
    supabase.from("mafia_phase_state").select("round_number, phase").eq("room_code", room).maybeSingle(),
    supabase.from("players").select("id, nickname").eq("room_code", room),
    supabase.from("mafia_stock_state").select("stock_key, price").eq("room_code", room),
    supabase
      .from("mafia_stock_history")
      .select("id, stock_key, round_number, price_before, price_after, meta")
      .eq("room_code", room)
      .order("id", { ascending: true }),
  ]);

  if (roomRes.error) {
    return NextResponse.json({ error: roomRes.error.message }, { status: 500 });
  }
  if (!roomRes.data) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }
  if (phaseRes.error) {
    return NextResponse.json({ error: phaseRes.error.message }, { status: 500 });
  }

  const currentRound = typeof phaseRes.data?.round_number === "number" ? phaseRes.data.round_number : 0;
  const currentPhase = (phaseRes.data?.phase as MafiaPhase | null) ?? null;
  const finished = currentRound >= FINAL_MAIN_ROUND && currentPhase === "end";
  const revealResult = roomRes.data.reveal_result === true;
  const revealed = finished && revealResult;

  const nameById = new Map<string, string | null>();
  for (const p of (playersRes.data || []) as { id: string; nickname: string | null }[]) {
    nameById.set(p.id, p.nickname ?? null);
  }

  const prices = ((stocksRes.data || []) as { stock_key: string; price: number }[])
    .map((s) => ({ stock_key: s.stock_key, price: s.price }))
    .sort((a, b) => a.stock_key.localeCompare(b.stock_key, "ko"));
  const historyRows = (historyRes.data || []) as StockHistoryRow[];
  const changes = groupPriceChanges(historyRows);

  // ITER6 B4 — 라운드가 end 면 그 라운드의 경제사범 결과(지목자·마피아 여부만). 튜토리얼 포함, 결과 공개 토글과 무관.
  let voteResult: VoteResult | null = null;
  if (currentPhase === "end") {
    const ab = await supabase
      .from("mafia_ability_results")
      .select("category, payload, message")
      .eq("room_code", room)
      .eq("round_number", currentRound)
      .eq("phase", "vote")
      .in("category", ["econ_mafia", "econ_not_mafia", "vote_no_econ"])
      .limit(20);
    voteResult = ab.error ? null : voteResultFromAbilityRows((ab.data || []) as { category: string | null; payload: unknown; message: string | null }[], currentRound);
    if (!voteResult) {
      const [votesRes, statesRes] = await Promise.all([
        supabase.from("mafia_votes").select("target_id, vote_count").eq("room_code", room).eq("round_number", currentRound),
        supabase.from("mafia_player_state").select("player_id, is_mafia").eq("room_code", room),
      ]);
      if (!votesRes.error && !statesRes.error) {
        const mafiaIds = new Set(
          ((statesRes.data || []) as { player_id: string; is_mafia: boolean }[]).filter((s) => s.is_mafia).map((s) => s.player_id),
        );
        voteResult = voteResultFromVotes(
          (votesRes.data || []) as { target_id: string | null; vote_count: number | null }[],
          currentRound,
          (id) => nameById.get(id) ?? null,
          (id) => mafiaIds.has(id),
        );
      }
    }
  }

  const base: MafiaBoardSummary = {
    round: currentRound,
    phase: currentPhase,
    roomStatus: (roomRes.data.status as "active" | "ended" | null) ?? null,
    playerCount: nameById.size,
    finished,
    revealResult,
    revealed,
    prices,
    changes,
    rounds: [],
    final: [],
    voteResult,
    serverNow: new Date().toISOString(),
  };

  // 게임 종료 전 또는 GM 공개 전: 공개 정보만 반환
  if (!revealed) {
    return NextResponse.json(base);
  }

  // ── 공개 뒤: 라이브 상태(최종 순위) + 라운드별 스냅샷 ──
  const [{ data: liveStates }, { data: snapRows }] = await Promise.all([
    supabase.from("mafia_player_state").select("player_id, job, is_mafia, cash, stocks").eq("room_code", room),
    supabase
      .from("mafia_player_snapshots")
      .select("player_id, round_number, phase, cash, stocks, job")
      .eq("room_code", room),
  ]);

  const finalPrice = new Map<string, number>();
  for (const s of prices) finalPrice.set(s.stock_key, s.price);

  const finalRows: PlayerAsset[] = (
    (liveStates || []) as {
      player_id: string;
      job: string | null;
      is_mafia: boolean;
      cash: number;
      stocks: unknown;
    }[]
  ).map((p) => {
    const hv = holdingsValue(p.stocks, finalPrice);
    return {
      player_id: p.player_id,
      nickname: nameById.get(p.player_id) ?? null,
      job: p.job ?? null,
      is_mafia: !!p.is_mafia,
      cash: p.cash ?? 0,
      holdings_value: hv,
      total_assets: (p.cash ?? 0) + hv,
    };
  });
  // 총자산 → 현금 → 공동 순위(룰지). 닉네임으로 가르지 않는다.
  const final = rankMafiaPlayers(finalRows);

  // 라운드별 종료 시점 주가: 5원에서 시작해 라운드 순서대로 price_after 를 누적 적용.
  const stockKeys = new Set<string>(finalPrice.keys());
  for (const h of historyRows) if (h.stock_key) stockKeys.add(h.stock_key);
  const running = new Map<string, number>();
  for (const k of stockKeys) running.set(k, INITIAL_PRICE);
  const priceAtRound = new Map<number, Map<string, number>>();
  for (let r = 1; r <= FINAL_MAIN_ROUND; r += 1) {
    for (const h of historyRows) {
      if (h.round_number === r && h.stock_key && typeof h.price_after === "number") {
        running.set(h.stock_key, h.price_after);
      }
    }
    priceAtRound.set(r, new Map(running));
  }

  type Snap = {
    player_id: string;
    round_number: number;
    phase: string | null;
    cash: number | null;
    stocks: unknown;
    job: string | null;
  };
  const bestByRoundPlayer = new Map<string, Snap>();
  for (const s of (snapRows || []) as Snap[]) {
    if (s.round_number == null || !s.player_id) continue;
    const key = `${s.round_number}:${s.player_id}`;
    const prev = bestByRoundPlayer.get(key);
    if (!prev || (PHASE_RANK[s.phase ?? "prepare"] ?? 0) >= (PHASE_RANK[prev.phase ?? "prepare"] ?? 0)) {
      bestByRoundPlayer.set(key, s);
    }
  }

  const rounds: { round: number; players: PlayerAsset[] }[] = [];
  for (let r = 1; r <= FINAL_MAIN_ROUND; r += 1) {
    const priceMap = priceAtRound.get(r) ?? new Map<string, number>();
    const players: PlayerAsset[] = [];
    for (const pid of nameById.keys()) {
      const snap = bestByRoundPlayer.get(`${r}:${pid}`);
      if (!snap) continue;
      const cash = typeof snap.cash === "number" ? snap.cash : 0;
      const hv = holdingsValue(snap.stocks, priceMap);
      players.push({
        player_id: pid,
        nickname: nameById.get(pid) ?? null,
        job: snap.job ?? null,
        is_mafia: isMafiaJob(snap.job ?? null),
        cash,
        holdings_value: hv,
        total_assets: cash + hv,
      });
    }
    if (players.length > 0) {
      players.sort((a, b) => b.total_assets - a.total_assets);
      rounds.push({ round: r, players });
    }
  }

  return NextResponse.json({ ...base, rounds, final } satisfies MafiaBoardSummary);
}
