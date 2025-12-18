import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizPlayerState } from "@/lib/types";

type Body = {
  player_id?: string;
  delta?: number;
};

type ScoreResponse = { ok: true; score: number } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.player_id !== "string") {
    return NextResponse.json(
      { error: "player_id is required" } as ScoreResponse,
      { status: 400 }
    );
  }

  if (typeof body.delta !== "number") {
    return NextResponse.json({ error: "delta is required" } as ScoreResponse, {
      status: 400,
    });
  }

  const { data: row, error: fetchError } = await supabase
    .from("quiz_player_state")
    .select("player_id, score, chances, updated_at")
    .eq("player_id", body.player_id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message } as ScoreResponse, {
      status: 500,
    });
  }

  const current = (row || null) as QuizPlayerState | null;
  const currentScore = current?.score ?? 0;
  const nextScore = currentScore + body.delta;

  const { error: updateError } = await supabase
    .from("quiz_player_state")
    .update({ score: nextScore })
    .eq("player_id", body.player_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message } as ScoreResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true, score: nextScore } as ScoreResponse, {
    status: 200,
  });
}
