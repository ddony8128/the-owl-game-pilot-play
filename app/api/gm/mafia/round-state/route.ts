import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  MafiaAction,
  MafiaPlayerSnapshot,
  MafiaStockHistory,
  MafiaVote,
  Player,
} from "@/lib/types";

type RoundStateResponse =
  | {
      round: number;
      players: {
        player_id: string;
        nickname: string | null;
        job: string | null;
        is_mafia: boolean;
        cash: number | null;
        stocks: Record<string, { amount: number }> | null;
        auction_bets: {
          job: string | null;
          amount: number;
          give_up: boolean;
        }[];
        abilities: {
          job: string | null;
          payload: Record<string, unknown>;
        }[];
        trades: {
          stock_key: string;
          buy: number;
          sell: number;
        }[];
        votes: {
          target_id: string | null;
          target_nickname: string | null;
          vote_count: number;
          unit_price: number;
        }[];
      }[];
      stockSummary: {
        stock_key: string;
        price_before: number | null;
        price_after: number | null;
        buy_volume: number;
        sell_volume: number;
        up_manipulators: { player_id: string; nickname: string | null }[];
        down_manipulators: { player_id: string; nickname: string | null }[];
      }[];
      voteTally: {
        target_id: string | null;
        target_nickname: string | null;
        total_votes: number;
      }[];
    }
  | { error: string };

