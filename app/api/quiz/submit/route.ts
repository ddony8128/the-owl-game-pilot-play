import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, QuizPlayerState, QuizEvent } from "@/lib/types";

type Body = {
  nickname?: string;
  question_id?: number;
  answer?: string | null;
  used_chance?: string | null;
};

type SubmitResponse = { ok: true } | { error: string };

const CHANCE_KEYS = new Set(["peek", "bet", "safe"]);

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

  const nickname = body.nickname.trim();
  const rawAnswer = typeof body.answer === "string" ? body.answer.trim() : "";
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
  const questionId = body.question_id;

  const events: Omit<QuizEvent, "id" | "created_at">[] = [];

  if (rawAnswer) {
    events.push({
      player_id: player.id,
      question_id: questionId,
      event_type: "answer_submitted",
      payload: { answer: rawAnswer },
    });
  } else {
    // 무응답
    events.push({
      player_id: player.id,
      question_id: questionId,
      event_type: "skip",
      payload: {},
    });
  }

  if (used && CHANCE_KEYS.has(used)) {
    const eventType =
      used === "peek" ? "use_peek" : used === "bet" ? "use_bet" : "use_safe";

    events.push({
      player_id: player.id,
      question_id: questionId,
      event_type: eventType,
      payload: { question_id: questionId },
    });
  }

  const { error: insertError } = await supabase
    .from("quiz_events")
    .insert(events);

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as SubmitResponse, {
      status: 500,
    });
  }

  if (used && CHANCE_KEYS.has(used)) {
    const { data: stateRow, error: stateError } = await supabase
      .from("quiz_player_state")
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
      .from("quiz_player_state")
      .upsert(
        {
          player_id: player.id,
          score: current?.score ?? 0,
          chances: nextChances,
        },
        { onConflict: "player_id" }
      );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message } as SubmitResponse,
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true } as SubmitResponse, { status: 200 });
}
