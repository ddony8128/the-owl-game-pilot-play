/**
 * 디펜스 보드 단계 모델(순수 — 단위 테스트 대상).
 *
 * DB round(defense_phase_state.round): 0 준비 · 1~2 튜토리얼 · 3 튜토리얼 결과 · 4~15 본게임 1~12라운드 · 16 게임 종료.
 * GM 이 라운드 R 로 넘기면(R-1 정산 완료) 보드는 R 에 해당하는 단계들을 차례로 보여 준다:
 *   result(R-1) → score(있으면) → snapshot(R)
 * - result : R-1 라운드 전투 결과(몬스터별 순차 공개)
 * - score  : 점수 발표 — R = 3(튜토리얼 결과) · 8(본게임 4라운드 뒤) · 12(8라운드 뒤) · 16(최종). 꼴찌부터 공개.
 * - snapshot: R 라운드 시작 시점 대기열("공격하세요!") + 카운트다운
 * 수동 모드의 타임라인(TIMELINE)은 같은 함수로 0..16 을 이어 붙인 것이라 자동·수동이 항상 같은 화면을 쓴다.
 */
export type StageKind = "ready" | "snapshot" | "result" | "score";

export type BoardStage = {
  kind: StageKind;
  /** 화면이 보여 주는 라운드(snapshot/result 는 DB round, score 는 발표 시점 라운드 라벨용) */
  round: number;
  /** score 단계가 /api/defense/board-scores 에 넘길 round(API 가 3·16 은 직전 라운드 스냅샷을 쓴다) */
  scoreRound?: number;
  /** 이 단계를 만든 GM 라운드 */
  gmRound: number;
};

export const FIRST_ROUND = 0;
export const LAST_ROUND = 16;

/** score 발표가 있는 GM 라운드 → board-scores 의 round 파라미터 */
const SCORE_ROUND_PARAM: Record<number, number> = { 3: 3, 8: 7, 12: 11, 16: 16 };

export function isBattleRound(round: number): boolean {
  return round === 1 || round === 2 || (round >= 4 && round <= 15);
}

export function stagesForRound(gmRound: number, prevRound?: number): BoardStage[] {
  if (gmRound <= 0) return [{ kind: "ready", round: 0, gmRound: 0 }];
  const out: BoardStage[] = [];
  // 조기 종료(모든 몬스터 처치·도망)로 16 에 왔으면 "직전 전투"는 15 가 아니라 마지막으로 정산된 라운드다.
  const prev = prevRound ?? gmRound - 1;
  // 3→4 는 본게임 초기화(정산 없음) — 3 은 전투 라운드가 아니므로 result 없음
  if (isBattleRound(prev)) out.push({ kind: "result", round: prev, gmRound });
  const scoreParam = SCORE_ROUND_PARAM[gmRound];
  if (scoreParam != null) out.push({ kind: "score", round: gmRound, scoreRound: scoreParam, gmRound });
  if (isBattleRound(gmRound)) out.push({ kind: "snapshot", round: gmRound, gmRound });
  return out;
}

/** 수동 모드 타임라인: 0..16 의 단계를 전부 이어 붙인 것(33단계) */
export const TIMELINE: BoardStage[] = Array.from({ length: LAST_ROUND - FIRST_ROUND + 1 }, (_, i) =>
  stagesForRound(FIRST_ROUND + i),
).flat();

export function stageKey(s: BoardStage): string {
  return `${s.kind}:${s.round}`;
}

/** 자동 추종 중 보던 단계와 같은 타임라인 인덱스(수동 모드로 바꿀 때 거기서 이어 간다) */
export function timelineIndexOf(stage: BoardStage): number {
  const idx = TIMELINE.findIndex((s) => stageKey(s) === stageKey(stage));
  return idx < 0 ? 0 : idx;
}

export function getRoundLabel(round: number): string {
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 15) return `${round - 3}라운드`;
  if (round === 16) return "최종 결과";
  return `알 수 없음 (DB round ${round})`;
}

export function stageTitle(stage: BoardStage): string {
  switch (stage.kind) {
    case "ready":
      return "곧 디펜스 딜레마가 시작됩니다";
    case "snapshot":
      return `${getRoundLabel(stage.round)} · 공격하세요!`;
    case "result":
      return `${getRoundLabel(stage.round)} 전투 결과`;
    case "score":
      if (stage.round === 16) return "최종 점수 발표";
      if (stage.round === 3) return "튜토리얼 점수 발표";
      return `${getRoundLabel(stage.scoreRound ?? stage.round)}까지 점수 발표`;
  }
}
