import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { readBoardVideo } from "@/lib/boardVideoServer";
import { BOARD_VIDEO_MIGRATION, validateVideoPatch } from "@/lib/boardVideo";

// PATCH /api/gm/rooms/video { code, video: 'defense' | 'mafia' | null, seekSec? }
//  - 방이 있어야 하고(404), 진행 중(status=active)이어야 하며(409),
//    영상은 그 방의 게임 것이어야 한다(400).
//  - video=null → 정지. seekSec → 그 초부터(재생 중이면 그 위치로 이동).
//  - DB에 컬럼이 없으면 503 + 마이그레이션 안내.
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { code?: string; video?: unknown; seekSec?: unknown }
    | null;
  const code = normalizeRoomCode(body?.code ?? "");
  if (!code) return NextResponse.json({ error: "code 필요" }, { status: 400 });
  if (!body || !("video" in body)) {
    return NextResponse.json({ error: "video 필요('defense' | 'mafia' | null)" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  let room;
  try {
    room = await readBoardVideo(supabase, code);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회 실패" }, { status: 500 });
  }
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });

  const v = validateVideoPatch(room, { video: body.video, seekSec: body.seekSec });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  if (room.columnMissing) {
    return NextResponse.json(
      {
        error: `DB에 board_video 컬럼이 없습니다 — ${BOARD_VIDEO_MIGRATION} 실행`,
        columnMissing: true,
      },
      { status: 503 },
    );
  }

  const { error } = await supabase
    .from("rooms")
    .update({ board_video: v.video, board_video_seek_sec: v.video ? (v.seekSec ?? 0) : null })
    .eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, video: v.video, seekSec: v.video ? (v.seekSec ?? 0) : null });
}
