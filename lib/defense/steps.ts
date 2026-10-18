// 디펜스 진행 단계(또니 10-18): GM 의 [다음] 버튼 하나로 아래 순서를 한 칸씩 넘긴다. 보드는 그 단계 화면에 머문다.
//
//   준비(0,ready) → 튜토리얼 1라운드(1,action) → 튜토리얼 1라운드 결과(2,result) → 튜토리얼 2라운드(2,action)
//   → 튜토리얼 2라운드 결과(3,result) → 튜토리얼 점수(3,score) → 본게임 준비(4,prep) → 1라운드(4,action)
//   → 1라운드 결과(5,result) → 2라운드(5,action) … → 4라운드 결과(8,result) → 중간 점수(8,score) → 5라운드(8,action)
//   … → 8라운드 결과(12,result) → 중간 점수(12,score) → 9라운드(12,action) … → 12라운드 결과(16,result) → 최종 점수(16,score)
//
// DB round 는 기존 그대로(0 준비 · 1~2 튜토리얼 · 3 튜토리얼 결과 · 4~15 본게임 1~12 · 16 종료).
// "결과" 단계는 round 가 이미 다음 번호로 넘어간 상태에서 직전 라운드(prevRound) 결과를 보여 준다(정산은 round 가 넘어갈 때).
// 조기 종료(모든 몬스터 처치·도망)면 결과 단계에서 round 가 바로 16 이 되고, 다음 버튼은 「최종 결과 발표」.

export type DefenseStage = "ready" | "action" | "result" | "score" | "prep";

export const DEFENSE_STAGES: readonly DefenseStage[] = ["ready", "action", "result", "score", "prep"];

export function isDefenseStage(v: unknown): v is DefenseStage {
  return typeof v === "string" && (DEFENSE_STAGES as readonly string[]).includes(v);
}

/** DB round → 사람이 읽는 라운드 이름(버튼·제목용) */
export function roundName(round: number): string {
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round >= 4 && round <= 15) return `${round - 3}라운드`;
  return `라운드 ${round}`;
}

export function isBattleRound(round: number): boolean {
  return round === 1 || round === 2 || (round >= 4 && round <= 15);
}

/** 점수 발표가 있는 결과 단계(그 round 의 result 다음 score) */
export const SCORE_ROUNDS = [3, 8, 12, 16] as const;

/** 저장된 stage 가 없거나 이상할 때(옛 행) round 로 추정 */
export function normalizeStage(round: number, stage: unknown): DefenseStage {
  if (round <= 0) return "ready";
  if (isDefenseStage(stage)) return stage;
  if (round === 3 || round === 16) return "score";
  return "action";
}

export type DefenseStep =
  /** round 를 바꾸는 전환(정산 또는 초기화) — 기존 라운드 API 로 처리하고 stage 를 함께 저장 */
  | { kind: "round"; nextRound: number; stage: DefenseStage; label: string; settles: boolean }
  /** 같은 round 안에서 stage 만 바꾸는 전환 */
  | { kind: "stage"; stage: DefenseStage; label: string };

/** 현재 (round, stage) 에서 [다음] 버튼이 할 일. 마지막(최종 점수)이면 null. */
export function nextDefenseStep(round: number, stageRaw: unknown): DefenseStep | null {
  const stage = normalizeStage(round, stageRaw);
  if (stage === "ready") return { kind: "round", nextRound: 1, stage: "action", label: "튜토리얼 1라운드 시작", settles: false };
  if (stage === "action") {
    if (!isBattleRound(round)) return null;
    return { kind: "round", nextRound: round + 1, stage: "result", label: `${roundName(round)} 결과 보기`, settles: true };
  }
  if (stage === "result") {
    if (round === 3) return { kind: "stage", stage: "score", label: "튜토리얼 점수 발표" };
    if (round === 8 || round === 12) return { kind: "stage", stage: "score", label: "중간 점수 발표" };
    if (round === 16) return { kind: "stage", stage: "score", label: "최종 결과 발표" };
    return { kind: "stage", stage: "action", label: `${roundName(round)} 시작` };
  }
  if (stage === "score") {
    if (round === 3) return { kind: "round", nextRound: 4, stage: "prep", label: "본게임 준비", settles: false };
    if (round === 8 || round === 12) return { kind: "stage", stage: "action", label: `${roundName(round)} 시작` };
    return null;
  }
  // prep(본게임 준비) → 1라운드
  return { kind: "stage", stage: "action", label: `${roundName(round)} 시작` };
}

/** 지금 화면(보드·대시보드)의 단계 이름 */
export function defenseStageTitle(round: number, stageRaw: unknown, prevRound?: number | null): string {
  const stage = normalizeStage(round, stageRaw);
  if (stage === "ready") return "준비";
  if (stage === "action") return roundName(round);
  if (stage === "prep") return "본게임 준비";
  if (stage === "result") return `${roundName(prevRound ?? round - 1)} 결과`;
  if (round === 3) return "튜토리얼 점수";
  if (round === 16) return "최종 결과";
  return "중간 점수";
}

/** 라운드 API 가 round 를 바꿀 때 함께 저장할 stage(옛 호출자 — step 을 거치지 않는 직접 호출 — 도 같은 규칙) */
export function stageAfterRoundChange(fromRound: number, toRound: number): DefenseStage {
  if (toRound === 1 && fromRound === 0) return "action";
  if (toRound === 4 && fromRound === 3) return "prep";
  return "result";
}

/** 되돌리기로 round 가 M 이 됐을 때의 stage — 정산 직전(행동 단계)으로 돌아간다 */
export function stageAfterRewind(toRound: number): DefenseStage {
  if (toRound <= 0) return "ready";
  if (toRound === 3) return "score";
  return "action";
}
