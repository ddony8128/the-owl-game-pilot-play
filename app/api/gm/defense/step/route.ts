import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import { defenseStageTitle, isDefenseStage, nextDefenseStep, normalizeStage, type DefenseStage } from "@/lib/defense/steps";

// POST /api/gm/defense/step { room, from?: { round, stage } }
//  GM 의 [다음] 버튼 하나(또니 10-18, 수산시장 방식). 현재 (round, stage) 에서 다음 단계로 한 칸 간다.
//   - stage 만 바뀌는 전환(결과 → 다음 라운드 시작, 결과 → 점수 발표, 본게임 준비 → 1라운드)은 여기서 CAS 로 처리.
//   - round 가 바뀌는 전환(행동 → 결과 = 정산, 준비 → 튜토리얼 1라운드, 튜토리얼 점수 → 본게임 준비)은
//     기존 /api/gm/defense/round 에 stage 를 함께 넘겨 처리한다(잠금·정산·조기 종료는 그쪽 그대로).
//   - 행동 단계에 들어가면 타이머를 리셋 후 시작하고, 그 밖의 단계에선 타이머를 멈춘다(준비·결과·점수에 타이머 없음).
//  from 이 서버와 다르면 409 stale_from(뒤처진 탭). 마지막 단계(최종 점수)면 409 finished.

type Body = { room?: unknown; from?: { round?: unknown; stage?: unknown } | null; request_id?: unknown };

type PhaseRow = { round: number; stage: string | null; updated_at: string | null; ended_early_from: number | null };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;
  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;
  if (guard.room.game !== "defense") return gmError(400, "디펜스 방이 아닙니다.", "invalid_input");

  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("round, stage, updated_at, ended_early_from")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return gmError(500, phaseError.message);
  const phase = (phaseRow || null) as PhaseRow | null;
  if (!phase) return gmError(500, "defense_phase_state가 초기화되지 않았습니다.");
  const round = phase.round;
  const stage = normalizeStage(round, phase.stage);
  const prevRound = round === 16 && typeof phase.ended_early_from === "number" ? phase.ended_early_from : round - 1;

  // 뒤처진 탭 보호: 화면이 보고 있던 단계와 다르면 거부
  const from = body?.from ?? null;
  if (from && (typeof from.round === "number" || typeof from.stage === "string")) {
    const fromRound = typeof from.round === "number" ? from.round : null;
    const fromStage = isDefenseStage(from.stage) ? from.stage : null;
    if ((fromRound != null && fromRound !== round) || (fromStage != null && fromStage !== stage)) {
      return gmError(
        409,
        `화면이 보고 있던 단계(${defenseStageTitle(fromRound ?? round, fromStage ?? stage)})와 서버 단계(${defenseStageTitle(round, stage, prevRound)})가 다릅니다. 화면을 새로 고치세요.`,
        "stale_from",
      );
    }
  }

  const step = nextDefenseStep(round, stage);
  if (!step) return gmError(409, "최종 결과까지 진행되었습니다. 더 넘길 단계가 없습니다.", "cannot_skip");

  const origin = new URL(request.url).origin;
  const timer = async (action: "start" | "reset") => {
    try {
      await fetch(`${origin}/api/gm/timers/defense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, action }),
      });
    } catch {
      /* 타이머 실패는 단계 진행을 막지 않는다 */
    }
  };
  const applyTimer = async (newStage: DefenseStage) => {
    await timer("reset");
    if (newStage === "action") await timer("start");
  };

  if (step.kind === "stage") {
    const { data: updated, error: updateError } = await supabase
      .from("defense_phase_state")
      .update({ stage: step.stage, updated_at: new Date().toISOString() })
      .eq("room_code", room)
      .eq("round", round)
      .eq("stage", phase.stage ?? stage)
      .select("round, stage, updated_at, ended_early_from")
      .maybeSingle();
    if (updateError) return gmError(500, updateError.message);
    if (!updated) {
      return gmError(409, "다른 창에서 단계가 먼저 바뀌었습니다. 화면을 새로 고치세요.", "already_advanced");
    }
    await applyTimer(step.stage);
    await addGmLog(supabase, {
      room,
      game: "defense",
      kind: "other",
      content: `[다음] ${step.label}`,
      meta: { round, from: stage, to: step.stage },
    });
    return NextResponse.json({ ok: true, label: step.label, round, stage: step.stage, prevRound, earlyEnd: false });
  }

  // round 전환은 기존 라운드 API 에 위임(잠금·정산·조기 종료·GM 로그)
  const res = await fetch(`${origin}/api/gm/defense/round`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room, round: step.nextRound, from: round, stage: step.stage, request_id: body?.request_id }),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok?: true; idempotent?: boolean; earlyEnd?: boolean; phase?: { round: number; stage?: string | null }; error?: string; reason?: string }
    | null;
  if (!res.ok || !json?.ok) {
    return gmError(res.status === 409 ? 409 : res.status || 500, json?.error ?? "라운드 전환 실패", json?.reason as Parameters<typeof gmError>[2]);
  }
  const newRound = json.phase?.round ?? step.nextRound;
  const newStage: DefenseStage = json.earlyEnd ? "result" : step.stage;
  await applyTimer(newStage);
  await addGmLog(supabase, {
    room,
    game: "defense",
    kind: "other",
    content: `[다음] ${step.label}${json.earlyEnd ? " → 모든 몬스터 처치·도망, 최종 결과로" : ""}`,
    meta: { from: round, to: newRound, stage: newStage },
  });
  return NextResponse.json({
    ok: true,
    label: step.label,
    round: newRound,
    stage: newStage,
    prevRound: json.earlyEnd ? round : newRound - 1,
    earlyEnd: json.earlyEnd === true,
    idempotent: json.idempotent === true,
  });
}
