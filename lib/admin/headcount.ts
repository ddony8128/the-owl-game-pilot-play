import { DEFENSE_PLAYER_MAX, DEFENSE_PLAYER_MIN } from "@/lib/defense/composition";

// 인원 범위 — Iteration 5 계약(2026-10-17 또니 결정).
//  마피아: 권장 6~12명, 5명 미만 시작 불가(round 0 → 1 차단), 13명 이상 경고.
//  디펜스: 권장 6~12명, 6명 미만이면 경고(차단은 아님).
export const MAFIA_MIN_PLAYERS = 5;
export const MAFIA_RECOMMENDED_MIN = 6;
export const MAFIA_RECOMMENDED_MAX = 12;
export const MAFIA_WARN_FROM = 13;

export type HeadcountCheck = {
  ok: boolean;
  /** 진행을 막는 사유(ok=false 일 때) */
  block?: string;
  /** 진행은 되지만 확인창에 띄울 경고 */
  warn?: string;
};

/** 마피아 본게임 시작(round 0 → 1) 인원 판정 */
export function checkMafiaStart(playerCount: number): HeadcountCheck {
  const n = Number.isFinite(playerCount) ? Math.max(0, Math.floor(playerCount)) : 0;
  if (n < MAFIA_MIN_PLAYERS) {
    return {
      ok: false,
      block: `마피아는 ${MAFIA_MIN_PLAYERS}명 이상이어야 시작할 수 있습니다(현재 ${n}명, 권장 ${MAFIA_RECOMMENDED_MIN}~${MAFIA_RECOMMENDED_MAX}명).`,
    };
  }
  if (n >= MAFIA_WARN_FROM) {
    return {
      ok: true,
      warn: `${MAFIA_WARN_FROM}명 이상은 권장 범위(${MAFIA_RECOMMENDED_MIN}~${MAFIA_RECOMMENDED_MAX}명)를 넘습니다(현재 ${n}명). 월급쟁이가 절반 이상이 될 수 있습니다.`,
    };
  }
  if (n < MAFIA_RECOMMENDED_MIN) {
    return {
      ok: true,
      warn: `권장 인원(${MAFIA_RECOMMENDED_MIN}~${MAFIA_RECOMMENDED_MAX}명)보다 적은 ${n}명입니다.`,
    };
  }
  return { ok: true };
}

/** 디펜스 「다음 라운드」 인원 경고(차단 없음) */
export function checkDefenseAdvance(playerCount: number): HeadcountCheck {
  const n = Number.isFinite(playerCount) ? Math.max(0, Math.floor(playerCount)) : 0;
  if (n < DEFENSE_PLAYER_MIN) {
    return {
      ok: true,
      warn: `등록 인원이 ${n}명입니다(권장 ${DEFENSE_PLAYER_MIN}~${DEFENSE_PLAYER_MAX}명). 몬스터 조합·대기열은 ${DEFENSE_PLAYER_MIN}명 기준으로 맞춰집니다.`,
    };
  }
  if (n > DEFENSE_PLAYER_MAX) {
    return {
      ok: true,
      warn: `등록 인원이 ${n}명으로 권장 범위(${DEFENSE_PLAYER_MIN}~${DEFENSE_PLAYER_MAX}명)를 넘습니다. 조합은 ${DEFENSE_PLAYER_MAX}명 기준으로 맞춰집니다.`,
    };
  }
  return { ok: true };
}
