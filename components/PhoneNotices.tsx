"use client";

// 참가자 폰 공용 안내 조각(디펜스·마피아 공용) — Iteration 5 WS-B
//  - KickedScreen     : 폴링이 403(not_registered) 으로 바뀐 경우(GM이 명단에서 제외) — 조용히 굳지 않고 바로 안내
//  - RoomGoneScreen   : 404(room_not_found)
//  - RoomEndedBanner  : rooms.status = ended (읽기 전용) — 서버가 변경 API 를 409 로 막는다
//  - RulesheetLink    : 규칙 탭 하단 「룰지 PDF 열기」(새 탭)

export const RULESHEET_PDF = {
  defense: "/rulebook/rulesheet-2026-10-16_defense.pdf",
  mafia: "/rulebook/rulesheet-2026-10-14_mafia.pdf",
} as const;

export function RulesheetLink({ game }: { game: keyof typeof RULESHEET_PDF }) {
  const label = game === "defense" ? "디펜스 딜레마" : "자본주의 마피아";
  return (
    <div className="mt-6 border-t border-zinc-800 pt-4">
      <a
        href={RULESHEET_PDF[game]}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="rulesheet-link"
        aria-label={`${label} 룰지 PDF 열기(새 탭)`}
        className="flex min-h-11 w-full items-center justify-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 text-base font-semibold text-amber-300 hover:bg-amber-400/20"
      >
        룰지 PDF 열기 ↗
      </a>
      <p className="mt-2 text-center text-xs text-zinc-500">
        정식 규칙은 룰지(PDF)가 기준입니다. 이 탭은 요약입니다.
      </p>
    </div>
  );
}

export function RoomEndedBanner() {
  return (
    <div
      data-testid="room-ended-banner"
      role="status"
      className="w-full max-w-md rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-center text-sm font-semibold text-zinc-200"
    >
      종료된 방입니다 — 기록만 볼 수 있고, 행동·투표·거래는 더 할 수 없습니다.
    </div>
  );
}

export function KickedScreen({ onLeave }: { onLeave: () => void }) {
  return (
    <div
      data-testid="kicked-screen"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50"
    >
      <p className="text-lg font-semibold text-red-300">참가자 명단에서 제외되었습니다</p>
      <p className="text-sm text-zinc-400">
        GM이 이 닉네임을 방에서 내렸습니다. 착오라면 GM에게 다시 등록을 요청한 뒤 같은 방 코드·닉네임으로
        다시 입장하세요.
      </p>
      <button
        type="button"
        aria-label="입장 화면으로 돌아가기"
        className="min-h-11 rounded-full bg-amber-400 px-6 text-base font-semibold text-zinc-950 hover:bg-amber-300"
        onClick={onLeave}
      >
        입장 화면으로
      </button>
    </div>
  );
}

export function RoomGoneScreen({ onLeave }: { onLeave: () => void }) {
  return (
    <div
      data-testid="room-gone-screen"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50"
    >
      <p className="text-lg font-semibold text-red-300">방을 찾을 수 없습니다</p>
      <p className="text-sm text-zinc-400">방이 삭제되었거나 코드가 바뀌었습니다. GM에게 방 코드를 다시 확인해 주세요.</p>
      <button
        type="button"
        aria-label="입장 화면으로 돌아가기"
        className="min-h-11 rounded-full bg-amber-400 px-6 text-base font-semibold text-zinc-950 hover:bg-amber-300"
        onClick={onLeave}
      >
        입장 화면으로
      </button>
    </div>
  );
}

/** 변경 API 응답을 사용자 문구로. 409 room_ended / round_mismatch 등은 사유별로 다르게 말한다. */
export function describeSubmitFailure(
  status: number | null,
  json: { error?: string; reason?: string } | null,
  fallback: string,
): string {
  const reason = json?.reason;
  if (reason === "room_ended") return "종료된 방입니다. 더 이상 제출할 수 없습니다.";
  if (reason === "not_registered") return "참가자 명단에서 제외되어 제출할 수 없습니다. GM에게 확인해 주세요.";
  if (reason === "round_mismatch" || reason === "round_advanced") {
    return json?.error ?? "라운드가 이미 넘어갔습니다. 화면이 바뀐 뒤 다시 선택해 주세요.";
  }
  if (status === null) return "네트워크 오류로 제출하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.";
  return json?.error ?? fallback;
}
