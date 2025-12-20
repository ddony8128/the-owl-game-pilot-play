import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, QuizEvent, QuizPlayerState } from "@/lib/types";

type Body = {
  nickname?: string;
  question_id?: number;
};

type PeekAnswersResponse =
  | {
      answers: { nickname: string; answer: string }[];
    }
  | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as PeekAnswersResponse,
      { status: 400 }
    );
  }

  if (typeof body.question_id !== "number") {
    return NextResponse.json(
      { error: "question_id is required" } as PeekAnswersResponse,
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
      { error: playerError.message } as PeekAnswersResponse,
      { status: 500 }
    );
  }

  if (!playerRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as PeekAnswersResponse,
      { status: 403 }
    );
  }

  const player = playerRow as Player;

  // 찬스 사용 가능 여부 확인 (peek이 이미 사용되었는지 체크)
  const { data: stateRow, error: stateError } = await supabase
    .from("quiz_player_state")
    .select("player_id, score, chances, updated_at")
    .eq("player_id", player.id)
    .maybeSingle();

  if (stateError) {
    return NextResponse.json(
      { error: stateError.message } as PeekAnswersResponse,
      { status: 500 }
    );
  }

  const current = (stateRow || null) as QuizPlayerState | null;
  const chances = (current?.chances as Record<string, unknown> | null) || {};
  const canUsePeek = chances.peek !== false;

  if (!canUsePeek) {
    return NextResponse.json(
      { error: "peek chance is already used" } as PeekAnswersResponse,
      { status: 403 }
    );
  }

  // 다른 플레이어들의 답안 조회
  const { data: eventsRows, error: eventsError } = await supabase
    .from("quiz_events")
    .select("id, player_id, question_id, event_type, payload, created_at")
    .eq("question_id", questionId)
    .eq("event_type", "answer_submitted");

  if (eventsError) {
    return NextResponse.json(
      { error: eventsError.message } as PeekAnswersResponse,
      { status: 500 }
    );
  }

  const events = (eventsRows || []) as QuizEvent[];

  // 본인 이외의 플레이어 id 수집
  const otherPlayerIds = new Set<string>();
  for (const e of events) {
    const pid = e.player_id;
    if (!pid || pid === player.id) continue;
    otherPlayerIds.add(pid);
  }

  // 해당 플레이어들의 닉네임 조회
  const nicknameById = new Map<string, string>();
  if (otherPlayerIds.size > 0) {
    const { data: playerRows, error: othersError } = await supabase
      .from("players")
      .select("id, nickname")
      .in("id", Array.from(otherPlayerIds));

    if (othersError) {
      return NextResponse.json(
        { error: othersError.message } as PeekAnswersResponse,
        { status: 500 }
      );
    }

    for (const row of playerRows || []) {
      const id = (row as { id: string }).id;
      const nickname =
        (row as { nickname: string | null }).nickname ?? "(이름 없음)";
      nicknameById.set(id, nickname);
    }
  }

  // peek 찬스를 실제로 사용한 것으로 처리 (한 번만 사용 가능)
  const nextChances = { ...chances, peek: false };

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
      { error: updateError.message } as PeekAnswersResponse,
      { status: 500 }
    );
  }

  const answers = events
    .filter((e) => e.player_id && e.player_id !== player.id)
    .map((e) => {
      const payload = (e.payload || {}) as { answer?: string | null };
      const answerText = (payload.answer ?? "").trim();
      const nickname = nicknameById.get(e.player_id as string) ?? "(이름 없음)";
      return { nickname, answer: answerText };
    })
    .filter((a) => a.answer.length > 0);

  return NextResponse.json({ answers } as PeekAnswersResponse, {
    status: 200,
  });
}
