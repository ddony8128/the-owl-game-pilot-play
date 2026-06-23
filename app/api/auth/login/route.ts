import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRoom, normalizeRoomCode } from "@/lib/rooms";
import type { Player } from "@/lib/types";

// 플레이어 입장: 방 코드 + 닉네임.
//  - 방 코드가 틀리면        → "방 코드를 확인해 주세요." (reason: room_not_found)
//  - 방은 맞지만 미등록 닉네임 → "GM이 등록하지 않은 닉네임입니다. GM에게 확인 부탁드립니다." (reason: not_registered)
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);

  const room = normalizeRoomCode(body?.room ?? body?.room_code ?? "");
  const nickname = (body?.nickname ?? "").trim();

  if (!room || !nickname) {
    return NextResponse.json(
      { error: "room, nickname 필요" },
      { status: 400 },
    );
  }

  const roomRow = await getRoom(room);
  if (!roomRow) {
    return NextResponse.json(
      { error: "방 코드를 확인해 주세요.", reason: "room_not_found" },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, room_code, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      {
        error: "GM이 등록하지 않은 닉네임입니다. GM에게 확인 부탁드립니다.",
        reason: "not_registered",
      },
      { status: 403 },
    );
  }

  const player = data as Player;
  return NextResponse.json({ player, room: roomRow });
}
