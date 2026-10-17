import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhaseState } from "@/lib/types";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { checkMafiaStart } from "@/lib/admin/headcount";
import { readFromIndex } from "@/lib/admin/advanceGuard";
import { addGmLog } from "@/lib/admin/gmLog";

type Body = {
  room?: string;
  round?: number;
  /** 화면이 보고 있던 라운드(없으면 옛 요청) */
  from?: unknown;
};

type ResponseBody =
  | { ok: true; phase: MafiaPhaseState; idempotent?: true }
  | { error: string; reason?: string };

// POST /api/gm/mafia/phase { room, round, from? } — 라운드 종료(end) 상태에서 다음 라운드를 연다(prepare).
//  Iteration 5: 종료 방 409 · 인원 5명 미만이면 0→1(본게임 시작) 차단(409 too_few_players) · 같은 라운드 재요청은 200 멱등.
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
  if (nextRound < 0 || nextRound > 5) {
    return gmError(400, "round must be between 0 and 5", "invalid_input");
  }

  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;

  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();

  if (phaseError) {
    return gmError(500, phaseError.message);
  }

  const current = (phaseRow || null) as MafiaPhaseState | null;
  if (!current) {
    return gmError(500, "mafia_phase_state가 초기화되지 않았습니다.");
  }

  // 이미 그 라운드(준비)로 넘어가 있으면 멱등 — 다른 창·재전송.
  if (current.round_number === nextRound && current.phase === "prepare") {
    return NextResponse.json({ ok: true, idempotent: true, phase: current } as ResponseBody, { status: 200 });
  }

  const from = readFromIndex(body.from);
  if (from != null && from !== current.round_number) {
    return gmError(
      409,
      `화면이 보고 있던 라운드(${from})와 서버 라운드(${current.round_number})가 다릅니다. 화면을 새로 고치세요.`,
      "stale_from",
    );
  }

  if (current.phase !== "end") {
    return gmError(409, "현재 페이즈가 '라운드 종료'가 아니므로 라운드를 변경할 수 없습니다.", "cannot_skip");
  }

  // 인원 범위(계약): 튜토리얼(0) → 본게임 시작은 5명 미만이면 차단.
  if (current.round_number === 0 && nextRound >= 1) {
    const { count, error: countError } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_code", room);
    if (countError) return gmError(500, countError.message);
    const check = checkMafiaStart(count ?? 0);
    if (!check.ok) {
      await addGmLog(supabase, {
        room,
        game: "mafia",
        kind: "headcount",
        content: `본게임 시작 차단: ${check.block ?? "인원 부족"}`,
        meta: { players: count ?? 0 },
      });
      return gmError(409, check.block ?? "인원이 부족해 시작할 수 없습니다.", "too_few_players", {
        players: count ?? 0,
      });
    }
  }

  const { data: updatedPhase, error: updateError } = await supabase
    .from("mafia_phase_state")
    .update({ round_number: nextRound, phase: "prepare" })
    .eq("room_code", room)
    .eq("round_number", current.round_number)
    .eq("phase", "end")
    .select("room_code, round_number, phase, updated_at")
    .maybeSingle();

  if (updateError) {
    return gmError(500, updateError.message);
  }
  if (!updatedPhase) {
    return gmError(409, "다른 창에서 라운드가 바뀌어 적용하지 않았습니다. 화면을 새로 고치세요.", "already_advanced");
  }

  // 새 라운드를 시작할 때는 모든 플레이어의 직업/마피아 여부를 초기화한다.
  const { error: resetError } = await supabase
    .from("mafia_player_state")
    .update({
      job: null,
      is_mafia: false,
    })
    .eq("room_code", room);

  if (resetError) {
    return gmError(500, resetError.message ?? "라운드 변경 중 플레이어 직업 정보를 초기화하지 못했습니다.");
  }

  return NextResponse.json(
    { ok: true, phase: updatedPhase as MafiaPhaseState } as ResponseBody,
    { status: 200 }
  );
}
