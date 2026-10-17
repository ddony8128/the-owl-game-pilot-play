import type { DefenseActionType, DefenseCardState } from "@/lib/types";

// 디펜스 행동 제출(upsert)의 순수 판정 로직. API(route.ts)는 DB 입출력만 하고 판단은 여기서 한다.
// 계약(ITER5): 라운드 진행 전까지 같은 라운드 행동을 다시 제출하면 덮어쓴다. 타이머 0 이후도 서버는 막지 않는다(소프트 타이머).

export type CardSnapshotEntry = { cardSlot: number; cardValue: number; isActive: boolean };
export type CardSnapshot = CardSnapshotEntry[];

export const DEFENSE_ACTION_TYPES: readonly DefenseActionType[] = ["combat", "rest", "training"];

export function isDefenseActionType(v: unknown): v is DefenseActionType {
  return typeof v === "string" && (DEFENSE_ACTION_TYPES as readonly string[]).includes(v);
}

/** 행동 가능 라운드: 튜토리얼(1·2) + 본게임(4~15). 준비(≤0)·튜토리얼 결과(3)·종료(≥16)는 불가. */
export function isPlayableRound(round: number | null | undefined): boolean {
  if (typeof round !== "number" || !Number.isInteger(round)) return false;
  return round === 1 || round === 2 || (round >= 4 && round <= 15);
}

/** DB 카드 행 → 저장용 스냅샷(칸 순). */
export function snapshotCards(rows: Pick<DefenseCardState, "card_slot" | "card_value" | "is_active">[]): CardSnapshot {
  return rows
    .map((c) => ({ cardSlot: c.card_slot, cardValue: c.card_value, isActive: c.is_active }))
    .sort((a, b) => a.cardSlot - b.cardSlot);
}

/** DB에서 읽은 jsonb 가 스냅샷 모양인지 검사(아니면 null → 되돌릴 수 없는 옛 행). */
export function parseCardSnapshot(raw: unknown): CardSnapshot | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: CardSnapshot = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") return null;
    const o = e as Record<string, unknown>;
    if (
      typeof o.cardSlot !== "number" ||
      typeof o.cardValue !== "number" ||
      typeof o.isActive !== "boolean"
    )
      return null;
    out.push({ cardSlot: o.cardSlot, cardValue: o.cardValue, isActive: o.isActive });
  }
  return out.sort((a, b) => a.cardSlot - b.cardSlot);
}

/** 스냅샷으로 되돌리기 위해 바꿔야 하는 칸만 고른다(현재와 같은 칸은 건드리지 않음). */
export function diffForRestore(snapshot: CardSnapshot, current: CardSnapshot): CardSnapshotEntry[] {
  const curBySlot = new Map(current.map((c) => [c.cardSlot, c]));
  return snapshot.filter((s) => {
    const c = curBySlot.get(s.cardSlot);
    return !c || c.cardValue !== s.cardValue || c.isActive !== s.isActive;
  });
}

export type ExistingAction = {
  id: number | string;
  action_type: string;
  cards_before: unknown;
};

export type SubmitDecision =
  | { kind: "insert" }
  | { kind: "replace"; restoreTo: CardSnapshot }
  | { kind: "reject"; status: 400 | 409; reason: "not_playable" | "round_mismatch" | "legacy_action"; error: string };

/**
 * 제출을 어떻게 처리할지 결정한다.
 *  - clientRound(폰이 보고 있던 라운드)가 서버 라운드와 다르면 409 round_mismatch — 늦은 화면의 옛 버튼(반면교사 1-2).
 *  - 같은 라운드 기존 행동이 있으면 replace(스냅샷으로 카드 복원 뒤 새 행동 적용). 스냅샷이 없는 옛 행은 바꿀 수 없다(409).
 */
export function decideSubmit(input: {
  serverRound: number | null | undefined;
  clientRound: unknown;
  existing: ExistingAction | null;
}): SubmitDecision {
  const { serverRound, clientRound, existing } = input;
  if (!isPlayableRound(serverRound)) {
    return {
      kind: "reject",
      status: 400,
      reason: "not_playable",
      error:
        "지금은 행동할 수 없는 단계입니다(준비/결과/종료 화면). 라운드가 진행 중일 때만 가능합니다.",
    };
  }
  if (typeof clientRound === "number" && clientRound !== serverRound) {
    return {
      kind: "reject",
      status: 409,
      reason: "round_mismatch",
      error: "라운드가 이미 넘어갔습니다. 화면이 새 라운드로 바뀐 뒤 다시 선택해 주세요.",
    };
  }
  if (!existing) return { kind: "insert" };
  const snap = parseCardSnapshot(existing.cards_before);
  if (!snap) {
    return {
      kind: "reject",
      status: 409,
      reason: "legacy_action",
      error: "이 라운드의 행동은 이전 방식으로 제출되어 바꿀 수 없습니다.",
    };
  }
  return { kind: "replace", restoreTo: snap };
}

