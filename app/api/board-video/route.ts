import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { readBoardVideo } from "@/lib/boardVideoServer";

export const dynamic = "force-dynamic";

// GET /api/board-video?room=CODE → { video, seekSec, columnMissing, status }
// 보드(/defense-board · /mafia-board)와 GM 대시보드 룰 영상 패널이 2~3초마다 폴링한다.
// 컬럼이 없는 DB에서도 200(video: null, columnMissing: true).
export async function GET(request: Request) {
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) return NextResponse.json({ error: "room 필요" }, { status: 400 });
  try {
    const state = await readBoardVideo(createServerSupabaseClient(), room);
    if (!state) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(
      {
        video: state.video,
        seekSec: state.seekSec,
        columnMissing: state.columnMissing,
        status: state.status,
        game: state.game,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}
