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
//  실행은 RPC gm_mafia_rewind_apply(한 트랜잭션, phase 행 잠금) — supabase/migrations/2026-10-17-iter5-rewind-rpc.sql

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

  // 한 트랜잭션으로 적용(RPC gm_mafia_rewind_apply): phase 행 잠금 → 포인터·제출 0건 재확인 → 삭제/복원/포인터.
  const mode = current.phase === "auction" && (R === 0 || R === 1) ? "assets" : current.phase === "trade" ? "job" : "none";
  const rpcPlan = {
    mode,
    restore: [...latestByPlayer.values()].map((s) => ({
      player_id: s.player_id,
      cash: s.cash ?? 0,
      stocks: s.stocks ?? null,
      job: s.job ?? null,
      is_mafia: isMafiaJob(s.job),
    })),
    delete_snapshot_ids: snaps.map((s) => s.id),
  };
  const { data: rpcData, error: rpcError } = await supabase.rpc("gm_mafia_rewind_apply", {
    p_room: room,
    p_round: R,
    p_from: current.phase,
    p_to: to,
    p_plan: rpcPlan,
  });
  if (rpcError) return gmError(500, `되돌리기 실패(${getMafiaPhaseLabel(current.phase)} 유지): ${rpcError.message}`);
  const result = (rpcData ?? null) as
    | { ok: true; restored: number; deleted: number }
    | { ok: false; status?: number; reason?: string; error?: string }
    | null;
  if (!result || !result.ok) {
    const status = result?.status === 409 ? 409 : 500;
    return gmError(status, result?.error ?? "되돌리기 실패", (result?.reason ?? undefined) as Parameters<typeof gmError>[2]);
  }
  const restoredPlayers = result.restored;
  const deleted = result.deleted;
  const { data: afterRow } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  const claimed = (afterRow ?? { room_code: room, round_number: R, phase: to, updated_at: new Date().toISOString() }) as MafiaPhaseState;

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
