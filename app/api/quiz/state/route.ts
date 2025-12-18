import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Player,
  QuizPlayerState,
  QuizQuestion,
  QuizEvent,
} from "@/lib/types";

type QuizStateResponse =
  | {
      player: QuizPlayerState | null;
      openQuestions: QuizQuestion[];
      events: QuizEvent[];
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname");

  if (!nickname) {
    return NextResponse.json(
      { error: "nickname is required" } as QuizStateResponse,
      { status: 400 }
    );
  }

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname.trim())
    .maybeSingle();

  if (playerError) {
    return NextResponse.json(
      { error: playerError.message } as QuizStateResponse,
      { status: 500 }
    );
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as QuizStateResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;

  const [quizPlayerRes, openQuestionsRes] = await Promise.all([
    supabase
      .from("quiz_player_state")
      .select("player_id, score, chances, updated_at")
      .eq("player_id", player.id)
      .maybeSingle(),
    supabase
      .from("quiz_questions")
      .select("id, question, options, correct_answer, is_open, updated_at")
      .eq("is_open", true)
      .order("id", { ascending: true }),
  ]);

  if (quizPlayerRes.error) {
    return NextResponse.json(
      { error: quizPlayerRes.error.message } as QuizStateResponse,
      { status: 500 }
    );
  }

  if (openQuestionsRes.error) {
    return NextResponse.json(
      { error: openQuestionsRes.error.message } as QuizStateResponse,
      { status: 500 }
    );
  }

  const quizPlayer = (quizPlayerRes.data || null) as QuizPlayerState | null;
  const openQuestions = (openQuestionsRes.data || []) as QuizQuestion[];

  let events: QuizEvent[] = [];

  if (openQuestions.length > 0) {
    const openIds = openQuestions.map((q) => q.id);
    const { data: eventsRows, error: eventsError } = await supabase
      .from("quiz_events")
      .select("id, player_id, question_id, event_type, payload, created_at")
      .eq("player_id", player.id)
      .in("question_id", openIds);

    if (eventsError) {
      return NextResponse.json(
        { error: eventsError.message } as QuizStateResponse,
        { status: 500 }
      );
    }

    events = (eventsRows || []) as QuizEvent[];
  }

  return NextResponse.json({
    player: quizPlayer,
    openQuestions,
    events,
  });
}
