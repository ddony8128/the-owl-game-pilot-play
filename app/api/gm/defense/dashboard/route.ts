import { NextResponse } from "next/server";
import { readPhoneToggles } from "@/lib/phoneToggles";
import { defenseStageTitle, nextDefenseStep, normalizeStage } from "@/lib/defense/steps";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { DefenseScore, Player } from "@/lib/types";
import { gmError } from "@/lib/admin/gmResponse";
import { defensePending } from "@/lib/admin/pending";
import { listGmLogs } from "@/lib/admin/gmLog";

// GET /api/gm/defense/dashboard?room=CODE
//  디펜스 GM 대시보드가 4초마다 폴링하는 한 묶음(라운드·참가자+점수·미제출·방 상태·GM 로그).
//  한 URL 로 모아 usePolling(in-flight 가드·실패 시 화면 유지·재연결 배지)을 그대로 쓴다 — Iteration 5 WS-A 7.
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const [roomRes, phaseRes, playersRes, scoresRes] = await Promise.all([
    supabase.from("rooms").select("code, game, status, reveal_result").eq("code", room).maybeSingle(),
    supabase.from("defense_phase_state").select("round, updated_at, stage, ended_early_from").eq("room_code", room).maybeSingle(),
    supabase
      .from("players")
      .select("id, room_code, nickname, created_at")
      .eq("room_code", room)
      .order("nickname", { ascending: true }),
    supabase.from("defense_score").select("player_id, points").eq("room_code", room),
  ]);

  if (roomRes.error) return gmError(500, roomRes.error.message);
  if (!roomRes.data) return gmError(404, "방을 찾을 수 없습니다.", "room_not_found");
  if (phaseRes.error) return gmError(500, phaseRes.error.message);
  if (playersRes.error) return gmError(500, playersRes.error.message);
  if (scoresRes.error) return gmError(500, scoresRes.error.message);

  const round = typeof phaseRes.data?.round === "number" ? phaseRes.data.round : 0;
  const phaseRow = phaseRes.data as { stage?: string | null; ended_early_from?: number | null } | null;
  const stage = normalizeStage(round, phaseRow?.stage);
  const prevRound = round === 16 && typeof phaseRow?.ended_early_from === "number" ? phaseRow.ended_early_from : round - 1;
  const step = nextDefenseStep(round, stage);
  const scoreMap = new Map<string, number>();
  for (const s of (scoresRes.data ?? []) as DefenseScore[]) scoreMap.set(s.player_id, s.points);
  const players = ((playersRes.data ?? []) as Player[]).map((p) => ({
    ...p,
    defensePoints: scoreMap.get(p.id) ?? 0,
  }));

  let pending;
  try {
    pending = await defensePending(supabase, room, round);
  } catch (e) {
    return gmError(500, e instanceof Error ? e.message : "미제출 집계 실패");
  }
  const gmLogs = await listGmLogs(supabase, room, 30);

  // 미제출 집계는 행동 단계에서만 의미가 있다(결과·점수 단계에선 숨김)
  if (stage !== "action") pending = { ...pending, applicable: false };

  return NextResponse.json({
    room: roomRes.data,
    round,
    stage,
    prevRound,
    stageTitle: defenseStageTitle(round, stage, prevRound),
    nextStep: step ? { label: step.label, kind: step.kind, settles: step.kind === "round" ? step.settles : false } : null,
    players,
    pending,
    gmLogs: gmLogs.logs,
    gmLogsWarning: gmLogs.warning ?? null,
    // ITER6 B5·C5 — 참가자 폰 편의 기능 토글(컬럼이 없으면 기본값 + columnMissing)
    phoneToggles: await readPhoneToggles(supabase, room),
    serverNow: new Date().toISOString(),
  });
}
