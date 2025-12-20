import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizPlayerState } from "@/lib/types";

type LiveScoresResponse =
  | {
      players: {
        nickname: string;
        score: number;
        chances: { peek: boolean; bet: boolean; safe: boolean };
        streak: number;
      }[];
    }
  | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist")
    .eq("is_finalist", true);

  if (playersError) {
    return NextResponse.json(
      { error: playersError.message } as LiveScoresResponse,
      { status: 500 }
    );
  }

  const finalists = (playerRows || []) as {
    id: string;
    nickname: string | null;
  }[];

  if (finalists.length === 0) {
    return NextResponse.json({ players: [] } as LiveScoresResponse, {
      status: 200,
    });
  }

  const finalistIds = finalists.map((p) => p.id);

  const { data: stateRows, error: stateError } = await supabase
    .from("quiz_player_state")
    .select("player_id, score, chances, updated_at")
    .in("player_id", finalistIds);

  if (stateError) {
    return NextResponse.json(
      { error: stateError.message } as LiveScoresResponse,
      { status: 500 }
    );
  }

  const states = (stateRows || []) as QuizPlayerState[];

  const scoreById = new Map<string, number>();
  const chancesById = new Map<
    string,
    { peek: boolean; bet: boolean; safe: boolean }
  >();
  const streakById = new Map<string, number>();

  for (const s of states) {
    scoreById.set(s.player_id, s.score ?? 0);
    const raw = (s.chances as Record<string, unknown> | null) || {};
    const peek = raw.peek !== false;
    const bet = raw.bet !== false;
    const safe = raw.safe !== false;
    chancesById.set(s.player_id, { peek, bet, safe });
  }

  // 연속 득점(streak) 계산을 위해 결승자들의 judge/use_safe 이벤트를 조회
  const { data: eventsRows, error: eventsError } = await supabase
    .from("quiz_events")
    .select("player_id, question_id, event_type, payload, created_at")
    .in("player_id", finalistIds)
    .order("created_at", { ascending: true });

  if (eventsError) {
    return NextResponse.json(
      { error: eventsError.message } as LiveScoresResponse,
      { status: 500 }
    );
  }

  const safeByPlayerQuestion = new Map<string, Map<number, boolean>>();
  const streakTemp = new Map<string, number>();

  for (const row of eventsRows || []) {
    const pid = (row as { player_id: string | null }).player_id;
    const rawQid = (row as { question_id: number | null }).question_id;
    const qid = typeof rawQid === "number" ? rawQid : null;
    const eventType = (row as { event_type: string }).event_type;
    if (!pid || !qid) continue;
    if (eventType === "use_safe") {
      let map = safeByPlayerQuestion.get(pid);
      if (!map) {
        map = new Map<number, boolean>();
        safeByPlayerQuestion.set(pid, map);
      }
      map.set(qid, true);
    }
  }

  for (const row of eventsRows || []) {
    const pid = (row as { player_id: string | null }).player_id;
    const rawQid = (row as { question_id: number | null }).question_id;
    const qid = typeof rawQid === "number" ? rawQid : null;
    const eventType = (row as { event_type: string }).event_type;
    if (!pid || !qid) continue;
    if (eventType !== "judge") continue;

    const payload = ((row as { payload: Record<string, unknown> | null })
      .payload || { result: undefined }) as { result?: string };
    const result = payload.result;
    if (!result) continue;

    const safeMap = safeByPlayerQuestion.get(pid);
    const safeUsed = safeMap?.get(qid) ?? false;

    let baseDelta = 0;
    if (result === "correct") {
      baseDelta = 100;
    } else if (result === "wrong") {
      baseDelta = -100;
    } else if (result === "skip") {
      baseDelta = 0;
    }

    let netDelta = baseDelta;
    if (result === "wrong" && safeUsed) {
      netDelta = 0;
    }

    const lostPoints = netDelta < 0;

    let streak = streakTemp.get(pid) ?? 0;
    if (result === "correct") {
      streak += 1;
    } else if (lostPoints) {
      streak = 0;
    }
    streakTemp.set(pid, streak);
  }

  for (const [pid, value] of streakTemp.entries()) {
    streakById.set(pid, value);
  }

  const players = finalists.map((p) => {
    const chances = chancesById.get(p.id) ?? {
      peek: true,
      bet: true,
      safe: true,
    };
    return {
      nickname: p.nickname ?? "(이름 없음)",
      score: scoreById.get(p.id) ?? 0,
      chances,
      streak: streakById.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({ players } as LiveScoresResponse, { status: 200 });
}
