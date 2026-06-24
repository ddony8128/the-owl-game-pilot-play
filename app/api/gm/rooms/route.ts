import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRoomWithSeed,
  getRoom,
  normalizeRoomCode,
  type RoomGame,
} from "@/lib/rooms";

const VALID_GAMES: RoomGame[] = ["mafia", "defense", "subway"];

// GET /api/gm/rooms?code=A3F82 → 단일 방 (코드를 아는 경우에만 조회 가능)
// 전역 목록 조회는 제공하지 않는다 — 방 관리자는 코드를 직접 가진 방만 다룰 수 있다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "code 필요 (방 코드를 입력해야 조회할 수 있습니다)" },
      { status: 400 },
    );
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
