import type { MafiaPhase } from "@/lib/types";

/**
 * ITER6 B3(2026-10-18 또니) — 단계가 바뀌면 폰이 그 단계에서 쓰는 탭으로 한 번 이동한다.
 *  prepare → 정보, auction → 경매, trade → 거래, apply(주가 변동) → 능력 결과, vote → 투표, end → 능력 결과.
 * (탭 이름은 ITER6 A 에서 저쪽 UI·룰지·룰 영상과 같은 '능력 결과' — 투표 결과도 이 탭에 나온다)
 * 폴링마다 끌어오지 않는다: 전이(라운드·단계 키가 바뀐 순간)에만 적용하고, 그 뒤 참가자가 옮긴 탭은 다음 전이까지 존중한다.
 */
export const MAFIA_PHASE_TAB: Record<MafiaPhase, string> = {
  prepare: "info",
  auction: "auction",
  trade: "trade",
  apply: "result",
  vote: "vote",
  end: "result",
};

export function mafiaTabForPhase(phase: string | null | undefined): string | null {
  if (!phase) return null;
  return (MAFIA_PHASE_TAB as Record<string, string>)[phase] ?? null;
}

/** 전이 감지용 키(같은 단계 이름이 다음 라운드에 다시 와도 새 전이로 본다) */
export function mafiaPhaseKey(round: number | null | undefined, phase: string | null | undefined): string | null {
  if (!phase) return null;
  return `${typeof round === "number" ? round : "-"}:${phase}`;
}
