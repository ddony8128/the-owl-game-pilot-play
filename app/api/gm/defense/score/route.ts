import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { DefenseScore } from "@/lib/types";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import { claimGmRequest, finishGmRequest, releaseGmRequest } from "@/lib/admin/gmRequest";

type GetResponse =
  | {
      scores: DefenseScore[];
    }
  | { error: string };

type PostBody = {
  room?: string;
  playerId?: string;
  delta?: number;
  /** 재전송 멱등 키(대시보드가 자동으로 붙인다) */
  request_id?: unknown;
};

type PostResponse =
  | {
      ok: true;
      points: number;
    }
  | { error: string; reason?: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");

  if (!room) {
    return NextResponse.json({ error: "room 필요" } as GetResponse, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("defense_score")
    .select("player_id, points")
    .eq("room_code", room);

  if (error) {
    return NextResponse.json({ error: error.message } as GetResponse, {
      status: 500,
    });
  }

  return NextResponse.json(
    {
      scores: (data || []) as DefenseScore[],
    } as GetResponse,
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as PostBody | null;

  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) {
    return gmError(400, "room 필요", "invalid_input");
  }

  if (!body || typeof body.playerId !== "string" || !body.playerId.trim()) {
    return gmError(400, "playerId is required", "invalid_input");
  }

  const delta =
    typeof body.delta === "number" && (body.delta === 1 || body.delta === -1)
      ? body.delta
      : 0;

  if (!delta) {
    return gmError(400, "delta must be +1 or -1", "invalid_input");
  }

  // 종료된 방은 읽기 전용
  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;

  // 그 방의 참가자인지 확인(다른 방 참가자 id 로 점수를 만들지 않는다)
  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname")
    .eq("room_code", room)
    .eq("id", body.playerId)
    .maybeSingle();
  if (playerError) return gmError(500, playerError.message);
  if (!playerRow) return gmError(404, "그 방의 참가자가 아닙니다.", "invalid_input");

  // 재전송 멱등: 같은 request_id 가 이미 처리됐으면 다시 더하지 않는다.
  const claim = await claimGmRequest(supabase, { room, game: "defense", kind: "adjust", requestId: body.request_id });
  if (claim.kind === "duplicate") {
    const after = typeof claim.meta?.after === "number" ? (claim.meta.after as number) : null;
    return NextResponse.json({ ok: true, idempotent: true, points: after }, { status: 200 });
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("defense_score")
    .select("player_id, points")
    .eq("room_code", room)
    .eq("player_id", body.playerId)
    .maybeSingle();

  if (existingError) {
    if (claim.kind === "new") await releaseGmRequest(supabase, claim.logId);
    return gmError(500, existingError.message);
  }

  const currentPoints =
    existingRow && typeof existingRow.points === "number"
      ? existingRow.points
      : 0;
  const nextPoints = currentPoints + delta;

  const { error: upsertError } = await supabase
    .from("defense_score")
    .upsert(
      {
        room_code: room,
        player_id: body.playerId,
        points: nextPoints,
      } as DefenseScore,
      { onConflict: "player_id" }
    );

  if (upsertError) {
    if (claim.kind === "new") await releaseGmRequest(supabase, claim.logId);
    return gmError(500, upsertError.message);
  }

  const logEntry = {
    content: `점수 보정: ${(playerRow as { nickname: string }).nickname} ${delta > 0 ? "+" : ""}${delta}점 (${currentPoints} → ${nextPoints})`,
    meta: { player_id: body.playerId, delta, before: currentPoints, after: nextPoints },
  };
  if (claim.kind === "new") await finishGmRequest(supabase, claim.logId, logEntry);
  else await addGmLog(supabase, { room, game: "defense", kind: "adjust", ...logEntry });

  return NextResponse.json(
    { ok: true, points: nextPoints } as PostResponse,
    { status: 200 }
  );
}
