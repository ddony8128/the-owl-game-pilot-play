import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRoomWithSeed,
  getRoom,
  normalizeRoomCode,
  type RoomGame,
} from "@/lib/rooms";

const VALID_GAMES: RoomGame[] = ["mafia", "defense", "subway"];

// GET /api/gm/rooms            → 모든 방
// GET /api/gm/rooms?code=A3F82 → 단일 방
// GET /api/gm/rooms?game=mafia → 게임별 방 목록
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const game = searchParams.get("game");

  if (code) {
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ room: null }, { status: 404 });
    }
    return NextResponse.json({ room });
  }

  let query = supabase
    .from("rooms")
    .select("code, game, status, ended_normally, created_at")
    .order("created_at", { ascending: false });
  if (game) query = query.eq("game", game);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rooms: data ?? [] });
}

// POST /api/gm/rooms  { game }  → 방 생성(+상태 시드), 코드 발급
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const game = (body?.game ?? "").trim() as RoomGame;
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

// PATCH /api/gm/rooms  { code, status, ended_normally }  → 방 종료 등 상태 변경
export async function PATCH(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);
  const code = normalizeRoomCode(body?.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "code 필요" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body?.status === "string") patch.status = body.status;
  if (typeof body?.ended_normally === "boolean")
    patch.ended_normally = body.ended_normally;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 필드가 없습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("rooms").update(patch).eq("code", code);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
