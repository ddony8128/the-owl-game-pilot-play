import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Player,
  QuizPlayerState,
  QuizQuestion,
  QuizSubmission,
  QuizEvent,
} from "@/lib/types";

type ShowStateResponse =
  | {
      players: QuizPlayerState[];
      questions: QuizQuestion[];
      subs: QuizSubmission[];
      playerNames: Record<string, string>;
      streaks: Record<string, number>;
    }
  | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [playersRes, questionsRes, eventsRes, namesRes] = await Promise.all([
    supabase
      .from("quiz_player_state")
      .select("player_id, score, chances, updated_at"),
    supabase
      .from("quiz_questions")
      .select("id, question, options, correct_answer, is_open, updated_at"),
    supabase
      .from("quiz_events")
      .select("id, player_id, question_id, event_type, payload, created_at"),
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

  if (eventsRes.error) {
    return NextResponse.json(
      { error: eventsRes.error.message } as ShowStateResponse,
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
  const events = (eventsRes.data || []) as QuizEvent[];

  // quiz_events로부터 제출/찬스/채점 정보를 합성해 QuizSubmission 형태로 만든다.
  const subsMap = new Map<number, QuizSubmission>();

  for (const e of events) {
    if (e.event_type === "answer_submitted" || e.event_type === "skip") {
      const payload = (e.payload || {}) as { answer?: string | null };
      const answer = e.event_type === "skip" ? "" : payload.answer ?? "";

      subsMap.set(e.id as unknown as number, {
        id: e.id as unknown as number,
        player_id: e.player_id,
        question_id: e.question_id,
        answer,
        used_chance: null,
        result: null,
        created_at: e.created_at,
      });
    }
  }

  // 사용 찬스(use_peek/use_bet/use_safe)를 제출에 매핑
  for (const e of events) {
    if (
      e.event_type === "use_peek" ||
      e.event_type === "use_bet" ||
      e.event_type === "use_safe"
    ) {
      const used =
        e.event_type === "use_peek"
          ? "peek"
          : e.event_type === "use_bet"
          ? "bet"
          : "safe";

      // 같은 플레이어/문제의 제출을 찾아 used_chance 설정
      for (const sub of subsMap.values()) {
        if (
          sub.player_id === e.player_id &&
          sub.question_id === e.question_id &&
          !sub.used_chance
        ) {
          sub.used_chance = used;
          break;
        }
      }
    }
  }

  // 채점 결과(judge) 반영
  for (const e of events) {
    if (e.event_type === "judge") {
      const payload = (e.payload || {}) as {
        submission_id?: number;
        result?: string;
      };
      const sid = payload.submission_id;
      if (!sid) continue;
      const sub = subsMap.get(sid);
      if (sub && typeof payload.result === "string") {
        sub.result = payload.result;
      }
    }
  }

  const subs = Array.from(subsMap.values());

  // 플레이어별 연속 득점(streak) 계산
  const streaksMap = new Map<string, number>();
  const safeByPlayerQuestion = new Map<string, Map<number, boolean>>();

  for (const e of events) {
    const pid = e.player_id;
    const qid = typeof e.question_id === "number" ? e.question_id : null;
    if (!pid || !qid) continue;
    if (e.event_type === "use_safe") {
      let map = safeByPlayerQuestion.get(pid);
      if (!map) {
        map = new Map<number, boolean>();
        safeByPlayerQuestion.set(pid, map);
      }
      map.set(qid, true);
    }
  }

  for (const e of events) {
    const pid = e.player_id;
    const qid = typeof e.question_id === "number" ? e.question_id : null;
    if (!pid || !qid) continue;
    if (e.event_type !== "judge") continue;

    const payload = (e.payload || {}) as { result?: string };
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

    let streak = streaksMap.get(pid) ?? 0;
    if (result === "correct") {
      streak += 1;
    } else if (lostPoints) {
      streak = 0;
    }
    streaksMap.set(pid, streak);
  }

  const streaks: Record<string, number> = {};
  for (const [pid, value] of streaksMap.entries()) {
    streaks[pid] = value;
  }

  type PlayerName = Pick<Player, "id" | "nickname">;
  const map: Record<string, string> = {};
  ((namesRes.data || []) as PlayerName[]).forEach((p) => {
    map[p.id] = p.nickname;
  });

  return NextResponse.json({
    players,
    questions,
    subs,
    playerNames: map,
    streaks,
  });
}
