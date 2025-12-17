import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaPhaseState } from "@/lib/types";

type Body = {
  round?: number;
};

type ResponseBody = { ok: true; phase: MafiaPhaseState } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.round !== "number") {
    return NextResponse.json({ error: "round is required" } as ResponseBody, {
      status: 400,
    });
  }

  const nextRound = body.round;
  if (nextRound < 0 || nextRound > 5) {
    return NextResponse.json(
      { error: "round must be between 0 and 5" } as ResponseBody,
      { status: 400 }
    );
  }

  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as ResponseBody, {
      status: 500,
    });
  }

  const current = (phaseRow || null) as MafiaPhaseState | null;
  if (!current) {
    return NextResponse.json(
      { error: "mafia_phase_state가 초기화되지 않았습니다." } as ResponseBody,
      { status: 500 }
    );
  }

  if (current.phase !== "end") {
    return NextResponse.json(
      {
        error:
          "현재 페이즈가 '라운드 종료'가 아니므로 라운드를 변경할 수 없습니다.",
      } as ResponseBody,
      { status: 400 }
    );
  }

  const { data: updatedPhase, error: updateError } = await supabase
    .from("mafia_phase_state")
    .update({ round_number: nextRound, phase: "prepare" })
    .eq("id", 1)
    .select("id, round_number, phase, updated_at")
    .maybeSingle();

  if (updateError || !updatedPhase) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "mafia_phase_state를 업데이트하지 못했습니다.",
      } as ResponseBody,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, phase: updatedPhase as MafiaPhaseState } as ResponseBody,
    { status: 200 }
  );
}
