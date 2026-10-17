import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// GM 로그(gm_logs) — 되돌리기·수동 보정·공개 토글·타이머 조정 같은 GM 조작 기록(GM 전용, 참가자에게 보이지 않음).
// 테이블: gm_logs(id, room_code, game, kind, content, meta, created_at) — supabase/migrations/2026-10-17-iter5-gm.sql
// 테이블이 없는 DB(마이그레이션 전)에서는 조용히 건너뛴다(조작 자체를 막지 않는다).
export type GmLogKind =
  | "rewind"
  | "adjust"
  | "reveal"
  | "timer"
  | "kick"
  | "headcount"
  | "other";

export type GmLogRow = {
  id: number;
  room_code: string;
  game: string | null;
  kind: string;
  content: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export const GM_LOGS_MIGRATION = "supabase/migrations/2026-10-17-iter5-gm.sql";

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the")
  );
}

export async function addGmLog(
  supabase: SupabaseClient,
  entry: {
    room: string;
    game: string | null;
    kind: GmLogKind;
    content: string;
    meta?: Record<string, unknown> | null;
  },
): Promise<{ ok: boolean; warning?: string }> {
  const { error } = await supabase.from("gm_logs").insert({
    room_code: entry.room,
    game: entry.game,
    kind: entry.kind,
    content: entry.content,
    meta: entry.meta ?? null,
  });
  if (!error) return { ok: true };
  if (isMissingRelationError(error)) {
    return { ok: false, warning: `gm_logs 테이블이 없어 GM 로그를 남기지 못했습니다 (${GM_LOGS_MIGRATION})` };
  }
  return { ok: false, warning: `GM 로그 기록 실패: ${error.message}` };
}

export async function listGmLogs(
  supabase: SupabaseClient,
  room: string,
  limit = 50,
): Promise<{ logs: GmLogRow[]; warning?: string }> {
  const { data, error } = await supabase
    .from("gm_logs")
    .select("id, room_code, game, kind, content, meta, created_at")
    .eq("room_code", room)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelationError(error)) {
      return { logs: [], warning: `gm_logs 테이블이 없습니다 (${GM_LOGS_MIGRATION})` };
    }
    return { logs: [], warning: error.message };
  }
  return { logs: (data ?? []) as GmLogRow[] };
}
