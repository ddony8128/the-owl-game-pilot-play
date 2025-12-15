import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Player,
  QuizPlayerState,
  QuizQuestion,
  QuizSubmission,
} from "@/lib/types";

type ShowStateResponse =
  | {
      players: QuizPlayerState[];
      questions: QuizQuestion[];
      subs: QuizSubmission[];
      playerNames: Record<string, string>;
    }
  | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [playersRes, questionsRes, subsRes, namesRes] = await Promise.all([
    supabase
      .from("quiz_players")
      .select("player_id, score, chances, updated_at"),
    supabase
      .from("quiz_questions")
      .select("id, question, options, correct_answer, is_open, updated_at"),
    supabase
      .from("quiz_submissions")
      .select(
        "id, player_id, question_id, answer, used_chance, result, created_at"
      ),
    supabase.from("players").select("id, nickname"),
  ]);

  if (playersRes.error) {
    return NextResponse.json(
      { error: playersRes.error.message } as ShowStateResponse,
      { status: 500 }
    );
  }

  if (questionsRes.error) {
    return NextResponse.json(
      { error: questionsRes.error.message } as ShowStateResponse,
      { status: 500 }
    );
  }

  if (subsRes.error) {
    return NextResponse.json(
      { error: subsRes.error.message } as ShowStateResponse,
      { status: 500 }
    );
  }

  if (namesRes.error) {
    return NextResponse.json(
      { error: namesRes.error.message } as ShowStateResponse,
      { status: 500 }
    );
  }

  const players = (playersRes.data || []) as QuizPlayerState[];
  const questions = (questionsRes.data || []) as QuizQuestion[];
  const subs = (subsRes.data || []) as QuizSubmission[];

  const map: Record<string, string> = {};
  (namesRes.data || []).forEach((p: Player) => {
    map[p.id] = p.nickname;
  });

  return NextResponse.json({ players, questions, subs, playerNames: map });
}
