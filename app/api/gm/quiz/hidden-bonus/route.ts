import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizEvent, QuizPlayerState } from "@/lib/types";

type Body = {
  player_id?: string;
};

type HiddenBonusResponse = { ok: true } | { error: string };

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

  const betCountByQuestion = new Map<number, number>();
  const safeByQuestion = new Map<number, boolean>();

  for (const e of events) {
    const qid = typeof e.question_id === "number" ? e.question_id : null;
    if (!qid) continue;
    if (e.event_type === "use_bet") {
      betCountByQuestion.set(qid, (betCountByQuestion.get(qid) ?? 0) + 1);
    } else if (e.event_type === "use_safe") {
      safeByQuestion.set(qid, true);
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

    const betCount = betCountByQuestion.get(qid) ?? 0;
    const safeUsed = safeByQuestion.get(qid) ?? false;

    let baseDelta = 0;
    if (result === "correct") {
      baseDelta = 100;
    } else if (result === "wrong") {
      baseDelta = -100;
    } else if (result === "skip") {
      baseDelta = 0;
    }

    let netDelta = baseDelta;
    if (result === "correct") {
      netDelta += betCount * 100;
    } else if (result === "wrong") {
      if (safeUsed) {
        netDelta = 0;
      } else {
        netDelta += betCount * -100;
      }
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

  if (!body || typeof body.player_id !== "string") {
    return NextResponse.json(
      { error: "player_id is required" } as HiddenBonusResponse,
      { status: 400 }
    );
  }

  const playerId = body.player_id;

  const { data: existingRows, error: checkError } = await supabase
    .from("quiz_events")
    .select("id, player_id, question_id, event_type, payload, created_at")
    .eq("player_id", playerId)
    .eq("event_type", "hidden_bonus");

  if (checkError) {
    return NextResponse.json(
      { error: checkError.message } as HiddenBonusResponse,
      { status: 500 }
    );
  }

  if (existingRows && existingRows.length > 0) {
    return NextResponse.json({ ok: true } as HiddenBonusResponse, {
      status: 200,
    });
  }

  const { error: insertError } = await supabase.from("quiz_events").insert({
    player_id: playerId,
    question_id: null,
    event_type: "hidden_bonus",
    payload: {},
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message } as HiddenBonusResponse,
      { status: 500 }
    );
  }

  try {
    await recalcScoreForPlayer(supabase, playerId);
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "점수 재계산에 실패했습니다.";
    return NextResponse.json({ error: message } as HiddenBonusResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as HiddenBonusResponse, {
    status: 200,
  });
}
