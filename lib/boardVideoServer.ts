import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isRuleVideoId } from "@/lib/ruleVideos";
import { isMissingColumnError, type BoardVideoState } from "@/lib/boardVideo";

type Supabase = ReturnType<typeof createServerSupabaseClient>;

/**
 * 방의 보드 영상 상태를 읽는다. 컬럼이 없는 DB(마이그레이션 전)면 columnMissing=true로
 * 영상 없음 취급한다 — 호출 쪽이 500을 내지 않게.
 * 방이 없으면 null.
 */
export async function readBoardVideo(
  supabase: Supabase,
  code: string,
): Promise<(BoardVideoState & { game: string; status: string }) | null> {
  const full = await supabase
    .from("rooms")
    .select("game, status, board_video, board_video_seek_sec")
    .eq("code", code)
    .maybeSingle();
  if (!full.error) {
    if (!full.data) return null;
    const row = full.data as {
      game: string;
      status: string;
      board_video: string | null;
      board_video_seek_sec: number | null;
    };
    return {
      game: row.game,
      status: row.status,
      video: isRuleVideoId(row.board_video) ? row.board_video : null,
      seekSec: typeof row.board_video_seek_sec === "number" ? row.board_video_seek_sec : null,
      columnMissing: false,
    };
  }
  if (!isMissingColumnError(full.error)) throw new Error(full.error.message);

  const basic = await supabase.from("rooms").select("game, status").eq("code", code).maybeSingle();
  if (basic.error) throw new Error(basic.error.message);
  if (!basic.data) return null;
  const row = basic.data as { game: string; status: string };
  return { game: row.game, status: row.status, video: null, seekSec: null, columnMissing: true };
}
