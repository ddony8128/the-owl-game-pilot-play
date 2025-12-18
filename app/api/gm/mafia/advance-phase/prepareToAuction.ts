import type {
  MafiaPhaseState,
  MafiaStocksHolding,
  Player,
  SubwayPlayerState,
} from "@/lib/types";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

export async function handlePrepareToAuction(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState
) {
  // 튜토리얼(0) 또는 1라운드에서만 현금 30 + 보너스 초기화
  if (current.round_number !== 0 && current.round_number !== 1) {
    return;
  }

  // 플레이어 전체 조회
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at");

  if (playersError || !playerRows) {
    throw new Error(playersError?.message ?? "players 조회에 실패했습니다.");
  }

  const players = playerRows as Player[];

  if (players.length === 0) {
    return;
  }

  // 1게임(지하철) 등수 정보 조회
  const { data: subwayStates, error: subwayError } = await supabase
    .from("subway_player_state")
    .select("player_id, finished_rank, is_finished");

  if (subwayError || !subwayStates) {
    throw new Error(
      subwayError?.message ?? "subway_player_state 조회에 실패했습니다."
    );
  }

  const byPlayerId = new Map<string, SubwayPlayerState>();
  for (const row of subwayStates as unknown as SubwayPlayerState[]) {
    if (row.player_id) {
      byPlayerId.set(row.player_id, row);
    }
  }

  // 완료된 플레이어들 중 최대 finished_rank 계산
  const finishedRanks: number[] = [];
  for (const state of byPlayerId.values()) {
    if (typeof state.finished_rank === "number") {
      finishedRanks.push(state.finished_rank);
    }
  }
  const lastClearedRank =
    finishedRanks.length > 0 ? Math.max(...finishedRanks) : 0;

  // 플레이어별 초기 현금 + 주식(4종목 0주) 설정
  type BonusEntry = {
    player_id: string;
    cash: number;
    stocks: MafiaStocksHolding;
  };

  const initialStocks: MafiaStocksHolding = {
    부엉교육: { amount: 0 },
    번쩍전기: { amount: 0 },
    국채: { amount: 0 },
    이상교통: { amount: 0 },
  };

  const bonuses: BonusEntry[] = [];

  for (const p of players) {
    const subway = byPlayerId.get(p.id) ?? null;
    let rank: number;
    if (subway && typeof subway.finished_rank === "number") {
      rank = subway.finished_rank;
    } else {
      // 통과하지 못한 경우: 마지막 등수 + 1등으로 계산
      rank = lastClearedRank + 1 || 1;
    }

    let bonus = 10 - (rank - 1);
    if (bonus < 0) bonus = 0;

    const cash = 30 + bonus;
    bonuses.push({
      player_id: p.id,
      cash,
      stocks: initialStocks,
    });
  }

  if (bonuses.length > 0) {
    const { error: upsertError } = await supabase
      .from("mafia_player_state")
      .upsert(bonuses, { onConflict: "player_id" });

    if (upsertError) {
      throw new Error(
        upsertError.message ??
          "mafia_player_state 현금/주식 초기화에 실패했습니다."
      );
    }
  }

  // 주식 가격 초기화: 4종목 모두 5원으로 리셋
  const initialStockRows = [
    { stock_key: "부엉교육", price: 5 },
    { stock_key: "번쩍전기", price: 5 },
    { stock_key: "국채", price: 5 },
    { stock_key: "이상교통", price: 5 },
  ];

  const { error: stockResetError } = await supabase
    .from("mafia_stock_state")
    .upsert(initialStockRows, { onConflict: "stock_key" });

  if (stockResetError) {
    throw new Error(
      stockResetError.message ?? "mafia_stock_state 초기화에 실패했습니다."
    );
  }
}
