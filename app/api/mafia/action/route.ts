import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaPhaseState, Player } from "@/lib/types";

type ActionBody = {
  nickname?: string;
  type?: string;
  payload?: unknown;
};

type ActionResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as ActionBody | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as ActionResponse,
      { status: 400 }
    );
  }

  if (!body.type) {
    return NextResponse.json({ error: "type is required" } as ActionResponse, {
      status: 400,
    });
  }

  const nickname = body.nickname.trim();
  const action_type = body.type.trim();

  if (!nickname || !action_type) {
    return NextResponse.json(
      { error: "invalid nickname or type" } as ActionResponse,
      { status: 400 }
    );
  }

  // 현재 phase/round 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as ActionResponse, {
      status: 500,
    });
  }

  const phaseState = (phaseRow || null) as MafiaPhaseState | null;
  if (!phaseState) {
    return NextResponse.json(
      { error: "mafia_phase_state가 초기화되지 않았습니다." } as ActionResponse,
      { status: 500 }
    );
  }

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerError) {
    return NextResponse.json({ error: playerError.message } as ActionResponse, {
      status: 500,
    });
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as ActionResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;
  const phase = phaseState.phase;

  // 페이즈별로 허용되는 액션 제한
  const isAllowedAction = (() => {
    if (phase === "auction") {
      // 경매 페이즈에서는 bet만 허용
      return action_type === "bet";
    }
    if (phase === "trade") {
      // 거래 페이즈에서는 주식 거래 및 능력 사용만 허용
      return (
        action_type === "buy" ||
        action_type === "sell" ||
        action_type === "ability"
      );
    }
    // 그 외 페이즈에서는 액션을 허용하지 않는다.
    return false;
  })();

  if (!isAllowedAction) {
    return NextResponse.json(
      {
        error: "현재 페이즈에서는 이 행동을 할 수 없습니다.",
      } as ActionResponse,
      { status: 400 }
    );
  }

  // 능력 사용은 라운드/페이즈당 1회만 허용
  if (action_type === "ability") {
    const { data: existingAbility, error: existingError } = await supabase
      .from("mafia_actions")
      .select("id")
      .eq("player_id", player.id)
      .eq("round_number", phaseState.round_number)
      .eq("phase", phaseState.phase)
      .eq("action_type", "ability")
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message } as ActionResponse,
        { status: 500 }
      );
    }

    if (existingAbility) {
      return NextResponse.json(
        {
          error: "이번 라운드에서는 이미 능력을 사용했습니다.",
        } as ActionResponse,
        { status: 400 }
      );
    }
  }

  // 직업 경매 베팅도 라운드/페이즈당 1회만 허용
  if (action_type === "bet") {
    const { data: existingBet, error: existingBetError } = await supabase
      .from("mafia_actions")
      .select("id")
      .eq("player_id", player.id)
      .eq("round_number", phaseState.round_number)
      .eq("phase", phaseState.phase)
      .eq("action_type", "bet")
      .maybeSingle();

    if (existingBetError) {
      return NextResponse.json(
        { error: existingBetError.message } as ActionResponse,
        { status: 500 }
      );
    }

    if (existingBet) {
      return NextResponse.json(
        {
          error: "이번 라운드에서는 이미 직업 경매에 베팅했습니다.",
        } as ActionResponse,
        { status: 400 }
      );
    }

    const payload = (body.payload ?? {}) as {
      job?: string | null;
      amount?: number;
      give_up?: boolean;
    };

    const amount =
      typeof payload.amount === "number" && payload.amount > 0
        ? Math.floor(payload.amount)
        : 0;
    const giveUp = payload.give_up === true;

    // 포기(give_up)는 금액 검증 없이 허용
    if (!giveUp) {
      if (amount <= 0) {
        return NextResponse.json(
          { error: "유효한 베팅 금액을 입력해 주세요." } as ActionResponse,
          { status: 400 }
        );
      }

      // 플레이어 현금 조회 후, 보유 현금을 초과하는 베팅은 거부
      const { data: stateRow, error: stateError } = await supabase
        .from("mafia_player_state")
        .select("player_id, cash, is_mafia, job, stocks, updated_at")
        .eq("player_id", player.id)
        .maybeSingle();

      if (stateError) {
        return NextResponse.json(
          { error: stateError.message } as ActionResponse,
          { status: 500 }
        );
      }

      const currentCash =
        stateRow && typeof stateRow.cash === "number" ? stateRow.cash : 0;

      if (amount > currentCash) {
        return NextResponse.json(
          {
            error: "보유 현금을 초과해서 베팅할 수 없습니다.",
          } as ActionResponse,
          { status: 400 }
        );
      }
    }
  }

  // 주식 거래: 즉시 현금/보유 주식에 반영 + 검증
  if (action_type === "buy" || action_type === "sell") {
    const payload = (body.payload ?? {}) as {
      stock_key?: string;
      amount?: number;
    };

    const stockKey =
      typeof payload.stock_key === "string" && payload.stock_key.length > 0
        ? payload.stock_key
        : null;
    const amount =
      typeof payload.amount === "number" && payload.amount > 0
        ? Math.floor(payload.amount)
        : 0;

    if (!stockKey || amount <= 0) {
      return NextResponse.json(
        { error: "유효한 종목과 수량을 입력해 주세요." } as ActionResponse,
        { status: 400 }
      );
    }

    // 같은 라운드/페이즈/종목에 대해 매수·매도를 동시에 할 수 없음
    const oppositeType = action_type === "buy" ? "sell" : "buy";
    const { data: oppositeRow, error: oppositeError } = await supabase
      .from("mafia_actions")
      .select("id")
      .eq("player_id", player.id)
      .eq("round_number", phaseState.round_number)
      .eq("phase", phaseState.phase)
      .eq("action_type", oppositeType)
      // JSON 필드 stock_key가 동일한 경우만 막는다
      .eq("payload->>stock_key", stockKey)
      .maybeSingle();

    if (oppositeError) {
      return NextResponse.json(
        { error: oppositeError.message } as ActionResponse,
        { status: 500 }
      );
    }

    if (oppositeRow) {
      return NextResponse.json(
        {
          error:
            "같은 라운드에서는 같은 종목을 매수와 매도 둘 다 할 수 없습니다.",
        } as ActionResponse,
        { status: 400 }
      );
    }

    // 현재 주가 조회
    const { data: stockRow, error: stockError } = await supabase
      .from("mafia_stock_state")
      .select("stock_key, price")
      .eq("stock_key", stockKey)
      .maybeSingle();

    if (stockError) {
      return NextResponse.json(
        { error: stockError.message } as ActionResponse,
        { status: 500 }
      );
    }

    const price =
      stockRow && typeof stockRow.price === "number" ? stockRow.price : 0;
    if (price <= 0) {
      return NextResponse.json(
        { error: "유효하지 않은 주가입니다." } as ActionResponse,
        { status: 400 }
      );
    }

    // 플레이어 자산 상태 조회
    const { data: stateRow, error: stateError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("player_id", player.id)
      .maybeSingle();

    if (stateError) {
      return NextResponse.json(
        { error: stateError.message } as ActionResponse,
        { status: 500 }
      );
    }

    if (!stateRow) {
      return NextResponse.json(
        {
          error:
            "플레이어 자산 상태가 초기화되지 않았습니다. GM에게 문의해 주세요.",
        } as ActionResponse,
        { status: 500 }
      );
    }

    const currentCash = typeof stateRow.cash === "number" ? stateRow.cash : 0;
    const rawStocks = (stateRow as unknown as { stocks?: unknown }).stocks;
    const stocks: Record<string, { amount: number }> =
      rawStocks && typeof rawStocks === "object"
        ? { ...(rawStocks as Record<string, { amount: number }>) }
        : {};

    const prevAmount =
      typeof stocks[stockKey]?.amount === "number"
        ? stocks[stockKey].amount
        : 0;

    let nextCash = currentCash;
    let nextAmount = prevAmount;

    if (action_type === "buy") {
      const totalCost = price * amount;
      nextCash = currentCash - totalCost;
      if (nextCash < 0) {
        return NextResponse.json(
          { error: "현금이 부족합니다." } as ActionResponse,
          { status: 400 }
        );
      }
      nextAmount = prevAmount + amount;
    } else {
      // sell
      if (prevAmount < amount) {
        return NextResponse.json(
          {
            error: "보유 수량보다 많이 매도할 수 없습니다.",
          } as ActionResponse,
          { status: 400 }
        );
      }
      const revenue = price * amount;
      nextCash = currentCash + revenue;
      nextAmount = prevAmount - amount;
    }

    stocks[stockKey] = { amount: nextAmount };

    const { error: updateStateError } = await supabase
      .from("mafia_player_state")
      .update({
        cash: nextCash,
        stocks,
      })
      .eq("player_id", player.id);

    if (updateStateError) {
      return NextResponse.json(
        { error: updateStateError.message } as ActionResponse,
        { status: 500 }
      );
    }

    // payload는 이후 주가 변동/강도 계산 등을 위해 그대로 기록
    body.payload = {
      stock_key: stockKey,
      amount,
    };
  }

  const { error: insertError } = await supabase.from("mafia_actions").insert({
    player_id: player.id,
    round_number: phaseState.round_number,
    phase: phaseState.phase,
    action_type,
    payload: body.payload ?? {},
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as ActionResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as ActionResponse, { status: 200 });
}
