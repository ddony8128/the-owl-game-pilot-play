import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  MafiaPlayerState,
  MafiaStockState,
  MafiaStocksHolding,
  Player,
  SubwayPlayerState,
} from "@/lib/types";

type FinalResult = {
  player_id: string;
  nickname: string;
  cash: number;
  asset: number;
  finished_rank: number | null;
};

type ResultResponse = { results: FinalResult[] } | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");

  if (!room) {
    return NextResponse.json({ error: "room 필요" } as ResultResponse, {
      status: 400,
    });
  }

  const [playersRes, stocksRes, mafiaRes, subwayRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, nickname, created_at")
      .eq("room_code", room),
    supabase
      .from("mafia_stock_state")
      .select("stock_key, price, updated_at")
      .eq("room_code", room),
    supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("room_code", room),
    supabase
      .from("subway_player_state")
      .select("player_id, finished_rank")
      .eq("room_code", room),
  ]);

  if (playersRes.error) {
    return NextResponse.json(
      { error: playersRes.error.message } as ResultResponse,
      { status: 500 }
    );
  }
  if (stocksRes.error) {
    return NextResponse.json(
      { error: stocksRes.error.message } as ResultResponse,
      { status: 500 }
    );
  }
  if (mafiaRes.error) {
    return NextResponse.json(
      { error: mafiaRes.error.message } as ResultResponse,
      { status: 500 }
    );
  }
  if (subwayRes.error) {
    return NextResponse.json(
      { error: subwayRes.error.message } as ResultResponse,
      { status: 500 }
    );
  }

  const players = (playersRes.data || []) as Player[];
  const stocks = (stocksRes.data || []) as MafiaStockState[];
  const mafiaPlayers = (mafiaRes.data || []) as MafiaPlayerState[];
  const subwayStates = (subwayRes.data || []) as SubwayPlayerState[];

  const nicknameById = new Map<string, string>();
  for (const p of players) {
    nicknameById.set(p.id, p.nickname);
  }

  const priceByStock = new Map<string, number>();
  for (const s of stocks) {
    priceByStock.set(s.stock_key, s.price);
  }

  const rankByPlayerId = new Map<string, number | null>();
  for (const s of subwayStates) {
    rankByPlayerId.set(s.player_id, s.finished_rank);
  }

  const results: FinalResult[] = [];

  for (const p of mafiaPlayers) {
    const cash = typeof p.cash === "number" ? p.cash : 0;
    const holdings = (p.stocks || {}) as MafiaStocksHolding;

    let stockValue = 0;
    for (const [stockKey, info] of Object.entries(holdings)) {
      const amount = typeof info.amount === "number" ? info.amount : 0;
      if (!amount) continue;
      const price = priceByStock.get(stockKey) ?? 0;
      stockValue += amount * price;
    }

    const asset = cash + stockValue;
    const nickname = nicknameById.get(p.player_id) ?? "(unknown)";
    const finished_rank =
      rankByPlayerId.has(p.player_id) && rankByPlayerId.get(p.player_id) != null
        ? (rankByPlayerId.get(p.player_id) as number)
        : null;

    results.push({
      player_id: p.player_id,
      nickname,
      cash,
      asset,
      finished_rank,
    });
  }

  results.sort((a, b) => {
    if (b.asset !== a.asset) return b.asset - a.asset;
    if (b.cash !== a.cash) return b.cash - a.cash;

    const ar = a.finished_rank;
    const br = b.finished_rank;
    if (typeof ar === "number" && typeof br === "number") {
      return ar - br;
    }
    if (typeof ar === "number") return -1;
    if (typeof br === "number") return 1;
    return 0;
  });

  return NextResponse.json({ results } as ResultResponse, { status: 200 });
}
