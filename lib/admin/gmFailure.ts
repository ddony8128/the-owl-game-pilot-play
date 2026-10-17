// GM 조작 실패 안내 문구(화면 배너) — Iteration 5 WS-A 1(증권가 app/gm/[slug]/page.tsx 방식).
// 서버는 { error, reason } 을 돌려주고, 화면은 status·reason 으로 사유를 구분해 보여 준다.
export type GmReason =
  | "room_ended"
  | "room_not_found"
  | "already_advanced"
  | "stale_from"
  | "cannot_skip"
  | "not_rewindable"
  | "too_few_players"
  | "invalid_input"
  | "schema_missing";

export type GmFailure = {
  status: number | null;
  error?: string | null;
  reason?: string | null;
};

export const GM_NETWORK_ERROR_TEXT = "서버에 연결할 수 없습니다 — 네트워크를 확인하고 다시 시도하세요.";

export function describeGmFailure(f: GmFailure): string {
  const detail = f.error && f.error.trim() ? f.error.trim() : null;
  if (f.status == null) return GM_NETWORK_ERROR_TEXT;
  if (f.status === 409) {
    switch (f.reason) {
      case "room_ended":
        return "종료된 방입니다 — 기록 확인만 할 수 있습니다(읽기 전용).";
      case "already_advanced":
      case "stale_from":
        return `이미 넘어갔습니다 (다른 창에서 진행했나요?) — 화면을 최신 상태로 다시 불러왔습니다.${
          detail ? ` ${detail}` : ""
        }`;
      case "cannot_skip":
        return detail ?? "단계를 건너뛸 수 없습니다.";
      case "not_rewindable":
        return `되돌릴 수 없습니다: ${detail ?? "조건이 맞지 않습니다."}`;
      case "too_few_players":
        return detail ?? "인원이 부족해 시작할 수 없습니다.";
      default:
        return detail ?? "다른 창에서 먼저 처리되어 적용되지 않았습니다.";
    }
  }
  if (f.status === 404) return detail ?? "방을 찾을 수 없습니다.";
  if (f.status === 400) return detail ? `잘못된 요청: ${detail}` : "잘못된 요청입니다.";
  if (f.status === 503) return detail ?? "서버 준비가 끝나지 않았습니다(DB 마이그레이션 필요).";
  if (f.status >= 500) return `서버 오류 (${f.status})${detail ? `: ${detail}` : ""} — 잠시 뒤 다시 시도하세요.`;
  return detail ?? `요청이 실패했습니다 (${f.status})`;
}
