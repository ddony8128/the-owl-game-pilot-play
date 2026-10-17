import { NextResponse } from "next/server";
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GmReason } from "@/lib/admin/gmFailure";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

/** { error, reason } 형태의 실패 응답. 화면은 reason 으로 사유를 구분해 배너를 띄운다. */
export function gmError(
  status: number,
  error: string,
  reason?: GmReason,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...(reason ? { reason } : {}), ...(extra ?? {}) }, { status });
}

export type RoomForWrite = {
  code: string;
  game: string;
  status: "active" | "ended";
};

/**
 * 상태를 바꾸는 GM API 공통 전제: 방이 있어야 하고(404), 진행 중(status=active)이어야 한다(409 room_ended).
 * 종료된 방은 읽기 전용이다(Iteration 5 WS-A 8).
 */
export async function loadRoomForWrite(
  supabase: SupabaseClient,
  code: string,
): Promise<{ ok: true; room: RoomForWrite } | { ok: false; response: NextResponse }> {
  const { data, error } = await supabase
    .from("rooms")
    .select("code, game, status")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    return { ok: false, response: gmError(500, error.message) };
  }
  if (!data) {
    return { ok: false, response: gmError(404, "방을 찾을 수 없습니다.", "room_not_found") };
  }
  const room = data as RoomForWrite;
  if (room.status === "ended") {
    return {
      ok: false,
      response: gmError(409, "종료된 방입니다(읽기 전용). 진행하려면 새 방을 만드세요.", "room_ended"),
    };
  }
  return { ok: true, room };
}
