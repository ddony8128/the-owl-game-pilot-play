import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { DefensePhaseState } from "@/lib/types";
import { handleDefenseInitRound } from "./initGame";
import { handleDefenseAdvanceRound } from "./advanceRound";
import { publishDefensePhase } from "@/lib/defensePhaseEvents";

type Body = {
  room?: string;
  round?: number;
};

type ResponseBody =
  | {
      ok: true;
      phase: DefensePhaseState;
      board: { view: "monsters" | "result" | "score"; round: number; updatedAt: string } | null;
      timerReset: boolean;
    }
  | { error: string };

function missingBoardColumns(message: string) {
  return /board_(view|round|updated_at)/i.test(message);
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) {
    return NextResponse.json({ error: "room 필요" } as ResponseBody, {
      status: 400,
    });
  }

  if (!body || typeof body.round !== "number") {
    return NextResponse.json({ error: "round is required" } as ResponseBody, {
      status: 400,
    });
  }

  const nextRound = body.round;
  // DB round 기준:
  // 0: 준비
  // 1~2: 튜토리얼 1, 2라운드
  // 3: 튜토리얼 결과
  // 4~15: 본게임 1~12라운드
  // 16: 본게임 결과 (게임 종료)
  if (nextRound < 0 || nextRound > 16) {
    return NextResponse.json(
      { error: "round must be between 0 and 12" } as ResponseBody,
      { status: 400 }
    );
  }

  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("room_code, round, updated_at, board_view, board_round")
    .eq("room_code", room)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json(
      { error: phaseError.message } as ResponseBody,
      { status: 500 }
    );
  }

  const current = (phaseRow || null) as DefensePhaseState | null;
  if (!current) {
    return NextResponse.json(
      {
        error: "defense_phase_state가 초기화되지 않았습니다.",
      } as ResponseBody,
      { status: 500 }
    );
  }

  if (nextRound !== current.round + 1) {
    return NextResponse.json(
      {
        error: `현재 라운드(${current.round})에서 ${nextRound}로는 이동할 수 없습니다.`,
      } as ResponseBody,
      { status: 400 }
    );
  }

  const currentBoard = phaseRow as
    | (DefensePhaseState & { board_view?: string; board_round?: number })
    | null;
  const resultPending =
    currentBoard?.board_view === "result" &&
    currentBoard.board_round === current.round;
  const scorePending =
    currentBoard?.board_view === "score" &&
    currentBoard.board_round === current.round &&
    (current.round === 7 || current.round === 11);
  const transitionPending = resultPending || scorePending;
  const startsGame =
    (current.round === 0 && nextRound === 1) ||
    (current.round === 3 && nextRound === 4);

  try {
    // 초기화 라운드 전환: 0->1 (튜토 시작), 3->4 (본게임 시작)
    if (startsGame) {
      await handleDefenseInitRound(supabase, current, nextRound, room);
    } else if (!transitionPending &&
      // 그 외 1->2, 2->3, 4->5, ..., 14->15, 15->16는 공통 전환 로직 실행
      current.round >= 1 &&
      current.round <= 15 &&
      nextRound === current.round + 1
    ) {
      await handleDefenseAdvanceRound(supabase, current, nextRound, room);
    }
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "디펜스 라운드 전환 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message } as ResponseBody, {
      status: 500,
    });
  }

  // 시작 단계는 다음 라운드로 진입한다. 일반 라운드는 먼저 현재 라운드의
  // 결과를 고정하고, 같은 버튼을 한 번 더 눌렀을 때 다음 라운드로 진입한다.
  const checkpointResult =
    resultPending && (current.round === 7 || current.round === 11);
  const finishTransition =
    startsGame || scorePending || (resultPending && !checkpointResult);
  const savedRound = finishTransition ? nextRound : current.round;
  const boardView = startsGame
    ? "monsters"
    : checkpointResult
      ? "score"
      : resultPending || scorePending
      ? nextRound === 16
        ? "score"
        : nextRound === 3
          ? "result"
          : "monsters"
      : "result";
  const boardRound = startsGame
    ? nextRound
    : checkpointResult
      ? current.round
      : resultPending || scorePending
      ? nextRound === 3
        ? current.round
        : nextRound
      : current.round;
  const boardUpdatedAt = new Date().toISOString();
  let phaseUpdate = await supabase
    .from("defense_phase_state")
    .update({
      round: savedRound,
      board_view: boardView,
      board_round: boardRound,
      board_updated_at: boardUpdatedAt,
      updated_at: boardUpdatedAt,
    })
    .eq("room_code", room)
    .select("room_code, round, updated_at")
    .maybeSingle();

  // 아직 전광판 컬럼 마이그레이션이 안 된 환경에서는 라운드만 저장한다.
  if (phaseUpdate.error && missingBoardColumns(phaseUpdate.error.message)) {
    phaseUpdate = await supabase
      .from("defense_phase_state")
      .update({ round: savedRound, updated_at: boardUpdatedAt })
      .eq("room_code", room)
      .select("room_code, round, updated_at")
      .maybeSingle();
  }

  if (phaseUpdate.error || !phaseUpdate.data) {
    return NextResponse.json(
      {
        error:
          phaseUpdate.error?.message ??
          "defense_phase_state를 업데이트하지 못했습니다.",
      } as ResponseBody,
      { status: 500 }
    );
  }

  // 라운드마다 제한 시간은 새 5분으로 시작한다. 다음 라운드로 넘어갈 때는
  // 5:00 정지 상태로 돌려 두고 진행자가 시작 버튼을 눌러 시작한다.
  const timerResetResult = await supabase
    .from("game_state")
    .update({
      timer_start: false,
      timer_start_at: null,
      pause_at: null,
    })
    .eq("room_code", room);

  publishDefensePhase({
    room,
    round: savedRound,
    updatedAt: phaseUpdate.data.updated_at ?? boardUpdatedAt,
  });

  return NextResponse.json(
    {
      ok: true,
      phase: phaseUpdate.data as DefensePhaseState,
      board: { view: boardView, round: boardRound, updatedAt: boardUpdatedAt },
      timerReset: !timerResetResult.error,
    } as ResponseBody,
    { status: 200 }
  );
}