const phaseRank: Record<string, number> = {
  prepare: 0,
  auction: 1,
  trade: 2,
  apply: 3,
  vote: 4,
  end: 5,
};

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  const roundParam = searchParams.get("round");
  const round = roundParam ? Number(roundParam) : NaN;

  if (!room) {
    return NextResponse.json(
      { error: "room 필요" } as RoundStateResponse,
      { status: 400 }
    );
  }

  if (!Number.isInteger(round) || round < 0 || round > 5) {
    return NextResponse.json(
      {
        error: "round must be an integer between 0 and 5",
      } as RoundStateResponse,
      { status: 400 }
    );
  }

  // 플레이어 기본 정보(닉네임)
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("room_code", room);

  if (playersError) {
    return NextResponse.json(
      { error: playersError.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  type PlayerName = Pick<Player, "id" | "nickname">;
  const nicknameById = new Map<string, string>();
  for (const p of (playerRows || []) as PlayerName[]) {
    nicknameById.set(p.id, p.nickname);
  }

  // 현재 라이브 라운드/페이즈. 진행 중인 라운드는 스냅샷이 아직 직업을 담기 전일
  // 수 있어(경매 직업은 trade→apply 전환 때 스냅샷됨) 라이브 상태를 우선 사용한다.
  const { data: livePhaseRow } = await supabase
    .from("mafia_phase_state")
    .select("round_number, phase")
    .eq("room_code", room)
    .maybeSingle();
  const liveRound =
    typeof livePhaseRow?.round_number === "number"
      ? livePhaseRow.round_number
      : null;
  const livePhase = (livePhaseRow?.phase as string | null) ?? null;
  // 그 라운드의 직업은 경매가 끝난 뒤(trade 단계 이후)에야 확정된다.
  const auctionSettled =
    livePhase === "trade" ||
    livePhase === "apply" ||
    livePhase === "vote" ||
    livePhase === "end";
  const isLiveRound = liveRound != null && liveRound === round;

  const liveStateById = new Map<
    string,
    { job: string | null; is_mafia: boolean; cash: number | null; stocks: unknown }
  >();
  if (isLiveRound) {
    const { data: liveRows } = await supabase
      .from("mafia_player_state")
      .select("player_id, job, is_mafia, cash, stocks")
      .eq("room_code", room);
    for (const r of (liveRows || []) as Array<{
      player_id: string;
      job: string | null;
      is_mafia: boolean;
      cash: number | null;
      stocks: unknown;
    }>) {
      liveStateById.set(r.player_id, {
        job: r.job ?? null,
        is_mafia: !!r.is_mafia,
        cash: typeof r.cash === "number" ? r.cash : null,
        stocks: r.stocks ?? null,
      });
    }
  }

  // 해당 라운드의 플레이어 스냅샷
  const { data: snapshotRows, error: snapshotError } = await supabase
    .from("mafia_player_snapshots")
    .select("player_id, round_number, phase, cash, stocks, job, created_at")
    .eq("room_code", room)
    .eq("round_number", round);

  if (snapshotError) {
    return NextResponse.json(
      { error: snapshotError.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  const snapshots = (snapshotRows || []) as MafiaPlayerSnapshot[];
  const bestSnapshotByPlayer = new Map<string, MafiaPlayerSnapshot>();

  for (const snap of snapshots) {
    const pid = snap.player_id;
    if (!pid) continue;
    const prev = bestSnapshotByPlayer.get(pid);
    if (!prev) {
      bestSnapshotByPlayer.set(pid, snap);
      continue;
    }
    const prevRank = phaseRank[prev.phase ?? "prepare"] ?? 0;
    const currRank = phaseRank[snap.phase ?? "prepare"] ?? 0;
    if (currRank >= prevRank) {
      bestSnapshotByPlayer.set(pid, snap);
    }
  }

  // 해당 라운드의 모든 액션
  const { data: actionRows, error: actionsError } = await supabase
    .from("mafia_actions")
    .select("player_id, round_number, phase, action_type, payload, created_at")
    .eq("room_code", room)
    .eq("round_number", round);

  if (actionsError) {
    return NextResponse.json(
      { error: actionsError.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  const actions = (actionRows || []) as MafiaAction[];

  // 해당 라운드의 투표
  const { data: voteRows, error: votesError } = await supabase
    .from("mafia_votes")
    .select("voter_id, target_id, vote_count, unit_price")
    .eq("room_code", room)
    .eq("round_number", round);

  if (votesError) {
    return NextResponse.json(
      { error: votesError.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  const votes = (voteRows || []) as MafiaVote[];

  // 해당 라운드의 주가 히스토리
  const { data: historyRows, error: historyError } = await supabase
    .from("mafia_stock_history")
    .select(
      "stock_key, round_number, price_before, price_after, meta, created_at"
    )
    .eq("room_code", room)
    .eq("round_number", round);

  if (historyError) {
    return NextResponse.json(
      { error: historyError.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  const histories = (historyRows || []) as MafiaStockHistory[];

  // 플레이어별 요약 구조
  type PlayerSummary = {
    player_id: string;
    nickname: string | null;
    job: string | null;
    is_mafia: boolean;
    cash: number | null;
    stocks: Record<string, { amount: number }> | null;
    auction_bets: {
      job: string | null;
      amount: number;
      give_up: boolean;
    }[];
    abilities: {
      job: string | null;
      payload: Record<string, unknown>;
    }[];
    trades: {
      stock_key: string;
      buy: number;
      sell: number;
    }[];
    votes: {
      target_id: string | null;
      target_nickname: string | null;
      vote_count: number;
      unit_price: number;
    }[];
  };

  const byPlayer = new Map<string, PlayerSummary>();

  const ensurePlayer = (playerId: string): PlayerSummary => {
    let summary = byPlayer.get(playerId);
    if (summary) return summary;
    const snap = bestSnapshotByPlayer.get(playerId) ?? null;
    const live = isLiveRound ? liveStateById.get(playerId) ?? null : null;

    // 직업/마피아/현금/주식: 진행 중인 라운드는 라이브 상태가 정확하다.
    // (직업은 경매가 끝난 뒤에만 확정되므로, 경매 전이면 null로 둔다.)
    let job: string | null;
    let isMafia: boolean;
    let cash: number | null;
    let rawStocks: unknown;
    if (live) {
      job = auctionSettled ? live.job : null;
      isMafia = auctionSettled ? live.is_mafia : false;
      cash = live.cash;
      rawStocks = live.stocks;
    } else {
      job = (snap as unknown as { job?: string | null })?.job ?? null;
      // 스냅샷에는 is_mafia를 따로 저장하지 않으므로 직업 기준으로 다시 계산.
      isMafia =
        job === "up_manipulator" ||
        job === "down_manipulator" ||
        job === "robber";
      cash =
        typeof (snap as unknown as { cash?: number | null })?.cash === "number"
          ? ((snap as unknown as { cash?: number | null }).cash as number)
          : null;
      rawStocks = (snap as unknown as { stocks?: unknown })?.stocks;
    }
    const stocks: Record<string, { amount: number }> | null =
      rawStocks && typeof rawStocks === "object"
        ? { ...(rawStocks as Record<string, { amount: number }>) }
        : null;

    summary = {
      player_id: playerId,
      nickname: nicknameById.get(playerId) ?? null,
      job,
      is_mafia: isMafia,
      cash,
      stocks,
      auction_bets: [],
      abilities: [],
      trades: [],
      votes: [],
    };
    byPlayer.set(playerId, summary);
    return summary;
  };

  // 주가 변동 요소 집계
  const buyVolumeByStock = new Map<string, number>();
  const sellVolumeByStock = new Map<string, number>();
  const upManipulatorsByStock = new Map<
    string,
    { player_id: string; nickname: string | null }[]
  >();
  const downManipulatorsByStock = new Map<
    string,
    { player_id: string; nickname: string | null }[]
  >();

  // 액션을 순회하면서 플레이어별 경매/능력/거래 요약 및 주가 변동 요소를 동시에 집계
  for (const a of actions) {
    if (!a.player_id) continue;
    const pid = a.player_id;
    const phase = a.phase;
    const type = a.action_type;

    const playerSummary = ensurePlayer(pid);

    if (phase === "auction" && type === "bet") {
      const payload = (a.payload ?? {}) as {
        job?: string | null;
        amount?: number;
        give_up?: boolean;
      };
      const job = payload.job ?? null;
      const amount =
        typeof payload.amount === "number" && payload.amount > 0
          ? payload.amount
          : 0;
      const give_up = payload.give_up === true;
      playerSummary.auction_bets.push({ job, amount, give_up });
      continue;
    }

    if ((phase === "trade" || phase === "apply") && type === "ability") {
      const payload = (a.payload ?? {}) as Record<string, unknown>;
      const job =
        typeof payload.job === "string" ? (payload.job as string) : null;
      playerSummary.abilities.push({
        job,
        payload,
      });

      // 주가조작 능력(상승/하락 조작자)의 경우 주가 변동 요소에도 반영
      const stockKey =
        typeof payload.stock_key === "string"
          ? (payload.stock_key as string)
          : null;
      if (stockKey) {
        if (job === "up_manipulator") {
          const list =
            upManipulatorsByStock.get(stockKey) ??
            ([] as { player_id: string; nickname: string | null }[]);
          if (!upManipulatorsByStock.has(stockKey)) {
            upManipulatorsByStock.set(stockKey, list);
          }
          list.push({ player_id: pid, nickname: playerSummary.nickname });
        } else if (job === "down_manipulator") {
          const list =
            downManipulatorsByStock.get(stockKey) ??
            ([] as { player_id: string; nickname: string | null }[]);
          if (!downManipulatorsByStock.has(stockKey)) {
            downManipulatorsByStock.set(stockKey, list);
          }
          list.push({ player_id: pid, nickname: playerSummary.nickname });
        }
      }
      continue;
    }

    if (phase === "trade" && (type === "buy" || type === "sell")) {
      const payload = (a.payload ?? {}) as {
        stock_key?: string;
        amount?: number;
      };
      const stockKey = payload.stock_key;
      const amount =
        typeof payload.amount === "number" && payload.amount > 0
          ? payload.amount
          : 0;
      if (!stockKey || amount <= 0) continue;

      let tradeEntry = playerSummary.trades.find(
        (t) => t.stock_key === stockKey
      );
      if (!tradeEntry) {
        tradeEntry = { stock_key: stockKey, buy: 0, sell: 0 };
        playerSummary.trades.push(tradeEntry);
      }

      if (type === "buy") {
        tradeEntry.buy += amount;
        buyVolumeByStock.set(
          stockKey,
          (buyVolumeByStock.get(stockKey) ?? 0) + amount
        );
      } else if (type === "sell") {
        tradeEntry.sell += amount;
        sellVolumeByStock.set(
          stockKey,
          (sellVolumeByStock.get(stockKey) ?? 0) + amount
        );
      }
      continue;
    }
  }

  // 투표 요약 및 집계
  const tally = new Map<string, number>();

  for (const v of votes) {
    const voterId = v.voter_id as string | null;
    if (voterId) {
      const ps = ensurePlayer(voterId);
      const targetId = v.target_id as string | null;
      const cnt =
        typeof v.vote_count === "number" && v.vote_count > 0 ? v.vote_count : 0;
      const unit =
        typeof v.unit_price === "number" && v.unit_price > 0 ? v.unit_price : 0;
      ps.votes.push({
        target_id: targetId,
        target_nickname: targetId ? nicknameById.get(targetId) ?? null : null,
        vote_count: cnt,
        unit_price: unit,
      });
    }

    const targetId = v.target_id as string | null;
    const cnt =
      typeof v.vote_count === "number" && v.vote_count > 0 ? v.vote_count : 0;
    if (!targetId || cnt <= 0) continue;

    tally.set(targetId, (tally.get(targetId) ?? 0) + cnt);
  }

  const voteTally = Array.from(tally.entries()).map(
    ([targetId, total_votes]) => ({
      target_id: targetId,
      target_nickname: nicknameById.get(targetId) ?? null,
      total_votes,
    })
  );

  // 주가 요약: 히스토리 + 집계된 거래/능력 요인
  // 한 라운드 안에서 같은 종목에 대해 여러 번 가격 변동이 발생할 수 있으므로
  // (예: trade 단계 적용, vote 단계 국채 조정 등) 히스토리 행을 그대로 모두 노출한다.
  const stockSummary = histories.map((h) => {
    const key = h.stock_key ?? "";
    return {
      stock_key: key,
      price_before: h.price_before ?? null,
      price_after: h.price_after ?? null,
      buy_volume: buyVolumeByStock.get(key) ?? 0,
      sell_volume: sellVolumeByStock.get(key) ?? 0,
      up_manipulators: upManipulatorsByStock.get(key) ?? [],
      down_manipulators: downManipulatorsByStock.get(key) ?? [],
    };
  });

  const playersSummary = Array.from(byPlayer.values());

  return NextResponse.json({
    round,
    players: playersSummary,
    stockSummary,
    voteTally,
  } as RoundStateResponse);
}
