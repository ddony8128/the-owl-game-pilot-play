import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaLog, MafiaPhaseState, MafiaPlayerState, MafiaStockState, Player } from "@/lib/types";
import { gmError } from "@/lib/admin/gmResponse";
import { mafiaPending } from "@/lib/admin/pending";
import { listGmLogs } from "@/lib/admin/gmLog";

// GET /api/gm/mafia/dashboard?room=CODE
//  마피아 GM 대시보드가 4초마다 폴링하는 한 묶음(페이즈·주가·자산·공개 로그·이름·미제출·방 상태·GM 로그).
//  usePolling 하나로 폴링해 실패 시 화면 유지 + 재연결 배지 — Iteration 5 WS-A 7.
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const [roomRes, phaseRes, stockRes, stateRes, nameRes, logRes] = await Promise.all([
    supabase.from("rooms").select("code, game, status, reveal_result").eq("code", room).maybeSingle(),
    supabase
      .from("mafia_phase_state")
      .select("room_code, round_number, phase, updated_at")
      .eq("room_code", room)
      .maybeSingle(),
    supabase.from("mafia_stock_state").select("stock_key, price, updated_at").eq("room_code", room),
    supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("room_code", room),
    supabase
      .from("players")
      .select("id, nickname, created_at")
      .eq("room_code", room)
      .order("nickname", { ascending: true }),
    supabase
      .from("mafia_public_logs")
      .select("id, content, created_at")
      .eq("room_code", room)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (roomRes.error) return gmError(500, roomRes.error.message);
  if (!roomRes.data) return gmError(404, "방을 찾을 수 없습니다.", "room_not_found");
  for (const r of [phaseRes, stockRes, stateRes, nameRes, logRes]) {
    if (r.error) return gmError(500, r.error.message);
  }

  const phase = (phaseRes.data || null) as MafiaPhaseState | null;
  const playerNames: Record<string, string> = {};
  for (const p of (nameRes.data ?? []) as Pick<Player, "id" | "nickname">[]) playerNames[p.id] = p.nickname;

  let pending = null;
  if (phase) {
    try {
      pending = await mafiaPending(supabase, room, phase.round_number, phase.phase);
    } catch (e) {
      return gmError(500, e instanceof Error ? e.message : "미제출 집계 실패");
    }
  }
  const gmLogs = await listGmLogs(supabase, room, 30);

  return NextResponse.json({
    room: roomRes.data,
    phase,
    stocks: (stockRes.data ?? []) as MafiaStockState[],
    players: (stateRes.data ?? []) as MafiaPlayerState[],
    playerNames,
    playerCount: (nameRes.data ?? []).length,
    logs: (logRes.data ?? []) as MafiaLog[],
    pending,
    gmLogs: gmLogs.logs,
    gmLogsWarning: gmLogs.warning ?? null,
    serverNow: new Date().toISOString(),
  });
}