/** 새 행동을 (복원된) 카드 상태에 대해 검증한다. 통과하면 적용에 필요한 값들을 돌려준다. */
export type ValidatedAction =
  | { type: "combat"; targetId: string; usedSlot: number; usedValue: number }
  | { type: "training"; fromSlot: number; fromValue: number; toSlot: number; toValueBefore: number }
  | { type: "rest"; slots: number[]; values: number[] };

export type ValidationFailure = { error: string };

export function validateActionAgainstCards(
  body: {
    action_type: DefenseActionType;
    target_monster_id?: unknown;
    used_card_slot?: unknown;
    training_from_slot?: unknown;
    training_to_slot?: unknown;
    rest_slots?: unknown;
  },
  cards: CardSnapshot,
  activeMonsterIds: Set<string>,
): ValidatedAction | ValidationFailure {
  const bySlot = new Map(cards.map((c) => [c.cardSlot, c]));
  if (body.action_type === "combat") {
    const targetId = typeof body.target_monster_id === "string" ? body.target_monster_id : null;
    const usedSlot = typeof body.used_card_slot === "number" && Number.isInteger(body.used_card_slot) ? body.used_card_slot : null;
    if (!targetId || usedSlot == null) {
      return { error: "combat 행동에는 target_monster_id와 used_card_slot이 필요합니다." };
    }
    if (!activeMonsterIds.has(targetId)) {
      return { error: "선택한 몬스터가 존재하지 않거나 이미 제거되었습니다." };
    }
    const card = bySlot.get(usedSlot);
    if (!card || !card.isActive) {
      return { error: "선택한 카드가 존재하지 않거나 이미 비활성화되어 있어 사용할 수 없습니다." };
    }
    return { type: "combat", targetId, usedSlot, usedValue: card.cardValue };
  }
  if (body.action_type === "training") {
    const fromSlot = typeof body.training_from_slot === "number" && Number.isInteger(body.training_from_slot) ? body.training_from_slot : null;
    const toSlot = typeof body.training_to_slot === "number" && Number.isInteger(body.training_to_slot) ? body.training_to_slot : null;
    if (fromSlot == null || toSlot == null) {
      return { error: "training 행동에는 training_from_slot, training_to_slot이 모두 필요합니다." };
    }
    const from = bySlot.get(fromSlot);
    if (!from || !from.isActive) {
      return { error: "훈련에서 비활성화할 카드는 현재 활성화된 카드여야 합니다." };
    }
    const to = bySlot.get(toSlot);
    if (!to) return { error: "훈련으로 강화할 카드를 찾을 수 없습니다." };
    return { type: "training", fromSlot, fromValue: from.cardValue, toSlot, toValueBefore: to.cardValue };
  }
  // rest
  const raw = Array.isArray(body.rest_slots) ? body.rest_slots : [];
  const unique = Array.from(new Set(raw.filter((s): s is number => typeof s === "number" && Number.isInteger(s)))).slice(0, 3);
  if (unique.length === 0) {
    return { error: "휴식으로 활성화할 비활성 카드가 1장 이상 선택되어야 합니다." };
  }
  const inactive = unique.map((s) => bySlot.get(s)).filter((c): c is CardSnapshotEntry => !!c && !c.isActive);
  if (inactive.length === 0) {
    return { error: "선택한 카드가 이미 모두 활성화되어 있어 휴식을 적용할 수 없습니다." };
  }
  const slots = inactive.map((c) => c.cardSlot);
  const values = inactive.map((c) => c.cardValue).sort((a, b) => a - b);
  return { type: "rest", slots, values };
}

export function isValidationFailure(v: ValidatedAction | ValidationFailure): v is ValidationFailure {
  return "error" in v;
}

/**
 * 라운드 마감과 동시에 들어와 정산에서 빠진 전투 판정(반면교사 1-4 "조용한 유실 금지").
 * 정산(advanceRound)은 전투 참여자마다 반드시 "전투: …" 로그를 남긴다. 그러므로
 * 라운드가 넘어갔는데(action.round < currentRound) 그 라운드에 내 "전투:" 로그가 없으면 정산에 들어가지 못한 전투다.
 * 휴식·훈련은 제출 시점에 효과가 전부 적용되므로 늦어도 유실이 아니다.
 */
export function isLateCombat(input: {
  action: { round: number; action_type: string } | null;
  currentRound: number | null;
  logs: { round: number; log: string }[];
}): boolean {
  const { action, currentRound, logs } = input;
  if (!action || action.action_type !== "combat") return false;
  if (typeof currentRound !== "number" || !(action.round < currentRound)) return false;
  return !logs.some((l) => l.round === action.round && l.log.startsWith("전투:"));
}

export const LATE_COMBAT_LOG_PREFIX = "알림:";

export function lateCombatLog(usedValue: number | null): string {
  const card = usedValue != null ? `카드(값 ${usedValue})` : "카드";
  return `${LATE_COMBAT_LOG_PREFIX} 라운드 마감과 동시에 제출된 전투가 정산에 반영되지 않아 ${card}를 다시 활성화했습니다. 이번 라운드에 다시 행동을 선택해 주세요.`;
}
