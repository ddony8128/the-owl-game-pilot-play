import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MAFIA_STOCK_SEED, normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPlayerState } from "@/lib/types";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import { claimGmRequest, finishGmRequest, releaseGmRequest } from "@/lib/admin/gmRequest";

// POST /api/gm/mafia/adjust { room, playerId, kind: "cash" | "stock", stock_key?, delta: 1 | -1 }
//  마피아 현금·보유 주식 수동 보정(디펜스 점수 ±와 같은 수준). 사유 없이 GM 로그만 남긴다 — Iteration 5 WS-A 4.
const STOCK_KEYS = new Set(MAFIA_STOCK_SEED.map((s) => s.stock_key));

type Body = {
  room?: unknown;
  playerId?: unknown;
  kind?: unknown;
  stock_key?: unknown;
  delta?: unknown;
  /** 재전송 멱등 키(대시보드가 자동으로 붙인다) */
  request_id?: unknown;
};

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;
  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) return gmError(400, "room 필요", "invalid_input");
  const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
  if (!playerId) return gmError(400, "playerId is required", "invalid_input");
  const kind = body?.kind;
  if (kind !== "cash" && kind !== "stock") return gmError(400, "kind 는 cash | stock", "invalid_input");
  const delta = body?.delta;
  if (delta !== 1 && delta !== -1) return gmError(400, "delta must be +1 or -1", "invalid_input");
  const stockKey = typeof body?.stock_key === "string" ? body.stock_key : null;
  if (kind === "stock" && (!stockKey || !STOCK_KEYS.has(stockKey))) {
    return gmError(400, `stock_key 는 ${[...STOCK_KEYS].join(" | ")} 중 하나`, "invalid_input");
  }

  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;
  if (guard.room.game !== "mafia") return gmError(400, "마피아 방이 아닙니다.", "invalid_input");

  const [{ data: playerRow, error: playerError }, { data: stateRow, error: stateError }] = await Promise.all([
    supabase.from("players").select("id, nickname").eq("room_code", room).eq("id", playerId).maybeSingle(),
    supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("room_code", room)
      .eq("player_id", playerId)
      .maybeSingle(),
  ]);
  if (playerError) return gmError(500, playerError.message);
  if (!playerRow) return gmError(404, "그 방의 참가자가 아닙니다.", "invalid_input");
  if (stateError) return gmError(500, stateError.message);
  if (!stateRow) {
    return gmError(409, "자산이 아직 생성되지 않았습니다(직업 경매가 시작되면 생성됩니다).", "invalid_input");
  }
  const state = stateRow as MafiaPlayerState;
  const nickname = (playerRow as { nickname: string }).nickname;

  // 재전송 멱등: 같은 request_id 가 이미 처리됐으면 다시 더하지 않는다.
  const claim = await claimGmRequest(supabase, { room, game: "mafia", kind: "adjust", requestId: body?.request_id });
  if (claim.kind === "duplicate") {
    const after = typeof claim.meta?.after === "number" ? (claim.meta.after as number) : null;
    return NextResponse.json(
      kind === "cash" ? { ok: true, idempotent: true, cash: after } : { ok: true, idempotent: true, stock_key: stockKey, amount: after },
    );
  }
  const log = async (content: string, meta: Record<string, unknown>) => {
    if (claim.kind === "new") await finishGmRequest(supabase, claim.logId, { content, meta });
    else await addGmLog(supabase, { room, game: "mafia", kind: "adjust", content, meta });
  };
  const fail = async (status: number, message: string, reason?: "invalid_input") => {
    if (claim.kind === "new") await releaseGmRequest(supabase, claim.logId);
    return gmError(status, message, reason);
  };

  if (kind === "cash") {
    const before = typeof state.cash === "number" ? state.cash : 0;
    const after = before + delta;
    const { error } = await supabase
      .from("mafia_player_state")
      .update({ cash: after })
      .eq("room_code", room)
      .eq("player_id", playerId);
    if (error) return fail(500, error.message);
    await log(`현금 보정: ${nickname} ${delta > 0 ? "+" : ""}${delta}원 (${before} → ${after})`, { player_id: playerId, kind, delta, before, after });
    return NextResponse.json({ ok: true, cash: after });
  }

  const raw = (state as unknown as { stocks?: unknown }).stocks;
  const stocks: Record<string, { amount: number }> =
    raw && typeof raw === "object" ? { ...(raw as Record<string, { amount: number }>) } : {};
  const key = stockKey as string;
  const before = typeof stocks[key]?.amount === "number" ? stocks[key].amount : 0;
  const after = before + delta;
  if (after < 0) {
    return fail(400, `${nickname}의 ${key} 보유 수량이 0주여서 더 뺄 수 없습니다.`, "invalid_input");
  }
  stocks[key] = { amount: after };
  const { error } = await supabase
    .from("mafia_player_state")
    .update({ stocks })
    .eq("room_code", room)
    .eq("player_id", playerId);
  if (error) return fail(500, error.message);
  await log(`주식 보정: ${nickname} ${key} ${delta > 0 ? "+" : ""}${delta}주 (${before} → ${after})`, { player_id: playerId, kind, stock_key: key, delta, before, after });
  return NextResponse.json({ ok: true, stock_key: key, amount: after });
}
