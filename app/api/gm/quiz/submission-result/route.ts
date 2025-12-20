import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizEvent, QuizPlayerState } from "@/lib/types";

type Body = {
  id?: number;
  result?: string;
};

type ResultResponse = { ok: true } | { error: string };

const ALLOWED_RESULTS = new Set(["correct", "wrong", "skip"]);

async function recalcScoreForPlayer(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  playerId: string
) {
  const { data: eventsRows, error: eventsError } = await supabase
    .from("quiz_events")
    .select("id, player_id, question_id, event_type, payload, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const events = (eventsRows || []) as QuizEvent[];

  // 이 플레이어가 관여한 문제들(id) 수집
  const questionIdSet = new Set<number>();
  const safeByQuestion = new Map<number, boolean>();

  for (const e of events) {
    const qid = typeof e.question_id === "number" ? e.question_id : null;
    if (!qid) continue;
    questionIdSet.add(qid);
    if (e.event_type === "use_safe") {
      safeByQuestion.set(qid, true);
    }
  }

  // 각 문제별 전역 베팅 수(use_bet)를 집계 (모든 플레이어 기준)
  const globalBetCountByQuestion = new Map<number, number>();

  if (questionIdSet.size > 0) {
    const { data: betRows, error: betError } = await supabase
      .from("quiz_events")
      .select("question_id, event_type")
      .in("question_id", Array.from(questionIdSet))
      .eq("event_type", "use_bet");

    if (betError) {
      throw new Error(betError.message);
    }

    for (const row of betRows || []) {
      const rawQid = (row as { question_id: number | null }).question_id;
      const qid = typeof rawQid === "number" ? rawQid : null;
      if (!qid) continue;
      globalBetCountByQuestion.set(
        qid,
        (globalBetCountByQuestion.get(qid) ?? 0) + 1
      );
    }
  }

  let score = 0;
  let consecutiveCorrect = 0;

  for (const e of events) {
    if (e.event_type === "hidden_bonus") {
      score += 100;
      continue;
    }

    if (e.event_type !== "judge") continue;

    const qid = typeof e.question_id === "number" ? e.question_id : null;
    if (!qid) continue;

    const payload = (e.payload || {}) as {
      result?: string;
    };
    const result = payload.result;
    if (!result) continue;

    const globalBetCount = globalBetCountByQuestion.get(qid) ?? 0;
    const safeUsed = safeByQuestion.get(qid) ?? false;

    let netDelta = 0;
    if (result === "correct") {
      // 기본 100점 + 해당 문제에 들어간 전역 베팅 수 * 100점
      netDelta = 100 + globalBetCount * 100;
    } else if (result === "wrong") {
      if (safeUsed) {
        netDelta = 0;
      } else {
        // 기본 -100점 + 전역 베팅 수만큼 추가 손실
        netDelta = -100 - globalBetCount * 100;
      }
    } else if (result === "skip") {
      // 무응답 + 베팅도 전략:
      // - 본인 점수는 0점 유지 (netDelta = 0)
      // - 하지만 본인의 use_bet 이벤트도 전역 베팅 수에 포함되어,
      //   해당 문제 배점은 전체적으로 커진 상태가 된다.
      netDelta = 0;
    }

    const lostPoints = netDelta < 0;

    if (result === "correct") {
      consecutiveCorrect += 1;
    } else if (lostPoints) {
      consecutiveCorrect = 0;
    }

    if (result === "correct" && netDelta > 0) {
      const bonus = 50 * Math.max(0, consecutiveCorrect - 1);
      netDelta += bonus;
    }

    score += netDelta;
  }

  const { data: currentRow, error: fetchError } = await supabase
    .from("quiz_player_state")
    .select("player_id, score, chances, updated_at")
    .eq("player_id", playerId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const current = (currentRow || null) as QuizPlayerState | null;

  const { error: updateError } = await supabase
    .from("quiz_player_state")
    .upsert(
      {
        player_id: playerId,
        score,
        chances: current?.chances ?? { peek: true, bet: true, safe: true },
      },
      { onConflict: "player_id" }
    );

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.id !== "number") {
    return NextResponse.json({ error: "id is required" } as ResultResponse, {
      status: 400,
    });
  }

  if (typeof body.result !== "string" || !ALLOWED_RESULTS.has(body.result)) {
    return NextResponse.json({ error: "invalid result" } as ResultResponse, {
      status: 400,
    });
  }

  const submissionId = body.id;

  const { data: submitRow, error: fetchError } = await supabase
    .from("quiz_events")
    .select("id, player_id, question_id, event_type, payload, created_at")
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message } as ResultResponse, {
      status: 500,
    });
  }

  if (!submitRow) {
    return NextResponse.json(
      { error: "submission event not found" } as ResultResponse,
      { status: 404 }
    );
  }

  const submission = submitRow as QuizEvent;
  if (
    submission.event_type !== "answer_submitted" &&
    submission.event_type !== "skip"
  ) {
    return NextResponse.json(
      { error: "submission event is not answer/skip" } as ResultResponse,
      { status: 400 }
    );
  }

  const { error: insertError } = await supabase.from("quiz_events").insert({
    player_id: submission.player_id,
    question_id: submission.question_id,
    event_type: "judge",
    payload: { submission_id: submissionId, result: body.result },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as ResultResponse, {
      status: 500,
    });
  }

  try {
    if (submission.player_id) {
      await recalcScoreForPlayer(supabase, submission.player_id);
    }
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "점수 재계산에 실패했습니다.";
    return NextResponse.json({ error: message } as ResultResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as ResultResponse, { status: 200 });
}
