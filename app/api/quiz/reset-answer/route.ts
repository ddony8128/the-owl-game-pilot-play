import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type Body = {
  nickname?: string;
  question_id?: number;
};

type ResetResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as ResetResponse,
      { status: 400 }
    );
  }

  if (typeof body.question_id !== "number") {
    return NextResponse.json(
      { error: "question_id is required" } as ResetResponse,
      { status: 400 }
    );
  }

  const nickname = body.nickname.trim();
  const questionId = body.question_id;

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerError) {
    return NextResponse.json({ error: playerError.message } as ResetResponse, {
      status: 500,
    });
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as ResetResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;

  const { error: deleteError } = await supabase
    .from("quiz_events")
    .delete()
    .eq("player_id", player.id)
    .eq("question_id", questionId)
    .in("event_type", ["answer_submitted", "skip"]);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message } as ResetResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as ResetResponse, { status: 200 });
}
