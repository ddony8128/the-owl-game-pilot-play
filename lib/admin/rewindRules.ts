import type { MafiaPhase } from "@/lib/types";

// 되돌리기 가능 판정(순수 함수) — Iteration 5 계약.
//
// 디펜스: 라운드 N 으로 넘어온 직후 N 의 행동 제출이 0건이면 N-1 로 복원한다.
//  - 0→1, 3→4 전환(initGame)은 정산이 없어 소환 몬스터·카드/점수 초기화만 되돌린다.
//  - 그 외 전환(advanceRound 정산)은 N-1 시작 시점 몬스터 스냅샷 + 플레이어 로그로 N-1 정산을 되돌린다.
// 마피아: 현재 페이즈에 제출이 없을 때만 한 단계 전으로.
//  - auction→prepare / trade→auction / vote→apply 만 가능, 그 밖(apply·end·prepare)은 409.

export type DefenseRewindPlan =
  | { kind: "init"; from: number; to: number }
  | { kind: "settlement"; from: number; to: number };

export type RewindDecision<P> =
  | { ok: true; plan: P }
  | { ok: false; reason: "not_rewindable"; error: string };

export function planDefenseRewind(round: number): DefenseRewindPlan | null {
  if (!Number.isInteger(round) || round <= 0 || round > 16) return null;
  if (round === 1) return { kind: "init", from: 1, to: 0 };
  if (round === 4) return { kind: "init", from: 4, to: 3 };
  return { kind: "settlement", from: round, to: round - 1 };
}

export function decideDefenseRewind(params: {
  round: number;
  actionsAtCurrentRound: number;
}): RewindDecision<DefenseRewindPlan> {
  const plan = planDefenseRewind(params.round);
  if (!plan) {
    return {
      ok: false,
      reason: "not_rewindable",
      error: params.round <= 0 ? "준비 단계라 되돌릴 라운드가 없습니다." : "되돌릴 수 없는 라운드입니다.",
    };
  }
  if (params.actionsAtCurrentRound > 0) {
    return {
      ok: false,
      reason: "not_rewindable",
      error: `이번 라운드에 이미 행동을 제출한 참가자가 ${params.actionsAtCurrentRound}명 있어 되돌릴 수 없습니다.`,
    };
  }
  return { ok: true, plan };
}

/** 정산 로그 "…1인당 N점을 획득했습니다." → N (아니면 null) */
export function parseAwardedPoints(log: string): number | null {
  const m = /1인당 (\d+)점을 획득/.exec(log);
  return m ? Number(m[1]) : null;
}

/** 도망 페널티 로그 "…가장 큰 활성 카드(값 N)가 비활성화…" → N (아니면 null) */
export function parseExpiredPenaltyValue(log: string): number | null {
  const m = /가장 큰 활성 카드\(값 (\d+)\)가 비활성화/.exec(log);
  return m ? Number(m[1]) : null;
}

/** 라운드 로그 중 정산(advanceRound)이 남긴 것인지 — 제출 시점 로그(훈련:/휴식:)는 보존한다. */
export function isSettlementLog(log: string): boolean {
  return !/^(훈련|휴식):/.test(log);
}

export type CardRow = { card_slot: number; card_value: number; is_active: boolean };

/**
 * 도망 페널티로 비활성화된 카드(값 value)를 찾는다. 같은 값의 비활성 카드가 2장 이상이면
 * 어느 장이 페널티였는지 확정할 수 없으므로 실패(409 사유)로 돌려준다.
 */
export function resolvePenaltyCard(
  cards: CardRow[],
  value: number,
): { ok: true; slot: number } | { ok: false; error: string } {
  const candidates = cards.filter((c) => !c.is_active && c.card_value === value);
  if (candidates.length === 1) return { ok: true, slot: candidates[0].card_slot };
  if (candidates.length === 0) {
    return { ok: false, error: `값 ${value} 비활성 카드를 찾지 못해 카드 상태를 되돌릴 수 없습니다.` };
  }
  return {
    ok: false,
    error: `값 ${value} 비활성 카드가 ${candidates.length}장이어서 어느 카드가 도망 페널티였는지 확정할 수 없습니다.`,
  };
}

export const MAFIA_REWIND_TARGET: Partial<Record<MafiaPhase, MafiaPhase>> = {
  auction: "prepare",
  trade: "auction",
  vote: "apply",
};

export const MAFIA_PHASE_ORDER: MafiaPhase[] = ["prepare", "auction", "trade", "apply", "vote", "end"];

export function decideMafiaRewind(params: {
  phase: MafiaPhase;
  submissionsInPhase: number;
}): RewindDecision<{ from: MafiaPhase; to: MafiaPhase }> {
  const to = MAFIA_REWIND_TARGET[params.phase];
  if (!to) {
    const why =
      params.phase === "prepare"
        ? "라운드 준비 단계는 더 앞으로 되돌릴 수 없습니다."
        : params.phase === "apply"
          ? "주가 변동이 이미 정산되어 거래 단계로 되돌릴 수 없습니다."
          : "라운드 종료(투표 정산) 뒤에는 되돌릴 수 없습니다.";
    return { ok: false, reason: "not_rewindable", error: why };
  }
  if (params.submissionsInPhase > 0) {
    const what = params.phase === "auction" ? "입찰" : params.phase === "trade" ? "거래·능력" : "투표";
    return {
      ok: false,
      reason: "not_rewindable",
      error: `이 단계에 이미 ${what} 제출이 ${params.submissionsInPhase}건 있어 되돌릴 수 없습니다.`,
    };
  }
  return { ok: true, plan: { from: params.phase, to } };
}

export function isMafiaJob(job: string | null | undefined): boolean {
  return job === "up_manipulator" || job === "down_manipulator" || job === "robber";
}
