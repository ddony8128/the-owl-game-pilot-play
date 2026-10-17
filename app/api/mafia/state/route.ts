import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  MafiaAbilityResult,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
  MafiaLog,
  Player,
} from "@/lib/types";

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  const nickname = searchParams.get("nickname");
  const all = searchParams.get("all") === "1";

  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  // 서로 의존하지 않는 초기 화면 데이터는 한 번에 조회한다.
  const [phaseRes, stocksRes, logsRes, roomRes] = await Promise.all([
    supabase
      .from("mafia_phase_state")
      .select("room_code, round_number, phase, updated_at")
      .eq("room_code", room)
      .maybeSingle(),
    supabase
      .from("mafia_stock_state")
      .select("stock_key, price, updated_at")
      .eq("room_code", room),
    supabase
      .from("mafia_public_logs")
      .select("id, content, created_at")
      .eq("room_code", room)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("rooms")
      .select("status")
      .eq("code", room)
      .maybeSingle(),
  ]);

  if (roomRes.error) {
    return NextResponse.json({ error: roomRes.error.message }, { status: 500 });
  }
  const roomEnded = roomRes.data?.status === "ended";

  const { data: phaseRow, error: phaseError } = phaseRes;

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message }, { status: 500 });
  }

  const phase = (phaseRow || null) as MafiaPhaseState | null;

  const { data: stockRows, error: stockError } = stocksRes;

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 });
  }

  const stocks = (stockRows || []) as MafiaStockState[];

  const { data: logRows, error: logError } = logsRes;

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  const logs = (logRows || []) as MafiaLog[];

  if (all) {
    // GM용 플레이어 상태와 닉네임도 서로 독립적이므로 병렬 조회한다.
    const [playerStatesRes, namesRes] = await Promise.all([
      supabase
        .from("mafia_player_state")
        .select("player_id, cash, is_mafia, job, stocks, updated_at")
        .eq("room_code", room),
      supabase
        .from("players")
        .select("id, nickname, created_at")
        .eq("room_code", room),
    ]);
    const { data: playerStateRows, error: playerStateError } = playerStatesRes;

    if (playerStateError) {
      return NextResponse.json(
        { error: playerStateError.message },
        { status: 500 }
      );
    }

    const players = (playerStateRows || []) as MafiaPlayerState[];

    const { data: nameRows, error: namesError } = namesRes;

    if (namesError) {
      return NextResponse.json({ error: namesError.message }, { status: 500 });
    }

    type PlayerName = Pick<Player, "id" | "nickname">;
    const playerNames: Record<string, string> = {};
    ((nameRows || []) as PlayerName[]).forEach((p) => {
      playerNames[p.id] = p.nickname;
    });

    return NextResponse.json({
      phase,
      roomEnded,
      stocks,
      players,
      logs,
      playerNames,
    });
  }

  let playerState: MafiaPlayerState | null = null;
  let players: Player[] = [];
  let abilityResults: MafiaAbilityResult[] = [];
  let ticketPrice: number | null = null;
  let myVoteSummary:
    | {
        target: string;
        vote_count: number;
        total_spent: number;
      }[]
    | null = null;

  let hasUsedAbilityThisPhase = false;
  let myAuctionBet: {
    job: string | null;
    amount: number | null;
    give_up: boolean;
  } | null = null;
  let myAbilityActionThisPhase: {
    job: string | null;
    payload: Record<string, unknown> | null;
  } | null = null;
  let myTradesThisRound: Record<
    string,
    { bought: boolean; sold: boolean }
  > | null = null;

  if (nickname) {
    const playerRes = await supabase
      .from("players")
      .select("id, nickname, created_at")
      .eq("room_code", room)
      .eq("nickname", nickname)
      .maybeSingle();

    if (playerRes.error) {
      return NextResponse.json(
        { error: playerRes.error.message },
        { status: 500 }
      );
    }

    if (!playerRes.data) {
      return NextResponse.json(
        { error: "등록되지 않은 닉네임입니다." },
        { status: 403 }
      );
    }

    const player = playerRes.data as Player;

    const roundNumber = phase?.round_number ?? null;
    const isAuction = phase?.phase === "auction" && roundNumber != null;
    const isTrade = phase?.phase === "trade" && roundNumber != null;
    const isVote = phase?.phase === "vote" && roundNumber != null;
    const needsPlayerList = isTrade || isVote;
    const emptySingle = Promise.resolve({ data: null, error: null });
    const emptyList = Promise.resolve({ data: [], error: null });

    // 플레이어 확인 뒤 필요한 데이터는 단계별로 골라 한 번에 조회한다.
    const [
      stateRes,
      playersRes,
      abilityResultsRes,
      betRes,
      votePriceRes,
      votesRes,
      tradesRes,
      abilityActionRes,
    ] = await Promise.all([
      supabase
        .from("mafia_player_state")
        .select("player_id, cash, is_mafia, job, stocks, updated_at")
        .eq("room_code", room)
        .eq("player_id", player.id)
        .maybeSingle(),
      needsPlayerList
        ? supabase
            .from("players")
            .select("id, nickname, created_at")
            .eq("room_code", room)
        : emptyList,
      supabase
        .from("mafia_ability_results")
        .select("id, player_id, round_number, phase, job, category, message, payload, created_at")
        .eq("room_code", room)
        .eq("player_id", player.id)
        .order("round_number", { ascending: true })
        .order("created_at", { ascending: true }),
      isAuction
        ? supabase
            .from("mafia_actions")
            .select("payload")
            .eq("room_code", room)
            .eq("round_number", roundNumber)
            .eq("phase", "auction")
            .eq("action_type", "bet")
            .eq("player_id", player.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : emptySingle,
      isVote
        ? supabase
            .from("mafia_actions")
            .select("payload")
            .eq("room_code", room)
            .eq("round_number", roundNumber)
            .eq("phase", "trade")
            .eq("action_type", "ability")
        : emptyList,
      isVote
        ? supabase
            .from("mafia_votes")
            .select("target_id, vote_count, unit_price")
            .eq("room_code", room)
            .eq("round_number", roundNumber)
            .eq("voter_id", player.id)
        : emptyList,
      isTrade
        ? supabase
            .from("mafia_actions")
            .select("action_type, payload")
            .eq("room_code", room)
            .eq("round_number", roundNumber)
            .eq("phase", "trade")
            .eq("player_id", player.id)
        : emptyList,
      isTrade
        ? supabase
            .from("mafia_actions")
            .select("payload")
            .eq("room_code", room)
            .eq("round_number", roundNumber)
            .eq("phase", "trade")
            .eq("action_type", "ability")
            .eq("player_id", player.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : emptySingle,
    ]);

    if (stateRes.error || playersRes.error || abilityResultsRes.error) {
      return NextResponse.json(
        {
          error:
            stateRes.error?.message ??
            playersRes.error?.message ??
            abilityResultsRes.error?.message,
        },
        { status: 500 }
      );
    }

    playerState = (stateRes.data || null) as MafiaPlayerState | null;
    players = (playersRes.data || []) as Player[];
    abilityResults = (abilityResultsRes.data || []) as MafiaAbilityResult[];

    if (!betRes.error && betRes.data) {
      const payload = betRes.data.payload as {
        job?: string | null;
        amount?: number;
        give_up?: boolean;
      } | null;
      myAuctionBet = {
        job: payload?.job ?? null,
        amount:
          typeof payload?.amount === "number" && payload.amount > 0
            ? payload.amount
            : null,
        give_up: !!payload?.give_up,
      };
    }

    if (isVote) {
      let resolvedTicketPrice = 1;
      if (!votePriceRes.error) {
        for (const row of votePriceRes.data ?? []) {
          const payload = row.payload as { job?: string; ticket_price?: number } | null;
          if (payload?.job === "mayor" && [1, 2, 3].includes(payload.ticket_price ?? 0)) {
            resolvedTicketPrice = payload.ticket_price!;
          }
        }
      }
      ticketPrice = resolvedTicketPrice;

      const byTargetId = new Map<string, { vote_count: number; total_spent: number }>();
      if (!votesRes.error) {
        for (const vote of votesRes.data ?? []) {
          if (!vote.target_id || !vote.vote_count || vote.vote_count <= 0) continue;
          const previous = byTargetId.get(vote.target_id) ?? { vote_count: 0, total_spent: 0 };
          previous.vote_count += vote.vote_count;
          previous.total_spent += vote.vote_count * (vote.unit_price || resolvedTicketPrice);
          byTargetId.set(vote.target_id, previous);
        }
      }
      const nicknameById = new Map(players.map((item) => [item.id, item.nickname]));
      myVoteSummary = Array.from(byTargetId, ([targetId, summary]) => ({
        target: nicknameById.get(targetId) ?? targetId,
        ...summary,
      }));
    }

    if (isTrade && !tradesRes.error) {
      const byStock: Record<string, { bought: boolean; sold: boolean }> = {};
      for (const row of tradesRes.data ?? []) {
        const payload = (row.payload ?? {}) as { stock_key?: string | null };
        if (!payload.stock_key) continue;
        byStock[payload.stock_key] ??= { bought: false, sold: false };
        if (row.action_type === "buy") byStock[payload.stock_key].bought = true;
        if (row.action_type === "sell") byStock[payload.stock_key].sold = true;
      }
      myTradesThisRound = Object.keys(byStock).length > 0 ? byStock : null;
    }

    if (isTrade && !abilityActionRes.error && abilityActionRes.data) {
      hasUsedAbilityThisPhase = true;
      const payload =
        (abilityActionRes.data.payload as Record<string, unknown> | null) ?? null;
      myAbilityActionThisPhase = {
        job: payload && typeof payload.job === "string" ? payload.job : null,
        payload,
      };
    }
  }

  return NextResponse.json({
    phase,
    roomEnded,
    stocks,
    playerState,
    players,
    logs,
    abilityResults,
    ticketPrice,
    myVoteSummary,
    hasUsedAbilityThisPhase,
    myAuctionBet,
    myAbilityActionThisPhase,
    myTradesThisRound,
  });
}
