import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, QuizEvent } from "@/lib/types";

type Body = {
  nickname?: string;
  question_id?: number;
};

type PeekStatusResponse =
  | {
      is_peek_user: boolean;
      all_others_answered: boolean;
    }
  | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as PeekStatusResponse,
      { status: 400 }
    );
  }

  if (typeof body.question_id !== "number") {
    return NextResponse.json(
      { error: "question_id is required" } as PeekStatusResponse,
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
    return NextResponse.json(
      { error: playerError.message } as PeekStatusResponse,
      { status: 500 }
    );
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as PeekStatusResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;

  const { data: eventsRows, error: eventsError } = await supabase
    .from("quiz_events")
    .select("id, player_id, question_id, event_type, payload, created_at")
    .eq("question_id", questionId)
    .in("event_type", ["use_peek", "answer_submitted", "skip"]);

  if (eventsError) {
    return NextResponse.json(
      { error: eventsError.message } as PeekStatusResponse,
      { status: 500 }
    );
  }

  const events = (eventsRows || []) as QuizEvent[];

  const peekUsers = new Set<string>();
  const answeredUsers = new Set<string>();

  for (const e of events) {
    const pid = e.player_id;
    if (!pid) continue;
    if (e.event_type === "use_peek") {
      peekUsers.add(pid);
    }
    if (e.event_type === "answer_submitted" || e.event_type === "skip") {
      answeredUsers.add(pid);
    }
  }

  const isPeekUser = peekUsers.has(player.id);

  // "다른 참가자들"만 대상으로 모두 답변을 마쳤는지 확인
  const others = Array.from(peekUsers).filter((id) => id !== player.id);
  let allOthersAnswered = true;
  for (const id of others) {
    if (!answeredUsers.has(id)) {
      allOthersAnswered = false;
      break;
    }
  }

  return NextResponse.json(
    {
      is_peek_user: isPeekUser,
      all_others_answered: allOthersAnswered,
    } as PeekStatusResponse,
    { status: 200 }
  );
}
