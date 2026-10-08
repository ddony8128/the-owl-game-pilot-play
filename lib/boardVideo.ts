import { isRuleVideoId, durationOf, ruleVideoOf, type RuleVideoId } from "@/lib/ruleVideos";

/**
 * 보드 룰 영상 상태 (rooms.board_video · rooms.board_video_seek_sec).
 *
 * 컬럼은 supabase/migrations/2026-10-08-board-video.sql로 추가한다. 아직 실행 전인 DB에서는
 * 조회가 "column ... does not exist"(42703)로 실패하는데, 이때 앱은 **500을 내지 않고**
 * 영상 없음으로 취급하고 GM 패널에 안내만 띄운다.
 */
export const BOARD_VIDEO_MIGRATION = "supabase/migrations/2026-10-08-board-video.sql";

export type BoardVideoState = {
  video: RuleVideoId | null;
  seekSec: number | null;
  /** DB에 board_video 컬럼이 없음 */
  columnMissing: boolean;
};

export function isMissingColumnError(
  err: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /board_video/.test(err.message ?? "");
}

export type VideoPatchInput = { video: unknown; seekSec?: unknown };
export type VideoPatchRoom = { game: string; status: string };
export type VideoPatchResult =
  | { ok: true; video: RuleVideoId | null; seekSec: number | null }
  | { ok: false; status: number; error: string };

/** PATCH /api/gm/rooms/video 본문 검증(순수 함수 — 단위 테스트 대상). */
export function validateVideoPatch(room: VideoPatchRoom, body: VideoPatchInput): VideoPatchResult {
  if (room.status !== "active") {
    return { ok: false, status: 409, error: "종료된 방에서는 룰 영상을 재생할 수 없습니다." };
  }
  if (body.video === null) return { ok: true, video: null, seekSec: null };
  if (!isRuleVideoId(body.video)) {
    return { ok: false, status: 400, error: "video 는 'defense' | 'mafia' | null 이어야 합니다." };
  }
  if (ruleVideoOf(body.video).game !== room.game) {
    return {
      ok: false,
      status: 400,
      error: `이 방(${room.game})에서는 ${body.video} 영상을 재생할 수 없습니다.`,
    };
  }
  let seekSec: number | null = null;
  if (body.seekSec !== undefined && body.seekSec !== null) {
    const n = Number(body.seekSec);
    const max = Math.ceil(durationOf(body.video));
    if (!Number.isFinite(n) || n < 0 || (max > 0 && n > max)) {
      return { ok: false, status: 400, error: `seekSec 는 0~${max} 사이 숫자여야 합니다.` };
    }
    seekSec = Math.floor(n);
  }
  return { ok: true, video: body.video, seekSec };
}
