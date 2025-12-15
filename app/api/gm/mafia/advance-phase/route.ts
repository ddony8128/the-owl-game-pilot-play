import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaPlayerSnapshot,
} from "@/lib/types";

type AdvanceBody = {
  from?: string;
  to?: string;
};

type AdvanceResponse = { ok: true; phase: MafiaPhaseState } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as AdvanceBody | null;

  if (!body || typeof body.to !== "string") {
    return NextResponse.json({ error: "to is required" } as AdvanceResponse, {
      status: 400,
    });
  }

  const to = body.to.trim();
  //  const from = body.from?.trim();

  // 현재 phase 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as AdvanceResponse, {
      status: 500,
    });
  }

  const current = (phaseRow || null) as MafiaPhaseState | null;
  if (!current) {
    return NextResponse.json(
      {
        error: "mafia_phase_state가 초기화되지 않았습니다.",
      } as AdvanceResponse,
      { status: 500 }
    );
  }

  // 스냅샷 생성 (현재 phase 종료 시점)
  const { data: playerStates, error: playerStatesError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, updated_at");

  if (playerStatesError) {
    return NextResponse.json(
      { error: playerStatesError.message } as AdvanceResponse,
      { status: 500 }
    );
  }

  const snapshots = (playerStates || []) as MafiaPlayerState[];

  if (snapshots.length > 0) {
    await supabase.from("mafia_player_snapshots").insert(
      snapshots.map((p) => ({
        player_id: p.player_id,
        round_number: current.round_number,
        phase: current.phase,
        cash: p.cash,
        stocks: {},
        job: p.job,
      })) as Partial<MafiaPlayerSnapshot>[]
    );
  }

  // TODO: apply 단계에서 주가/자산 계산 로직 추가 가능

  // round_number 갱신 규칙: 예시로 to가 'auction'이고 현재 phase가 'end'이면 라운드 +1
  let nextRound = current.round_number;
  if (current.phase === "end" && to === "auction") {
    nextRound = current.round_number + 1;
  }

  const { data: updatedPhase, error: updateError } = await supabase
    .from("mafia_phase_state")
    .update({ round_number: nextRound, phase: to })
    .eq("id", 1)
    .select("id, round_number, phase, updated_at")
    .maybeSingle();

  if (updateError || !updatedPhase) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "mafia_phase_state를 업데이트하지 못했습니다.",
      } as AdvanceResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, phase: updatedPhase as MafiaPhaseState } as AdvanceResponse,
    { status: 200 }
  );
}
