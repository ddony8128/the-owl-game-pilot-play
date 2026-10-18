import { describe, expect, it } from "vitest";
import {
  decideSubmit,
  diffForRestore,
  isDefenseActionType,
  isLateCombat,
  isPlayableRound,
  isSameSubmission,
  isValidationFailure,
  lateCombatLog,
  parseCardSnapshot,
  snapshotCards,
  validateActionAgainstCards,
  type CardSnapshot,
} from "@/lib/defense/action";

// 디펜스 행동 제출 판정(순수). 계약(ITER6 낙장불입): 같은 라운드에 이미 제출했으면 409, 같은 내용 재전송만 멱등.
const CARDS: CardSnapshot = [
  { cardSlot: 1, cardValue: 1, isActive: true },
  { cardSlot: 2, cardValue: 2, isActive: true },
  { cardSlot: 3, cardValue: 3, isActive: false },
  { cardSlot: 4, cardValue: 4, isActive: true },
];

describe("isPlayableRound / isDefenseActionType", () => {
  it("튜토리얼 1·2, 본게임 4~15 만 행동 가능", () => {
    expect([0, 3, 16, -1, 1.5, NaN].map(isPlayableRound)).toEqual([false, false, false, false, false, false]);
    expect([1, 2, 4, 9, 15].map(isPlayableRound)).toEqual([true, true, true, true, true]);
    expect(isPlayableRound(null)).toBe(false);
  });
  it("action_type 열거 검사(입력 형식 → 500 금지)", () => {
    expect(isDefenseActionType("combat")).toBe(true);
    expect(isDefenseActionType("COMBAT")).toBe(false);
    expect(isDefenseActionType(1)).toBe(false);
    expect(isDefenseActionType(undefined)).toBe(false);
  });
});

describe("decideSubmit (낙장불입 판정)", () => {
  it("기존 행동이 없으면 insert", () => {
    expect(decideSubmit({ serverRound: 4, clientRound: 4, existing: null })).toEqual({ kind: "insert" });
  });
  it("폰 라운드가 서버와 다르면 409 round_mismatch (늦은 화면의 옛 버튼)", () => {
    const d = decideSubmit({ serverRound: 5, clientRound: 4, existing: null });
    expect(d.kind).toBe("reject");
    if (d.kind === "reject") {
      expect(d.status).toBe(409);
      expect(d.reason).toBe("round_mismatch");
    }
  });
  it("폰이 round 를 안 보내면(옛 클라이언트) 라운드 비교를 건너뛴다", () => {
    expect(decideSubmit({ serverRound: 5, clientRound: undefined, existing: null })).toEqual({ kind: "insert" });
  });
  it("행동 불가 라운드는 400 not_playable", () => {
    const d = decideSubmit({ serverRound: 3, clientRound: 3, existing: null });
    expect(d.kind === "reject" && d.status === 400 && d.reason === "not_playable").toBe(true);
  });
  const EXISTING = {
    id: 1,
    action_type: "combat",
    cards_before: CARDS,
    target_monster_id: "m-1",
    used_card_slot: 2,
  };
  it("같은 라운드에 이미 제출했고 내용이 다르면 409 already_submitted", () => {
    const d = decideSubmit({
      serverRound: 4,
      clientRound: 4,
      existing: EXISTING,
      body: { action_type: "combat", target_monster_id: "m-1", used_card_slot: 4 },
    });
    expect(d).toMatchObject({ kind: "reject", status: 409, reason: "already_submitted" });
    const rest = decideSubmit({ serverRound: 4, clientRound: 4, existing: EXISTING, body: { action_type: "rest", rest_slots: [3] } });
    expect(rest).toMatchObject({ kind: "reject", reason: "already_submitted" });
  });
  it("본문이 없으면(옛 호출) 기존 행동이 있을 때 409", () => {
    const d = decideSubmit({ serverRound: 4, clientRound: 4, existing: EXISTING });
    expect(d).toMatchObject({ kind: "reject", reason: "already_submitted" });
  });
  it("같은 내용의 재전송은 멱등(idempotent)", () => {
    expect(
      decideSubmit({
        serverRound: 4,
        clientRound: 4,
        existing: EXISTING,
        body: { action_type: "combat", target_monster_id: "m-1", used_card_slot: 2 },
      }),
    ).toEqual({ kind: "idempotent" });
  });
  it("isSameSubmission — 훈련·휴식은 제출 직전 스냅샷의 칸 → 값으로 비교", () => {
    const training = { id: 2, action_type: "training", cards_before: CARDS, training_from: 1, training_to: 4 };
    expect(isSameSubmission(training, { action_type: "training", training_from_slot: 1, training_to_slot: 4 })).toBe(true);
    expect(isSameSubmission(training, { action_type: "training", training_from_slot: 2, training_to_slot: 4 })).toBe(false);
    const rest = { id: 3, action_type: "rest", cards_before: CARDS, rest_card: "3" };
    expect(isSameSubmission(rest, { action_type: "rest", rest_slots: [3] })).toBe(true);
    expect(isSameSubmission(rest, { action_type: "rest", rest_slots: [1] })).toBe(false);
  });
});

