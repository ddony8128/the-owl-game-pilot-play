import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { isRuleVideoId } from "@/lib/ruleVideos";
import { isMissingColumnError } from "@/lib/boardVideo";

// POST /api/board-video/ended { code, video } — 보드가 영상을 끝까지 틀었거나 못 불러왔을 때.
// GM 인증 없이 부르는 경로라 **null로 되돌리는 것만** 한다. 그 사이 GM이 다른 영상을 다시
// 틀었으면(board_video ≠ video) 건드리지 않는다.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string; video?: unknown } | null;
  const code = normalizeRoomCode(body?.code ?? "");
  if (!code) return NextResponse.json({ error: "code 필요" }, { status: 400 });
  if (!isRuleVideoId(body?.video)) {
    return NextResponse.json({ error: "video 필요" }, { status: 400 });
  }
  const { error } = await createServerSupabaseClient()
    .from("rooms")
    .update({ board_video: null, board_video_seek_sec: null })
    .eq("code", code)
    .eq("board_video", body.video);
  if (error) {
    if (isMissingColumnError(error)) return NextResponse.json({ ok: true, columnMissing: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
