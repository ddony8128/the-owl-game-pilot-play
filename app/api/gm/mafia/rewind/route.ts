import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhase, MafiaPhaseState } from "@/lib/types";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import { decideMafiaRewind, isMafiaJob, MAFIA_PHASE_ORDER } from "@/lib/admin/rewindRules";

// POST /api/gm/mafia/rewind { room, from? }
//  현재 페이즈에 제출이 없을 때만 한 단계 전으로(Iteration 5 계약):
//   auction→prepare: (튜토리얼·1라운드) 초기 자산 세팅 취소 — prepare 종료 스냅샷으로 현금/주식 복원, 입찰 삭제
//   trade→auction : 직업 배정·낙찰액 지불 취소 — auction 종료 스냅샷으로 현금/직업 복원(입찰 기록은 유지)
//   vote→apply    : 투표 삭제(제출 0건 전제라 사실상 없음) + apply 스냅샷 삭제
//   그 밖(apply·end·prepare)은 409. 되돌린 단계는 GM 로그에 남긴다.

type RewindResponse =
  | { ok: true; phase: MafiaPhaseState; restored: { players: number; deleted: number } }
  | { error: string; reason?: string };

async function countSubmissions(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  room: string,
  round: number,
  phase: MafiaPhase,
): Promise<number> {
  if (phase === "vote") {
    const { count, error } = await supabase
      .from("mafia_votes")
      .select("id", { count: "exact", head: true })
      .eq("room_code", room)
      .eq("round_number", round);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  if (phase === "auction" || phase === "trade") {
    const { count, error } = await supabase
      .from("mafia_actions")
      .select("id", { count: "exact", head: true })
      .eq("room_code", room)
      .eq("round_number", round)
      .eq("phase", phase);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
  return 0;
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as { room?: unknown; from?: unknown } | null;
  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;
  if (guard.room.game !== "mafia") return gmError(400, "마피아 방이 아닙니다.", "invalid_input");

  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return gmError(500, phaseError.message);
  const current = (phaseRow || null) as MafiaPhaseState | null;
  if (!current) return gmError(500, "mafia_phase_state가 초기화되지 않았습니다.");

  const from = typeof body?.from === "string" ? body.from.trim() : null;
  if (from && MAFIA_PHASE_ORDER.includes(from as MafiaPhase) && from !== current.phase) {
    return gmError(
      409,
      `화면이 보고 있던 페이즈(${getMafiaPhaseLabel(from as MafiaPhase)})와 서버 페이즈(${getMafiaPhaseLabel(current.phase)})가 다릅니다. 화면을 새로 고치세요.`,
      "stale_from",
    );
  }

  const R = current.round_number;
  let submissions: number;
  try {
    submissions = await countSubmissions(supabase, room, R, current.phase);
  } catch (e) {
    return gmError(500, e instanceof Error ? e.message : "제출 집계 실패");
  }
  const decision = decideMafiaRewind({ phase: current.phase, submissionsInPhase: submissions });
  if (!decision.ok) return gmError(409, decision.error, decision.reason);
  const { to } = decision.plan;

  // 되돌아갈 상태 = "to 페이즈 종료 시점" 스냅샷(advance-phase 가 비즈니스 로직 직전에 저장).
  const { data: snapRows, error: snapError } = await supabase
    .from("mafia_player_snapshots")
    .select("id, player_id, round_number, phase, cash, stocks, job")
    .eq("room_code", room)
    .eq("round_number", R)
    .eq("phase", to);
  if (snapError) return gmError(500, snapError.message);
  type SnapRow = {
    id: number;
    player_id: string;
    round_number: number | null;
    phase: string | null;
    cash: number | null;
    stocks: Record<string, unknown> | null;
    job: string | null;
  };
  const snaps = (snapRows ?? []) as SnapRow[];
  // 같은 플레이어 스냅샷이 여러 장이면(재전환) 마지막 것을 쓴다.
  const latestByPlayer = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) latestByPlayer.set(s.player_id, s);

  // 페이즈 포인터를 먼저 되돌린다(CAS) → 이 뒤로 현재 페이즈 제출은 막힌다.
  const { data: claimed, error: claimError } = await supabase
    .from("mafia_phase_state")
    .update({ phase: to })
    .eq("room_code", room)
    .eq("phase", current.phase)
    .eq("round_number", R)
    .select("room_code, round_number, phase, updated_at")
    .maybeSingle();
  if (claimError) return gmError(500, claimError.message);
  if (!claimed) {
    return gmError(409, "그 사이 페이즈가 바뀌어 되돌리지 않았습니다. 화면을 새로 고치세요.", "already_advanced");
  }

  // 되돌리는 사이 들어온 제출(경합) → 원복 후 거부
  const late = await countSubmissions(supabase, room, R, current.phase).catch(() => 0);
  if (late > 0) {
    await supabase.from("mafia_phase_state").update({ phase: current.phase }).eq("room_code", room).eq("phase", to);
    return gmError(409, `되돌리는 사이 제출이 ${late}건 들어와 취소했습니다.`, "not_rewindable");
  }

  const fail = async (message: string) => {
    await supabase.from("mafia_phase_state").update({ phase: current.phase }).eq("room_code", room).eq("phase", to);
    return gmError(500, `되돌리기 실패(${getMafiaPhaseLabel(current.phase)} 유지): ${message}`);
  };

  let restoredPlayers = 0;
  let deleted = 0;

  if (current.phase === "auction") {
    // prepare→auction 취소: 입찰(있을 수 없지만) 삭제 + (0·1라운드) 초기 자산 세팅 전 상태 복원
    const del = await supabase
      .from("mafia_actions")
      .delete({ count: "exact" })
      .eq("room_code", room)
      .eq("round_number", R)
      .eq("phase", "auction");
    if (del.error) return fail(del.error.message);
    deleted += del.count ?? 0;
    if (R === 0 || R === 1) {
      for (const s of latestByPlayer.values()) {
        const { error } = await supabase
          .from("mafia_player_state")
          .update({ cash: s.cash ?? 0, stocks: s.stocks ?? null })
          .eq("room_code", room)
          .eq("player_id", s.player_id);
        if (error) return fail(error.message);
        restoredPlayers += 1;
      }
    }
  } else if (current.phase === "trade") {
    // auction→trade 취소: 직업·마피아 여부·낙찰액 지불을 auction 종료 시점으로
    const del = await supabase
      .from("mafia_actions")
      .delete({ count: "exact" })
      .eq("room_code", room)
      .eq("round_number", R)
      .eq("phase", "trade");
    if (del.error) return fail(del.error.message);
    deleted += del.count ?? 0;
    for (const s of latestByPlayer.values()) {
      const { error } = await supabase
        .from("mafia_player_state")
        .update({ cash: s.cash ?? 0, job: s.job ?? null, is_mafia: isMafiaJob(s.job) })
        .eq("room_code", room)
        .eq("player_id", s.player_id);
      if (error) return fail(error.message);
      restoredPlayers += 1;
    }
  } else if (current.phase === "vote") {
    const del = await supabase
      .from("mafia_votes")
      .delete({ count: "exact" })
      .eq("room_code", room)
      .eq("round_number", R);
    if (del.error) return fail(del.error.message);
    deleted += del.count ?? 0;
  }

  // 되돌린 전환의 스냅샷을 지워 다시 전환할 때 중복되지 않게 한다.
  if (snaps.length > 0) {
    const { error } = await supabase
      .from("mafia_player_snapshots")
      .delete()
      .in("id", snaps.map((s) => s.id));
    if (error) return fail(error.message);
  }

  // 타이머: 되돌아간 페이즈 기준으로 리셋(실패해도 되돌리기는 유지)
  try {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/gm/timers/mafia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, action: "reset", phase: to }),
    });
  } catch {
    /* ignore */
  }

  const summary = `되돌리기: ${R === 0 ? "튜토리얼" : `${R}라운드`} ${getMafiaPhaseLabel(current.phase)} → ${getMafiaPhaseLabel(to)} (자산·직업 복원 ${restoredPlayers}명, 삭제 ${deleted}건)`;
  await addGmLog(supabase, {
    room,
    game: "mafia",
    kind: "rewind",
    content: summary,
    meta: { round: R, from: current.phase, to, restoredPlayers, deleted },
  });

  return NextResponse.json(
    { ok: true, phase: claimed as MafiaPhaseState, restored: { players: restoredPlayers, deleted } } as RewindResponse,
    { status: 200 },
  );
}
