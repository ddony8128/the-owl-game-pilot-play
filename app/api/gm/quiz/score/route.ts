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

  const playerId = body.player_id;
  const delta = body.delta;

  // 현재 점수 조회
  const { data: row, error: fetchError } = await supabase
    .from("quiz_player_state")
    .select("player_id, score, chances, updated_at")
    .eq("player_id", playerId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message } as ScoreResponse, {
      status: 500,
    });
  }

  const current = (row || null) as QuizPlayerState | null;
  const currentScore = current?.score ?? 0;
  const nextScore = currentScore + delta;

  // 수동 조정 이력을 quiz_events에 기록
  const { error: insertError } = await supabase.from("quiz_events").insert({
    player_id: playerId,
    question_id: null,
    event_type: "manual_adjust",
    payload: { delta },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as ScoreResponse, {
      status: 500,
    });
  }

  // quiz_player_state.score 도 즉시 업데이트 (UI 반영용)
  const { error: updateError } = await supabase
    .from("quiz_player_state")
    .update({ score: nextScore })
    .eq("player_id", playerId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message } as ScoreResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true, score: nextScore } as ScoreResponse, {
    status: 200,
  });
}
