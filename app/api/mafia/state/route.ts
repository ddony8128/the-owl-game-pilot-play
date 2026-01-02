import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MafiaAbilityResult,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
  MafiaLog,
  Player,
  MafiaStockHistory,
} from "@/lib/types";

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname");
  const all = searchParams.get("all") === "1";

  // phase
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message }, { status: 500 });
  }

  const phase = (phaseRow || null) as MafiaPhaseState | null;

  // stocks
  const { data: stockRows, error: stockError } = await supabase
    .from("mafia_stock_state")
    .select("stock_key, price, updated_at");

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 });
  }

  const stocks = (stockRows || []) as MafiaStockState[];

  // stock history
  const { data: historyRows, error: historyError } = await supabase
    .from("mafia_stock_history")
    .select("stock_key, round_number, price_before, price_after, created_at")
    .order("round_number", { ascending: true });

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  const histories = (historyRows || []) as MafiaStockHistory[];
  const stockHistory: Record<
    string,
    {
      round_number: number;
      price_before: number | null;
      price_after: number | null;
    }[]
  > = {};

  for (const h of histories) {
    const key = h.stock_key;
    if (!key) continue;
    if (!stockHistory[key]) {
      stockHistory[key] = [];
    }
    stockHistory[key].push({
      round_number: h.round_number,
      price_before: h.price_before,
      price_after: h.price_after,
    });
  }

  // logs (공개 로그)
  const { data: logRows, error: logError } = await supabase
    .from("mafia_public_logs")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  const logs = (logRows || []) as MafiaLog[];

  if (all) {
    // GM용 전체 플레이어 상태
    const { data: playerStateRows, error: playerStateError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at");

    if (playerStateError) {
      return NextResponse.json(
        { error: playerStateError.message },
        { status: 500 }
      );
    }

    const players = (playerStateRows || []) as MafiaPlayerState[];

    // 플레이어 닉네임 매핑
    const { data: nameRows, error: namesError } = await supabase
      .from("players")
      .select("id, nickname, created_at");

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
      stocks,
      players,
      logs,
      stockHistory,
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

    const { data: stateRow, error: stateError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("player_id", player.id)
      .maybeSingle();

    if (stateError) {
      return NextResponse.json({ error: stateError.message }, { status: 500 });
    }

    playerState = (stateRow || null) as MafiaPlayerState | null;

    // 전체 플레이어 리스트 (능력/투표 대상 선택용)
    const { data: playersRows, error: playersError } = await supabase
      .from("players")
      .select("id, nickname, created_at");

    if (playersError) {
      return NextResponse.json(
        { error: playersError.message },
        { status: 500 }
      );
    }

    players = (playersRows || []) as Player[];

    if (phase && typeof phase.round_number === "number") {
      const { data: betRow, error: betError } = await supabase
        .from("mafia_actions")
        .select("payload")
        .eq("round_number", phase.round_number)
        .eq("phase", "auction")
        .eq("action_type", "bet")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!betError && betRow) {
        const payload = betRow.payload as {
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
    }

    // 현재 플레이어의 능력결과 (최신 라운드 우선, created_at 오름차순)
    const { data: abilityRows, error: abilityError } = await supabase
      .from("mafia_ability_results")
      .select(
        "id, player_id, round_number, phase, job, category, message, payload, created_at"
      )
      .eq("player_id", player.id)
      .order("round_number", { ascending: true })
      .order("created_at", { ascending: true });

    if (abilityError) {
      return NextResponse.json(
        { error: abilityError.message },
        { status: 500 }
      );
    }

    abilityResults = (abilityRows || []) as MafiaAbilityResult[];

    // 시장 능력에서 표 가격 결정: apply 페이즈 ability 중 job='mayor'의 ticket_price 사용, 없으면 1원
    if (phase && typeof phase.round_number === "number") {
      let resolvedTicketPrice = 1;
      const { data: abilityPriceRows, error: abilityPriceError } =
        await supabase
          .from("mafia_actions")
          .select("payload")
          .eq("round_number", phase.round_number)
          .eq("phase", "trade")
          .eq("action_type", "ability");

      if (!abilityPriceError && abilityPriceRows) {
        for (const row of abilityPriceRows) {
          const payload = row.payload as {
            job?: string;
            ticket_price?: number;
          } | null;
          if (payload?.job === "mayor") {
            const tp = payload.ticket_price;
            if (tp === 1 || tp === 2 || tp === 3) {
              resolvedTicketPrice = tp;
            }
          }
        }
      }

      ticketPrice = resolvedTicketPrice;

      // 현재 플레이어의 이번 라운드 투표 요약
      const { data: myVotesRows, error: myVotesError } = await supabase
        .from("mafia_votes")
        .select("target_id, vote_count, unit_price")
        .eq("round_number", phase.round_number)
        .eq("voter_id", player.id);

      if (!myVotesError && myVotesRows) {
        const byTargetId = new Map<
          string,
          { vote_count: number; total_spent: number }
        >();

        for (const v of myVotesRows) {
          const rawTargetId = v.target_id as string | null; // players.id (uuid)
          if (!rawTargetId) continue;
          const cnt =
            typeof v.vote_count === "number" && v.vote_count > 0
              ? v.vote_count
              : 0;
          if (cnt <= 0) continue;
          const unit =
            typeof v.unit_price === "number" && v.unit_price > 0
              ? v.unit_price
              : resolvedTicketPrice;

          const prev = byTargetId.get(rawTargetId) ?? {
            vote_count: 0,
            total_spent: 0,
          };
          prev.vote_count += cnt;
          prev.total_spent += cnt * unit;
          byTargetId.set(rawTargetId, prev);
        }

        // players 테이블에서 닉네임을 찾아서 UI에는 닉네임을 노출
        const nicknameById = new Map<string, string>();
        for (const p of players) {
          if (p.id) {
            nicknameById.set(p.id, p.nickname);
          }
        }

        myVoteSummary = Array.from(byTargetId.entries()).map(
          ([targetId, agg]) => ({
            target: nicknameById.get(targetId) ?? targetId,
            vote_count: agg.vote_count,
            total_spent: agg.total_spent,
          })
        );
      } else {
        myVoteSummary = [];
      }
      // 현재 플레이어의 이번 라운드 주식 거래 요약 (trade 단계 UI용)
      const { data: myTradeRows, error: myTradesError } = await supabase
        .from("mafia_actions")
        .select("action_type, payload")
        .eq("round_number", phase.round_number)
        .eq("phase", "trade")
        .eq("player_id", player.id);

      if (!myTradesError && myTradeRows) {
        const byStock: Record<string, { bought: boolean; sold: boolean }> = {};
        for (const row of myTradeRows as {
          action_type?: string;
          payload?: unknown;
        }[]) {
          const payload = (row.payload ?? {}) as { stock_key?: string | null };
          const stockKey =
            typeof payload.stock_key === "string" &&
            payload.stock_key.length > 0
              ? payload.stock_key
              : null;
          if (!stockKey) continue;
          if (!byStock[stockKey]) {
            byStock[stockKey] = { bought: false, sold: false };
          }
          if (row.action_type === "buy") {
            byStock[stockKey].bought = true;
          } else if (row.action_type === "sell") {
            byStock[stockKey].sold = true;
          }
        }
        myTradesThisRound =
          Object.keys(byStock).length > 0
            ? byStock
            : (null as typeof byStock | null);
      } else {
        myTradesThisRound = null;
      }
    }

    // 현재 라운드/페이즈에서 이미 능력을 사용했는지 여부 (trade/apply 단계 UI용) + payload 요약
    if (phase) {
      const { data: abilityActionRow, error: abilityActionError } =
        await supabase
          .from("mafia_actions")
          .select("payload")
          .eq("round_number", phase.round_number)
          .eq("phase", phase.phase)
          .eq("action_type", "ability")
          .eq("player_id", player.id)
          .maybeSingle();

      if (!abilityActionError && abilityActionRow) {
        hasUsedAbilityThisPhase = true;
        const payload =
          (abilityActionRow.payload as Record<string, unknown> | null) ?? null;
        const job =
          payload && typeof payload.job === "string"
            ? (payload.job as string)
            : null;
        myAbilityActionThisPhase = {
          job,
          payload,
        };
      }
    }
  }

  return NextResponse.json({
    phase,
    stocks,
    playerState,
    players,
    logs,
    stockHistory,
    abilityResults,
    ticketPrice,
    myVoteSummary,
    hasUsedAbilityThisPhase,
    myAuctionBet,
    myAbilityActionThisPhase,
    myTradesThisRound,
  });
}
