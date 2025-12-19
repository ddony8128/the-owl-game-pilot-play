import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaPhaseState, MafiaPlayerState, Player } from "@/lib/types";

type VoteBody = {
  nickname?: string;
  target_id?: string;
  vote_count?: number;
};

type VoteResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as VoteBody | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as VoteResponse,
      { status: 400 }
    );
  }

  if (!body.target_id || typeof body.vote_count !== "number") {
    return NextResponse.json(
      { error: "target_id and vote_count are required" } as VoteResponse,
      { status: 400 }
    );
  }

  const nickname = body.nickname.trim();
  const vote_count = body.vote_count;

  if (!nickname || vote_count <= 0) {
    return NextResponse.json(
      { error: "invalid nickname or vote_count" } as VoteResponse,
      { status: 400 }
    );
  }

  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as VoteResponse, {
      status: 500,
    });
  }

  const phaseState = (phaseRow || null) as MafiaPhaseState | null;
  if (!phaseState) {
    return NextResponse.json(
      { error: "mafia_phase_state가 초기화되지 않았습니다." } as VoteResponse,
      { status: 500 }
    );
  }

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerError) {
    return NextResponse.json({ error: playerError.message } as VoteResponse, {
      status: 500,
    });
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as VoteResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;
  const roundNumber = phaseState.round_number;

  // 시장 능력에서 표 가격 결정: apply 페이즈 ability 중 job='mayor'의 ticket_price 사용, 없으면 1원
  let ticketPrice = 1;
  const { data: abilityRows, error: abilityError } = await supabase
    .from("mafia_actions")
    .select("payload")
    .eq("round_number", roundNumber)
    .eq("phase", "trade")
    .eq("action_type", "ability");

  if (!abilityError && abilityRows) {
    for (const row of abilityRows) {
      const payload = row.payload as {
        job?: string;
        ticket_price?: number;
      } | null;
      if (payload?.job === "mayor") {
        const tp = payload.ticket_price;
        if (tp === 1 || tp === 2 || tp === 3) {
          ticketPrice = tp;
        }
      }
    }
  }

  // 표 비용 차감 (잔액 검증 포함)
  const totalCost = ticketPrice * vote_count;
  const { data: voterStateRow, error: voterStateError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, stocks, updated_at")
    .eq("player_id", player.id)
    .maybeSingle();

  if (voterStateError) {
    return NextResponse.json(
      { error: voterStateError.message } as VoteResponse,
      { status: 500 }
    );
  }

  if (voterStateRow) {
    const voterState = voterStateRow as MafiaPlayerState;
    const nextCash = voterState.cash - totalCost;

    if (nextCash < 0) {
      return NextResponse.json(
        { error: "현금이 부족합니다." } as VoteResponse,
        { status: 400 }
      );
    }

    const { error: updateCashError } = await supabase
      .from("mafia_player_state")
      .update({ cash: nextCash })
      .eq("player_id", player.id);

    if (updateCashError) {
      return NextResponse.json(
        { error: updateCashError.message } as VoteResponse,
        { status: 500 }
      );
    }
  }

  const { error: insertError } = await supabase.from("mafia_votes").insert({
    round_number: roundNumber,
    voter_id: player.id,
    target_id: body.target_id,
    vote_count,
    unit_price: ticketPrice,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as VoteResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as VoteResponse, { status: 200 });
}
