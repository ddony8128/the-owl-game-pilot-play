import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRoomWithSeed,
  getRoom,
  normalizeRoomCode,
  type RoomGame,
} from "@/lib/rooms";
import { gmError } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";

const VALID_GAMES: RoomGame[] = ["mafia", "defense", "subway"];

// GET /api/gm/rooms?code=A3F82 → 단일 방
// GET /api/gm/rooms → 최근 50개 방 목록(GM 방 관리 화면용; 코드·게임·상태·생성 시각만)
// 전역 목록 조회는 제공하지 않는다 — 방 관리자는 코드를 직접 가진 방만 다룰 수 있다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("code, game, status, ended_normally, created_at")
      .in("game", VALID_GAMES)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rooms: data ?? [] });
  }

  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ room: null }, { status: 404 });
  }
  return NextResponse.json({ room });
}

// POST /api/gm/rooms  { game }  → 방 생성(+상태 시드), 코드 발급
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const game = (typeof body?.game === "string" ? body.game : "").trim() as RoomGame;
  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json(
      { error: "game 은 mafia | defense | subway 중 하나여야 합니다." },
      { status: 400 },
    );
  }
  try {
    const room = await createRoomWithSeed(game);
    return NextResponse.json({ room });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "방 생성 실패" },
      { status: 500 },
    );
  }
}

// PATCH /api/gm/rooms  { code, status?, ended_normally?, reveal_result? }
//  - status: 'active' | 'ended' (방 종료). ended 로 바꾸면 보드 영상을 끈다.
//  - reveal_result: 마피아 결과 공개 토글(Iteration 5 계약). 보드 요약·플레이어 결과 API 가 이 값을 본다.
//    종료(ended)된 방에서도 토글할 수 있다(진행이 아니라 표시 설정).
export async function PATCH(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);
  const code = normalizeRoomCode(typeof body?.code === "string" ? body.code : "");
  if (!code) {
    return gmError(400, "code 필요", "invalid_input");
  }

  const patch: Record<string, unknown> = {};
  if (body?.status !== undefined) {
    if (body.status !== "active" && body.status !== "ended") {
      return gmError(400, "status 는 active | ended", "invalid_input");
    }
    patch.status = body.status;
  }
  if (body?.ended_normally !== undefined) {
    if (typeof body.ended_normally !== "boolean") {
      return gmError(400, "ended_normally 는 boolean", "invalid_input");
    }
    patch.ended_normally = body.ended_normally;
  }
  if (body?.reveal_result !== undefined) {
    if (typeof body.reveal_result !== "boolean") {
      return gmError(400, "reveal_result 는 boolean", "invalid_input");
    }
    patch.reveal_result = body.reveal_result;
  }
  if (Object.keys(patch).length === 0) {
    return gmError(400, "변경할 필드가 없습니다.", "invalid_input");
  }

  const existing = await getRoom(code);
  if (!existing) return gmError(404, "방을 찾을 수 없습니다.", "room_not_found");

  const { data: updated, error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("code", code)
    .select("code, game, status, ended_normally, created_at, reveal_result")
    .maybeSingle();
  if (error) {
    return gmError(500, error.message);
  }
  if (patch.status === "ended") {
    // 종료된 방의 보드 영상은 끈다. board_video 컬럼이 없는 DB(마이그레이션 전)면 조용히 넘어간다.
    await supabase
      .from("rooms")
      .update({ board_video: null, board_video_seek_sec: null })
      .eq("code", code);
    if (existing.status !== "ended") {
      await addGmLog(supabase, { room: code, game: existing.game, kind: "other", content: "방 종료" });
    }
  }
  if (typeof patch.reveal_result === "boolean" && patch.reveal_result !== (existing.reveal_result ?? false)) {
    await addGmLog(supabase, {
      room: code,
      game: existing.game,
      kind: "reveal",
      content: patch.reveal_result ? "결과 공개 ON — 보드에 최종 결과·마피아를 공개합니다." : "결과 공개 OFF",
      meta: { reveal_result: patch.reveal_result },
    });
  }
  return NextResponse.json({ ok: true, room: updated ?? null });
}
