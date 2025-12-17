import type { MafiaPhase } from "@/lib/types";

export const MAFIA_PHASE_LABELS: Record<MafiaPhase, string> = {
  prepare: "라운드 준비",
  auction: "직업 경매",
  trade: "주식 거래",
  apply: "주가 변동",
  vote: "투표",
  end: "라운드 종료",
};

export function getMafiaPhaseLabel(
  phase: MafiaPhase | null | undefined
): string {
  if (!phase) return "-";
  return MAFIA_PHASE_LABELS[phase] ?? phase;
}
