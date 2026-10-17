// 디펜스 DB round(0~16) → 사람이 읽는 라운드 이름. 대시보드·API 오류 문구·GM 로그가 같은 함수를 쓴다.
export function getDefenseRoundLabel(round: number): string {
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 15) return `${round - 3}라운드`;
  if (round === 16) return "게임 종료";
  return `라운드 ${round}`;
}
