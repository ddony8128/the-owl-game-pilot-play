import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, QuizPlayerState } from "@/lib/types";

type Body = {
  nickname?: string;
  question_id?: number;
  answer?: string;
  used_chance?: string | null;
};

type SubmitResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as SubmitResponse,
      { status: 400 }
    );
  }

  if (typeof body.question_id !== "number") {
    return NextResponse.json(
      { error: "question_id is required" } as SubmitResponse,
      { status: 400 }
    );
  }

  if (!body.answer || !body.answer.trim()) {
    return NextResponse.json(
      { error: "answer is required" } as SubmitResponse,
      { status: 400 }
    );
  }

  const nickname = body.nickname.trim();
  const answer = body.answer.trim();
  const used = body.used_chance ?? null;

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerError) {
    return NextResponse.json({ error: playerError.message } as SubmitResponse, {
      status: 500,
    });
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as SubmitResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;

  const { error: insertError } = await supabase
    .from("quiz_submissions")
    .insert({
      player_id: player.id,
      question_id: body.question_id,
      answer,
      used_chance: used,
      result: null,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as SubmitResponse, {
      status: 500,
    });
  }

  if (used) {
    const { data: stateRow, error: stateError } = await supabase
      .from("quiz_players")
      .select("player_id, score, chances, updated_at")
      .eq("player_id", player.id)
      .maybeSingle();

    if (stateError) {
      return NextResponse.json(
        { error: stateError.message } as SubmitResponse,
        { status: 500 }
      );
    }

    const current = (stateRow || null) as QuizPlayerState | null;
    const chances = (current?.chances as Record<string, unknown> | null) || {};
    const nextChances = { ...chances, [used]: false };

    const { error: updateError } = await supabase
      .from("quiz_players")
      .update({ chances: nextChances })
      .eq("player_id", player.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message } as SubmitResponse,
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true } as SubmitResponse, { status: 200 });
}
