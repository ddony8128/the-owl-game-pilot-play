import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { gmError } from "@/lib/admin/gmResponse";
import { defensePending } from "@/lib/admin/pending";

// GET /api/gm/defense/pending?room=CODE → 현재 라운드 미제출 참가자(확인창 경고용)
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const { data: phaseRow, error } = await supabase
    .from("defense_phase_state")
    .select("round")
    .eq("room_code", room)
    .maybeSingle();
  if (error) return gmError(500, error.message);
  const round = typeof phaseRow?.round === "number" ? phaseRow.round : 0;
  try {
    const summary = await defensePending(supabase, room, round);
    return NextResponse.json({ round, ...summary });
  } catch (e) {
    return gmError(500, e instanceof Error ? e.message : "미제출 집계 실패");
  }
}
