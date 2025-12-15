import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaPhaseState, Player } from "@/lib/types";

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

  const { error: insertError } = await supabase.from("mafia_votes").insert({
    round_number: phaseState.round_number,
    voter_id: player.id,
    target_id: body.target_id,
    vote_count,
    unit_price: null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as VoteResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as VoteResponse, { status: 200 });
}
