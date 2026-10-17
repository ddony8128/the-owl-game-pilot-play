import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseRequestId } from "@/lib/requestId";
import { isMissingRelationError, type GmLogKind } from "@/lib/admin/gmLog";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// GM 조작의 재전송 멱등(점수 ±1 · 현금/주식 ±1 등 "두 번 적용되면 안 되는" 변경).
//  - 대시보드가 body.request_id 를 보내면 gm_logs(room_code, request_id) 부분 유니크 인덱스로 먼저 "선점"한다.
//  - 이미 같은 request_id 가 있으면(응답 유실 뒤 재전송) 변경을 적용하지 않고 처음 결과(meta)를 돌려준다.
//  - request_id 가 없거나 gm_logs 테이블이 없으면 멱등 없이 그냥 진행한다(옛 호출자 호환).
//  - 증권가 §43 "2주 매수가 5주 체결" 반면교사 — 점검표 1-18.
export type GmClaim =
  | { kind: "new"; logId: number }
  | { kind: "duplicate"; meta: Record<string, unknown> | null; content: string }
  | { kind: "none" };

export async function claimGmRequest(
  supabase: SupabaseClient,
  entry: { room: string; game: string | null; kind: GmLogKind; requestId: unknown },
): Promise<GmClaim> {
  const requestId = parseRequestId(entry.requestId);
  if (!requestId) return { kind: "none" };
  const { data, error } = await supabase
    .from("gm_logs")
    .insert({ room_code: entry.room, game: entry.game, kind: entry.kind, content: "(처리 중)", meta: null, request_id: requestId })
    .select("id")
    .maybeSingle();
  if (!error && data) return { kind: "new", logId: (data as { id: number }).id };
  if (error && error.code === "23505") {
    const { data: existing } = await supabase
      .from("gm_logs")
      .select("content, meta")
      .eq("room_code", entry.room)
      .eq("request_id", requestId)
      .maybeSingle();
    const row = (existing ?? { content: "", meta: null }) as { content: string; meta: Record<string, unknown> | null };
    return { kind: "duplicate", meta: row.meta, content: row.content };
  }
  if (isMissingRelationError(error)) return { kind: "none" };
  return { kind: "none" };
}

/** 변경을 적용한 뒤 선점해 둔 로그 행을 실제 내용으로 채운다. */
export async function finishGmRequest(
  supabase: SupabaseClient,
  logId: number,
  entry: { content: string; meta?: Record<string, unknown> | null },
): Promise<void> {
  await supabase.from("gm_logs").update({ content: entry.content, meta: entry.meta ?? null }).eq("id", logId);
}

/** 변경이 실패했으면 선점 행을 지워 같은 request_id 로 다시 시도할 수 있게 한다. */
export async function releaseGmRequest(supabase: SupabaseClient, logId: number): Promise<void> {
  await supabase.from("gm_logs").delete().eq("id", logId);
}
