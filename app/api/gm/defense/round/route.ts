import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { DefensePhaseState } from "@/lib/types";
import { decideAdvance, readFromIndex } from "@/lib/admin/advanceGuard";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { promoteDefenseTimerPending } from "@/lib/admin/timerStore";
import { getDefenseRoundLabel } from "@/lib/admin/defenseLabels";
import { handleDefenseInitRound } from "./initGame";
import { handleDefenseAdvanceRound } from "./advanceRound";

type Body = {
  room?: string;
  round?: number;
  /** 화면이 보고 있던 라운드(Iteration 5 — 뒤처진 탭 보호). 없으면 옛 요청으로 취급. */
  from?: unknown;
};

type ResponseBody =
  | { ok: true; phase: DefensePhaseState; idempotent?: true }
  | { error: string; reason?: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) {
    return gmError(400, "room 필요", "invalid_input");
  }

  if (!body || typeof body.round !== "number" || !Number.isInteger(body.round)) {
    return gmError(400, "round is required", "invalid_input");
  }

  const nextRound = body.round;
  // DB round 기준:
  // 0: 준비
  // 1~2: 튜토리얼 1, 2라운드
  // 3: 튜토리얼 결과
  // 4~15: 본게임 1~12라운드
  // 16: 본게임 결과 (게임 종료)
  if (nextRound < 0 || nextRound > 16) {
    return gmError(400, "round must be between 0 and 16", "invalid_input");
  }

  // 종료된 방은 읽기 전용(409 room_ended)
  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;

  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("room_code, round, updated_at")
    .eq("room_code", room)
    .maybeSingle();

  if (phaseError) {
    return gmError(500, phaseError.message);
  }

  const current = (phaseRow || null) as DefensePhaseState | null;
  if (!current) {
    return gmError(500, "defense_phase_state가 초기화되지 않았습니다.");
  }

  // 화면이 보고 있던 라운드(from)와 서버 라운드를 대조한다.
  //  - 이미 넘어가 있으면 200(멱등) — 다른 창·재전송.
  //  - 화면이 서버보다 앞서 있으면(되돌리기 뒤의 옛 탭) 409.
  const decision = decideAdvance({
    currentIndex: current.round,
    targetIndex: nextRound,
    fromIndex: readFromIndex(body.from),
    label: getDefenseRoundLabel,
  });
  if (decision.kind === "idempotent") {
    return NextResponse.json(
      { ok: true, idempotent: true, phase: current } as ResponseBody,
      { status: 200 },
    );
  }
  if (decision.kind === "reject") {
    return gmError(409, decision.error, decision.reason);
  }

  // 전환을 먼저 선점한다(compare-and-swap). 같은 전환을 동시에 보낸 두 요청 중 하나만 정산을 실행한다.
  // (예전엔 정산 뒤에 round 를 올려서, 동시 두 건이 전투 정산을 두 번 적용했다 — 반면교사 1-1·1-8)
  // 전환 선점은 updated_at 낙관적 잠금으로 한다(라운드 번호는 정산/초기화가 끝난 뒤에 바꾼다).
  //  라운드를 먼저 바꾸면 폰·보드가 "새 라운드인데 몬스터가 없는" 순간을 보게 된다(프로덕션 E2E 포착).
  const lockToken = new Date().toISOString();
  let lockQuery = supabase
    .from("defense_phase_state")
    .update({ updated_at: lockToken })
    .eq("room_code", room)
    .eq("round", current.round);
  lockQuery = current.updated_at ? lockQuery.eq("updated_at", current.updated_at) : lockQuery.is("updated_at", null);
  const { data: locked, error: claimError } = await lockQuery.select("room_code, round, updated_at").maybeSingle();

  if (claimError) {
    return gmError(500, claimError.message);
  }
  if (!locked) {
    // 그 사이 다른 요청이 선점했거나 라운드를 바꿨다 → 다시 읽어 멱등/409 를 가른다.
    const { data: nowRow } = await supabase
      .from("defense_phase_state")
      .select("room_code, round, updated_at")
      .eq("room_code", room)
      .maybeSingle();
    const now = (nowRow || null) as DefensePhaseState | null;
    if (now && now.round >= nextRound) {
      return NextResponse.json({ ok: true, idempotent: true, phase: now } as ResponseBody, { status: 200 });
    }
    return gmError(409, "다른 창에서 라운드를 넘기는 중이거나 이미 바뀌었습니다. 화면을 새로 고치세요.", "already_advanced");
  }

  try {
    // 초기화 라운드 전환: 0->1 (튜토 시작), 3->4 (본게임 시작)
    if (
      (current.round === 0 && nextRound === 1) ||
      (current.round === 3 && nextRound === 4)
    ) {
      await handleDefenseInitRound(supabase, current, nextRound, room);
    } else if (
      // 그 외 1->2, 2->3, 4->5, ..., 14->15, 15->16는 공통 전환 로직 실행
      current.round >= 1 &&
      current.round <= 15 &&
      nextRound === current.round + 1
    ) {
      await handleDefenseAdvanceRound(supabase, current, nextRound, room);
    }
  } catch (e: unknown) {
    // 정산/초기화 실패: 라운드 번호는 아직 바꾸지 않았으므로 그대로 재시도할 수 있다(부분 적용은 GM 로그·화면 안내로 확인).
    const message =
      e instanceof Error
        ? e.message
        : "디펜스 라운드 전환 처리 중 오류가 발생했습니다.";
    return gmError(500, `라운드 전환 실패(라운드는 ${getDefenseRoundLabel(current.round)}로 유지): ${message}`);
  }

  // 정산/초기화가 끝난 뒤에 라운드 번호를 바꾼다 — 이 순간부터 폰·보드가 새 라운드를 본다.
  const { data: claimed, error: advanceError } = await supabase
    .from("defense_phase_state")
    .update({ round: nextRound })
    .eq("room_code", room)
    .eq("round", current.round)
    .select("room_code, round, updated_at")
    .maybeSingle();
  if (advanceError) return gmError(500, advanceError.message);
  if (!claimed) {
    return gmError(409, "라운드 처리 중 다른 창에서 라운드가 바뀌었습니다. 화면을 새로 고치세요.", "already_advanced");
  }

  // "다음 라운드부터" 예약된 타이머 시간이 있으면 이 시점에 적용한다(타이머 자체는 GM이 리셋/시작).
  await promoteDefenseTimerPending(supabase, room).catch(() => undefined);

  return NextResponse.json(
    { ok: true, phase: claimed as DefensePhaseState } as ResponseBody,
    { status: 200 }
  );
}
