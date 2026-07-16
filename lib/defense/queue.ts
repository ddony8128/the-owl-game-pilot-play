// 디펜스 대기열 칸 수는 참가 인원에 따라 유동적으로 정해진다.
//  - 7~9명  : 4칸 (원본 설계 기준)
//  - 10~12명 : 5칸
// 범위(7~12) 밖 값도 안전하게 clamp 한다.
export const DEFENSE_QUEUE_MIN = 4;
export const DEFENSE_QUEUE_MAX = 5;

export function computeQueueSize(playerCount: number): number {
  if (!Number.isFinite(playerCount) || playerCount <= 0) {
    return DEFENSE_QUEUE_MIN;
  }
  return playerCount >= 10 ? DEFENSE_QUEUE_MAX : DEFENSE_QUEUE_MIN;
}
