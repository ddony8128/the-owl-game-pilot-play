import type { RoomGame } from "@/lib/types";

/** 방의 게임 → 참가자 화면 경로(입장 화면·접근 가드가 같이 쓴다). 모르는 값이면 null. */
export function gamePath(game: RoomGame | string | null | undefined): string | null {
  switch (game) {
    case "mafia":
      return "/mafia";
    case "defense":
      return "/defense";
    case "subway":
      return "/subway";
    default:
      return null;
  }
}

/**
 * ITER6 C1 — 참가자 화면 접근 가드가 어디로 보낼지(순수 함수).
 *  - 세션 없음(새 브라우저에서 /defense 직접 열기 등) → 입장 화면 "/"
 *  - 로그인은 됐는데 이 화면의 게임이 아님(디펜스 세션이 남은 채 마피아 방으로 입장 등) → 그 방 게임 화면
 *  - 그 외(게임 경로를 모름) → 입장 화면
 * 예전에는 전부 /locked("정상적이지 않은 접근")로 보내 첫 접속 참가자가 막혔다.
 */
export function guardRedirect(input: { isLoggedIn: boolean; roomGame: string | null | undefined; allowGames?: string[] }): string {
  if (!input.isLoggedIn) return "/";
  const path = gamePath(input.roomGame);
  if (path && (!input.allowGames || !input.allowGames.includes(String(input.roomGame)))) return path;
  return "/";
}
