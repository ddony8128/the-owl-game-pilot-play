import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhaseState } from "@/lib/types";
import { gmError } from "@/lib/admin/gmResponse";
import { mafiaPending } from "@/lib/admin/pending";

// GET /api/gm/mafia/pending?room=CODE → 현재 페이즈 미제출 참가자(확인창 경고용)
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const { data: phaseRow, error } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (error) return gmError(500, error.message);
  const phase = (phaseRow || null) as MafiaPhaseState | null;
  if (!phase) return gmError(404, "mafia_phase_state가 없습니다.", "room_not_found");
  try {
    const summary = await mafiaPending(supabase, room, phase.round_number, phase.phase);
    return NextResponse.json({ round: phase.round_number, phase: phase.phase, ...summary });
  } catch (e) {
    return gmError(500, e instanceof Error ? e.message : "미제출 집계 실패");
  }
}
