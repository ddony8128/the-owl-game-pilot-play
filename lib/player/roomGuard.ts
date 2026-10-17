import type { createServerSupabaseClient } from "@/lib/supabase/server";

// 플레이어 변경 API 공통 입구: 방이 없으면 404(room_not_found), 종료된 방이면 409(room_ended).
// GM이 [종료]한 방은 서버에서 읽기 전용이 강제된다(Iteration 5 WS-B 6).
export type RoomRow = {
  code: string;
  game: string;
  status: "active" | "ended" | string;
  reveal_result?: boolean | null;
};

export type RoomGuardResult =
  | { ok: true; room: RoomRow }
  | {
      ok: false;
      status: 404 | 409 | 500;
      body: { error: string; reason: "room_not_found" | "room_ended" | "db_error" };
    };

export const ROOM_ENDED_MESSAGE =
  "종료된 방입니다. 더 이상 행동을 제출할 수 없습니다. (기록은 계속 볼 수 있습니다)";

export async function loadRoom(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  code: string,
): Promise<{ room: RoomRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("rooms")
    .select("code, game, status, reveal_result")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    // reveal_result 컬럼이 아직 없는 DB(마이그레이션 전)면 컬럼 없이 한 번 더 읽는다.
    const retry = await supabase
      .from("rooms")
      .select("code, game, status")
      .eq("code", code)
      .maybeSingle();
    if (retry.error) return { room: null, error: retry.error.message };
    return { room: (retry.data as RoomRow | null) ?? null, error: null };
  }
  return { room: (data as RoomRow | null) ?? null, error: null };
}

/** 변경 요청용: 활성 방만 통과. */
export async function requireActiveRoom(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  code: string,
): Promise<RoomGuardResult> {
  const { room, error } = await loadRoom(supabase, code);
  if (error) {
    return { ok: false, status: 500, body: { error, reason: "db_error" } };
  }
  if (!room) {
    return {
      ok: false,
      status: 404,
      body: { error: "방 코드를 확인해 주세요.", reason: "room_not_found" },
    };
  }
  if (room.status === "ended") {
    return {
      ok: false,
      status: 409,
      body: { error: ROOM_ENDED_MESSAGE, reason: "room_ended" },
    };
  }
  return { ok: true, room };
}

/** Postgres unique violation */
export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** DB까지 가서 22P02(500)가 나지 않게 입구에서 uuid 형식을 본다. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** 1 이상의 정수(상한 포함)만 통과. 소수·NaN·문자열은 null. */
export function parsePositiveInt(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > max) return null;
  return value;
}
