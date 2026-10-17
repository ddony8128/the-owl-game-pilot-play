export const DEFENSE_BOARD_VIEWS = ["ready", "monsters", "result", "score"] as const;

export type DefenseBoardView = (typeof DEFENSE_BOARD_VIEWS)[number];

export type DefenseBoardControl = {
  view: DefenseBoardView;
  round: number;
  updatedAt: string | null;
};

export function isDefenseBoardView(value: unknown): value is DefenseBoardView {
  return typeof value === "string" && DEFENSE_BOARD_VIEWS.includes(value as DefenseBoardView);
}

export function getDefenseRoundLabel(round: number): string {
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 15) return `본 게임 ${round - 3}라운드`;
  if (round === 16) return "최종 결과";
  return `라운드 ${round}`;
}

