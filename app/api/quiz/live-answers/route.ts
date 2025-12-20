import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizEvent } from "@/lib/types";

type LiveAnswersResponse =
  | {
      answers: { nickname: string; answer: string | null }[];
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const questionIdParam = searchParams.get("question_id");

  const questionId = questionIdParam ? Number(questionIdParam) : NaN;
  if (!Number.isFinite(questionId)) {
    return NextResponse.json(
      { error: "question_id is required" } as LiveAnswersResponse,
      { status: 400 }
    );
  }

  // 결승 진출자 목록 조회
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist")
    .eq("is_finalist", true);

  if (playersError) {
    return NextResponse.json(
      { error: playersError.message } as LiveAnswersResponse,
      { status: 500 }
    );
  }

  const finalistNicknameById = new Map<string, string>();
  for (const row of playerRows || []) {
    const id = (row as { id: string }).id;
    const nickname =
      (row as { nickname: string | null }).nickname ?? "(이름 없음)";
    finalistNicknameById.set(id, nickname);
  }

  if (finalistNicknameById.size === 0) {
    return NextResponse.json({ answers: [] } as LiveAnswersResponse, {
      status: 200,
    });
  }

  // 해당 문제에 대한 결승 진출자들의 답안/무응답 이벤트 조회
  const { data: eventsRows, error: eventsError } = await supabase
    .from("quiz_events")
    .select("id, player_id, question_id, event_type, payload, created_at")
    .eq("question_id", questionId)
    .in("event_type", ["answer_submitted", "skip"])
    .order("created_at", { ascending: true });

  if (eventsError) {
    return NextResponse.json(
      { error: eventsError.message } as LiveAnswersResponse,
      { status: 500 }
    );
  }

  const events = (eventsRows || []) as QuizEvent[];

  // 각 결승 진출자별로 가장 마지막 답안을 사용
  const latestAnswerById = new Map<string, string>();

  for (const e of events) {
    const pid = e.player_id;
    if (!pid) continue;
    if (!finalistNicknameById.has(pid)) continue;

    const payload = (e.payload || {}) as { answer?: string | null };
    const answerText = (payload.answer ?? "").trim();
    latestAnswerById.set(pid, answerText);
  }

  const answers = Array.from(latestAnswerById.entries()).map(
    ([playerId, answer]) => ({
      nickname: finalistNicknameById.get(playerId) ?? "(이름 없음)",
      answer: answer.length > 0 ? answer : null,
    })
  );

  return NextResponse.json({ answers } as LiveAnswersResponse, {
    status: 200,
  });
}
