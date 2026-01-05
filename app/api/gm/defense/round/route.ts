import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DefensePhaseState } from "@/lib/types";
import { handleDefenseInitRound } from "./initGame";
import { handleDefenseAdvanceRound } from "./advanceRound";

type Body = {
  round?: number;
};

type ResponseBody = { ok: true; phase: DefensePhaseState } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

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
  // 4~13: 본게임 1~10라운드
  // 14: 본게임 결과 (게임 종료)
  if (nextRound < 0 || nextRound > 14) {
    return NextResponse.json(
      { error: "round must be between 0 and 12" } as ResponseBody,
      { status: 400 }
    );
  }

  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("id, round, updated_at")
    .eq("id", 1)
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

  try {
    // 초기화 라운드 전환: 0->1 (튜토 시작), 3->4 (본게임 시작)
    if (
      (current.round === 0 && nextRound === 1) ||
      (current.round === 3 && nextRound === 4)
    ) {
      await handleDefenseInitRound(supabase, current, nextRound);
    } else if (
      // 그 외 1->2, 2->3, 4->5, ..., 12->13, 13->14는 공통 전환 로직 실행
      current.round >= 1 &&
      current.round <= 13 &&
      nextRound === current.round + 1
    ) {
      await handleDefenseAdvanceRound(supabase, current, nextRound);
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

  const { data: updatedPhase, error: updateError } = await supabase
    .from("defense_phase_state")
    .update({ round: nextRound })
    .eq("id", 1)
    .select("id, round, updated_at")
    .maybeSingle();

  if (updateError || !updatedPhase) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "defense_phase_state를 업데이트하지 못했습니다.",
      } as ResponseBody,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, phase: updatedPhase as DefensePhaseState } as ResponseBody,
    { status: 200 }
  );
}