describe("snapshot / parse / diff", () => {
  it("DB 행 → 스냅샷(칸 순 정렬)", () => {
    const snap = snapshotCards([
      { card_slot: 2, card_value: 2, is_active: true },
      { card_slot: 1, card_value: 1, is_active: false },
    ]);
    expect(snap.map((c) => c.cardSlot)).toEqual([1, 2]);
  });
  it("jsonb 가 스냅샷 모양이 아니면 null", () => {
    expect(parseCardSnapshot(null)).toBeNull();
    expect(parseCardSnapshot([])).toBeNull();
    expect(parseCardSnapshot([{ cardSlot: 1 }])).toBeNull();
    expect(parseCardSnapshot(CARDS)).toEqual(CARDS);
  });
  it("복원 diff 는 달라진 칸만 고른다", () => {
    const current: CardSnapshot = [
      { cardSlot: 1, cardValue: 1, isActive: true },
      { cardSlot: 2, cardValue: 2, isActive: false }, // 전투로 비활성
      { cardSlot: 3, cardValue: 3, isActive: false },
      { cardSlot: 4, cardValue: 5, isActive: true }, // 훈련으로 +1
    ];
    const diff = diffForRestore(CARDS, current);
    expect(diff.map((c) => c.cardSlot)).toEqual([2, 4]);
    expect(diff.find((c) => c.cardSlot === 4)?.cardValue).toBe(4);
  });
});

describe("validateActionAgainstCards (되돌린 뒤 상태 기준 검증)", () => {
  const monsters = new Set(["m1"]);
  it("전투: 활성 카드 + 활성 몬스터만", () => {
    const ok = validateActionAgainstCards({ action_type: "combat", target_monster_id: "m1", used_card_slot: 4 }, CARDS, monsters);
    expect(isValidationFailure(ok)).toBe(false);
    if (!isValidationFailure(ok) && ok.type === "combat") expect(ok.usedValue).toBe(4);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "combat", target_monster_id: "m1", used_card_slot: 3 }, CARDS, monsters))).toBe(true);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "combat", target_monster_id: "zz", used_card_slot: 4 }, CARDS, monsters))).toBe(true);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "combat", target_monster_id: "m1", used_card_slot: "4" }, CARDS, monsters))).toBe(true);
  });
  it("훈련: from 은 활성, to 는 존재(같은 칸 허용)", () => {
    const ok = validateActionAgainstCards({ action_type: "training", training_from_slot: 1, training_to_slot: 1 }, CARDS, monsters);
    expect(isValidationFailure(ok)).toBe(false);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "training", training_from_slot: 3, training_to_slot: 1 }, CARDS, monsters))).toBe(true);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "training", training_from_slot: 1, training_to_slot: 9 }, CARDS, monsters))).toBe(true);
  });
  it("휴식: 비활성 카드만, 최대 3장, 중복 제거", () => {
    const ok = validateActionAgainstCards({ action_type: "rest", rest_slots: [3, 3, 1] }, CARDS, monsters);
    expect(isValidationFailure(ok)).toBe(false);
    if (!isValidationFailure(ok) && ok.type === "rest") expect(ok.slots).toEqual([3]);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "rest", rest_slots: [1, 2] }, CARDS, monsters))).toBe(true);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "rest", rest_slots: "3" }, CARDS, monsters))).toBe(true);
  });
  it("재선택 시 '되돌린 뒤' 카드로 검증한다 — 전투에 쓴 카드를 다시 전투에 낼 수 있어야 한다", () => {
    // 현재 DB 상태: slot4 가 전투로 비활성. 스냅샷(제출 전)에는 활성.
    const current: CardSnapshot = CARDS.map((c) => (c.cardSlot === 4 ? { ...c, isActive: false } : c));
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "combat", target_monster_id: "m1", used_card_slot: 4 }, current, monsters))).toBe(true);
    expect(isValidationFailure(validateActionAgainstCards({ action_type: "combat", target_monster_id: "m1", used_card_slot: 4 }, CARDS, monsters))).toBe(false);
  });
});

describe("isLateCombat (라운드 마감과 겹친 전투 — 조용한 유실 금지)", () => {
  it("라운드가 넘어갔는데 그 라운드 '전투:' 로그가 없으면 늦은 전투", () => {
    expect(isLateCombat({ action: { round: 4, action_type: "combat" }, currentRound: 5, logs: [] })).toBe(true);
  });
  it("정산이 남긴 '전투:' 로그가 있으면 정상", () => {
    expect(
      isLateCombat({
        action: { round: 4, action_type: "combat" },
        currentRound: 5,
        logs: [{ round: 4, log: "전투: 종이 연구원에게 총 4 피해를 입혔습니다." }],
      }),
    ).toBe(false);
  });
  it("같은 라운드(아직 정산 전)·휴식·훈련은 늦은 전투가 아니다", () => {
    expect(isLateCombat({ action: { round: 5, action_type: "combat" }, currentRound: 5, logs: [] })).toBe(false);
    expect(isLateCombat({ action: { round: 4, action_type: "rest" }, currentRound: 5, logs: [] })).toBe(false);
    expect(isLateCombat({ action: null, currentRound: 5, logs: [] })).toBe(false);
  });
  it("알림 로그 문구에 카드 값이 들어간다", () => {
    expect(lateCombatLog(3)).toContain("카드(값 3)");
    expect(lateCombatLog(null)).toContain("카드를 다시 활성화");
  });
});
