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
    .select("id, nickname, is_finalist, created_at")
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
