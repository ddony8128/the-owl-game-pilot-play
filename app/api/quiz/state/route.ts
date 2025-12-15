import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Player,
  QuizPlayerState,
  QuizQuestion,
  QuizSubmission,
} from "@/lib/types";

type QuizStateResponse =
  | {
      player: QuizPlayerState | null;
      questions: QuizQuestion[];
      submissions: QuizSubmission[];
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

  const [quizPlayerRes, questionsRes, subsRes] = await Promise.all([
    supabase
      .from("quiz_players")
      .select("player_id, score, chances, updated_at")
      .eq("player_id", player.id)
      .maybeSingle(),
    supabase
      .from("quiz_questions")
      .select("id, question, options, correct_answer, is_open, updated_at"),
    supabase
      .from("quiz_submissions")
      .select(
        "id, player_id, question_id, answer, used_chance, result, created_at"
      )
      .eq("player_id", player.id),
  ]);

  if (quizPlayerRes.error) {
    return NextResponse.json(
      { error: quizPlayerRes.error.message } as QuizStateResponse,
      { status: 500 }
    );
  }

  if (questionsRes.error) {
    return NextResponse.json(
      { error: questionsRes.error.message } as QuizStateResponse,
      { status: 500 }
    );
  }

  if (subsRes.error) {
    return NextResponse.json(
      { error: subsRes.error.message } as QuizStateResponse,
      { status: 500 }
    );
  }

  const quizPlayer = (quizPlayerRes.data || null) as QuizPlayerState | null;
  const questions = (questionsRes.data || []) as QuizQuestion[];
  const submissions = (subsRes.data || []) as QuizSubmission[];

  return NextResponse.json({ player: quizPlayer, questions, submissions });
}
