"use client";

import { useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { describeSubmitFailure } from "@/components/PhoneNotices";

type DefenseStateForAction = {
  round: number | null;
  monsters: {
    instanceId: string;
    monsterId: number;
    slotIndex: number;
    currentHp: number;
    remainingTime: number;
    status: string;
    name: string;
    description: string;
    maxHp: number;
    baseTime: number;
    points: number;
    image: string;
  }[];
  cards: {
    cardSlot: number;
    cardValue: number;
    isActive: boolean;
  }[];
  action: {
    round: number;
    actionType: string;
    targetMonsterId: string | null;
    usedCardValue: number | null;
    trainingFrom: number | null;
    trainingTo: number | null;
  } | null;
};

type Props = {
  state: DefenseStateForAction;
  nickname: string;
  room: string;
  onActionCompleted: () => Promise<void> | void;
  roomEnded?: boolean;
  timerExpired?: boolean;
  notice?: string | null;
};

type Step =
  | "chooseAction"
  | "restChooseCards"
  | "trainingChooseFrom"
  | "trainingChooseTo"
  | "combatChooseMonster"
  | "combatChooseCard";

// 행동 탭 — 계약(ITER5): 라운드 진행 전까지 "다시 고르기"로 행동을 바꿀 수 있다(마지막 선택만 반영).
//  - 제출됨 상태: 요약 + 「제출됨 · 바꾸려면 다시 고르세요」 + [다시 고르기]
//  - 다시 고르기: 같은 선택 흐름(선택 → 확정 버튼)으로 진행, 확정 전까지는 이전 선택이 유지된다
//  - 라운드가 바뀌면 부모가 key 를 바꿔 이 컴포넌트가 새로 마운트된다(단계 초기화)
//  - 소프트 타이머: 0:00 이 지나도 GM이 라운드를 넘기기 전까지는 제출/변경할 수 있다(서버도 막지 않음)
export function DefenseActionTab({
  state,
  nickname,
  room,
  onActionCompleted,
  roomEnded = false,
  notice = null,
}: Props) {
  const [step, setStep] = useState<Step>("chooseAction");
  const [pendingAction, setPendingAction] = useState<
    "rest" | "training" | "combat" | null
  >(null);
  const [selectedFromSlot, setSelectedFromSlot] = useState<number | null>(null);
  const [selectedTrainingToSlot, setSelectedTrainingToSlot] = useState<
    number | null
  >(null);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(
    null
  );
  const [selectedCardSlot, setSelectedCardSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRestSlots, setSelectedRestSlots] = useState<number[]>([]);
  const [rePicking, setRePicking] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<"new" | "replaced" | null>(null);

  const hasActionThisRound =
    state.action != null && state.action.round === state.round;

  // 다시 고르기 중에는 "이전 행동을 되돌린 뒤"의 카드 상태를 기준으로 고르게 해야 하지만,
  // 폰은 스냅샷을 모르므로 현재 카드로 보여 주고, 서버가 되돌린 상태에 대해 검증한다(실패하면 이전 선택 유지).
  const activeCards = state.cards.filter((c) => c.isActive);

  const resetSelection = () => {
    setPendingAction(null);
    setStep("chooseAction");
    setSelectedFromSlot(null);
    setSelectedTrainingToSlot(null);
    setSelectedMonsterId(null);
    setSelectedCardSlot(null);
    setSelectedRestSlots([]);
  };

  const submitAction = async (payload: {
    action_type: "rest" | "training" | "combat";
    target_monster_id?: string | null;
    used_card_slot?: number | null;
    training_from_slot?: number | null;
    training_to_slot?: number | null;
    rest_slots?: number[];
  }) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    let status: number | null = null;
    try {
      const res = await fetch("/api/defense/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          room,
          nickname,
          // 폰이 보고 있던 라운드 — 서버 라운드와 다르면 409(늦은 화면의 옛 버튼 방지)
          round: state.round,
          ...payload,
        }),
      });
      status = res.status;
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        replaced?: boolean;
        error?: string;
        reason?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        const message = describeSubmitFailure(status, json, "행동 처리 중 오류가 발생했습니다.");
        // 라운드가 넘어간 경우 최신 상태를 바로 다시 읽는다
        if (json?.reason === "round_mismatch" || json?.reason === "round_advanced") {
          await onActionCompleted();
        }
        throw new Error(message);
      }

      await onActionCompleted();
      resetSelection();
      setRePicking(false);
      setJustSubmitted(json.replaced ? "replaced" : "new");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "행동 처리 중 오류가 발생했습니다.";
      setError(status === null ? describeSubmitFailure(null, null, message) : message);
    } finally {
      setSubmitting(false);
    }
  };

  const describeAction = (): string => {
    const a = state.action;
    if (!a) return "";
    if (a.actionType === "rest") {
      return "이번 라운드에 휴식을 선택했습니다.";
    }
    if (a.actionType === "training") {
      if (a.trainingFrom != null && a.trainingTo != null) {
        return `이번 라운드에 훈련을 선택했습니다. 숫자 ${a.trainingFrom} 카드를 비활성화하고 숫자 ${
          a.trainingTo
        } 카드를 ${a.trainingTo + 1}로 강화했습니다.`;
      }
      return "이번 라운드에 훈련을 선택했습니다. 한 장을 비활성화하고 다른 한 장을 강화했습니다.";
    }
    if (a.actionType === "combat") {
      const monster = a.targetMonsterId
        ? state.monsters.find((m) => m.instanceId === a.targetMonsterId) ?? null
        : null;
      if (monster && a.usedCardValue != null) {
        return `이번 라운드에 대기열 ${monster.slotIndex + 1}번 몬스터 ${monster.name}에게 숫자 ${
          a.usedCardValue
        } 카드를 사용했습니다.`;
      }
      return "이번 라운드에 전투를 선택했습니다.";
    }
    return "";
  };

  // ── 제출됨 상태(다시 고르기 전) ─────────────────────────
  if (hasActionThisRound && !rePicking) {
    return (
      <div className="space-y-3 text-base text-zinc-200" data-testid="action-submitted">
        {notice && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" data-testid="late-notice">
            {notice}
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        <div className="rounded-lg bg-zinc-900 p-3 text-base">
          <p>{describeAction()}</p>
        </div>
        <p className="text-sm font-semibold text-emerald-300" data-testid="submitted-label">
          {justSubmitted === "replaced" ? "변경됨" : "제출됨"} · 바꾸려면 다시 고르세요
        </p>
        {roomEnded ? (
          <p className="text-sm text-zinc-500">종료된 방이라 더 바꿀 수 없습니다.</p>
        ) : (
          <>
            <button
              type="button"
              aria-label="행동 다시 고르기"
              data-testid="repick-button"
              className="min-h-11 w-full rounded-full border border-amber-400/70 bg-zinc-900 text-base font-semibold text-amber-300 hover:bg-zinc-800"
              onClick={() => {
                setError(null);
                setJustSubmitted(null);
                setRePicking(true);
              }}
            >
              다시 고르기
            </button>
          </>
        )}
      </div>
    );
  }

  if (roomEnded) {
    return (
      <div className="space-y-3 text-base text-zinc-200">
        <p className="rounded-lg bg-zinc-900 p-3 text-sm text-zinc-400">종료된 방입니다. 행동을 제출할 수 없습니다.</p>
      </div>
    );
  }

  const cancelButtonClass =
    "min-h-11 rounded-full bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700";
  const confirmButtonClass =
    "min-h-11 rounded-full bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50";
  const confirmSuffix = rePicking ? "으로 변경 확정" : " 확정";

  return (
    <div className="space-y-4 text-base text-zinc-200" data-testid="action-chooser">
      {notice && !hasActionThisRound && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" data-testid="late-notice">
          {notice}
        </p>
      )}
      {rePicking && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" data-testid="repick-banner">
          <span>이전 선택을 바꿉니다. 확정 전까지는 이전 선택이 유지됩니다.</span>
          <button
            type="button"
            aria-label="다시 고르기 취소"
            className="min-h-11 shrink-0 rounded-full bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
            disabled={submitting}
            onClick={() => {
              resetSelection();
              setRePicking(false);
              setError(null);
            }}
          >
            취소
          </button>
        </div>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          전투 / 휴식 / 훈련 중 어느 것을 선택하시겠습니까?
        </h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label="전투 선택"
            className="min-h-16 rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 hover:bg-emerald-400"
            disabled={submitting}
            onClick={() => {
              setPendingAction("combat");
              setSelectedMonsterId(null);
              setSelectedCardSlot(null);
              setStep("combatChooseMonster");
            }}
          >
            전투 <br /> (몬스터에게 숫자 카드 사용)
          </button>
          <button
            type="button"
            aria-label="휴식 선택"
            className="min-h-16 rounded-full bg-zinc-800 text-base font-semibold text-zinc-100 hover:bg-zinc-700"
            disabled={submitting}
            onClick={() => {
              setPendingAction("rest");
              setSelectedRestSlots([]);
              setStep("restChooseCards");
            }}
          >
            휴식
            <br /> (비활성 숫자 카드 최대 3장 활성화)
          </button>
          <button
            type="button"
            aria-label="훈련 선택"
            className="min-h-16 rounded-full bg-indigo-500 text-base font-semibold text-zinc-50 hover:bg-indigo-400"
            disabled={submitting}
            onClick={() => {
              setPendingAction("training");
              setSelectedFromSlot(null);
              setSelectedTrainingToSlot(null);
              setStep("trainingChooseFrom");
            }}
          >
            훈련 <br /> (한 카드를 비활성화해 한 카드를 강화)
          </button>
        </div>
      </section>

      {step === "restChooseCards" && pendingAction === "rest" && (
        <section className="space-y-2 rounded-lg bg-zinc-900 p-3 text-base">
          <p className="font-semibold">
            휴식 – 다시 활성화할 카드를 선택하세요.
          </p>
          <p className="text-sm text-zinc-400">
            비활성화된 숫자 카드 중 최대 3장을 선택해 활성화합니다.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {state.cards
              .filter((c) => !c.isActive)
              .map((c) => {
                const selected = selectedRestSlots.includes(c.cardSlot);
                const disabledSelection =
                  !selected && selectedRestSlots.length >= 3;
                return (
                  <button
                    key={c.cardSlot}
                    type="button"
                    aria-label={`숫자 ${c.cardValue} 카드 ${selected ? "선택 해제" : "선택"}`}
                    aria-pressed={selected}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-base ${
                      selected
                        ? "border-amber-400 bg-zinc-800"
                        : "border-zinc-700 bg-zinc-950 hover:bg-zinc-900"
                    }`}
                    disabled={submitting || disabledSelection}
                    onClick={() => {
                      setSelectedRestSlots((prev) => {
                        if (prev.includes(c.cardSlot)) {
                          return prev.filter((s) => s !== c.cardSlot);
                        }
                        if (prev.length >= 3) return prev;
                        return [...prev, c.cardSlot];
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-300">
                        {c.cardValue}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      현재 상태: {c.isActive ? "활성" : "비활성"}
                    </p>
                  </button>
                );
              })}
          </div>
          {state.cards.filter((c) => !c.isActive).length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              비활성화된 숫자 카드가 없습니다.
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-zinc-400">
              선택한 카드:{" "}
              {selectedRestSlots.length > 0
                ? selectedRestSlots
                    .map(
                      (slot) =>
                        state.cards.find((c) => c.cardSlot === slot)?.cardValue
                    )
                    .filter((v) => v != null)
                    .join(", ")
                : "없음"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="휴식 선택 취소"
                className={cancelButtonClass}
                disabled={submitting}
                onClick={() => {
                  setPendingAction(null);
                  setSelectedRestSlots([]);
                  setStep("chooseAction");
                }}
              >
                취소
              </button>
              <button
                type="button"
                aria-label={`휴식${confirmSuffix}`}
                data-testid="confirm-rest"
                className={confirmButtonClass}
                disabled={submitting || selectedRestSlots.length === 0}
                onClick={() => {
                  void submitAction({
                    action_type: "rest",
                    rest_slots: selectedRestSlots,
                  });
                }}
              >
                {submitting ? "제출 중…" : `휴식${confirmSuffix}`}
              </button>
            </div>
          </div>
        </section>
      )}

      {step === "trainingChooseFrom" && pendingAction === "training" && (
        <section className="space-y-2 rounded-lg bg-zinc-900 p-3 text-base">
          <p className="font-semibold">훈련 – 비활성화할 카드를 선택하세요.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {state.cards
              .filter((c) => c.isActive)
              .map((c) => (
                <button
                  key={c.cardSlot}
                  type="button"
                  aria-label={`숫자 ${c.cardValue} 카드를 비활성화`}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-base ${
                    selectedFromSlot === c.cardSlot
                      ? "border-amber-400 bg-zinc-800"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                  disabled={submitting}
                  onClick={() => {
                    setSelectedFromSlot(c.cardSlot);
                    setSelectedTrainingToSlot(null);
                    setStep("trainingChooseTo");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      {c.cardValue}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">
                    현재 상태: {c.isActive ? "활성" : "비활성"}
                  </p>
                </button>
              ))}
          </div>
          {state.cards.filter((c) => c.isActive).length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              활성화된 숫자 카드가 없습니다. 훈련을 선택해도 변화가 거의 없을 수
              있습니다.
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              aria-label="훈련 선택 취소"
              className={cancelButtonClass}
              disabled={submitting}
              onClick={() => {
                setPendingAction(null);
                setSelectedFromSlot(null);
                setStep("chooseAction");
              }}
            >
              취소
            </button>
          </div>
        </section>
      )}

      {step === "trainingChooseTo" &&
        pendingAction === "training" &&
        selectedFromSlot != null && (
          <section className="space-y-2 rounded-lg bg-zinc-900 p-3 text-base">
            <p className="font-semibold">훈련 – 강화할 카드를 선택하세요.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {state.cards.map((c) => (
                <button
                  key={c.cardSlot}
                  type="button"
                  aria-label={`숫자 ${c.cardValue} 카드를 ${c.cardValue + 1}로 강화`}
                  aria-pressed={selectedTrainingToSlot === c.cardSlot}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-base ${
                    selectedTrainingToSlot === c.cardSlot
                      ? "border-amber-400 bg-zinc-800"
                      : "border-zinc-700 bg-zinc-950 hover:bg-zinc-900"
                  }`}
                  disabled={submitting}
                  onClick={() => {
                    setSelectedTrainingToSlot(c.cardSlot);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      {c.cardValue} → {c.cardValue + 1}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    현재 상태: {c.isActive ? "활성" : "비활성"}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-between gap-2">
              <button
                type="button"
                aria-label="훈련 선택 취소"
                className={`${cancelButtonClass} flex-1`}
                disabled={submitting}
                onClick={() => {
                  setPendingAction(null);
                  setSelectedFromSlot(null);
                  setSelectedTrainingToSlot(null);
                  setStep("chooseAction");
                }}
              >
                취소
              </button>
              <button
                type="button"
                aria-label={`훈련${confirmSuffix}`}
                data-testid="confirm-training"
                className={`${confirmButtonClass} flex-1`}
                disabled={submitting || selectedTrainingToSlot == null}
                onClick={() => {
                  if (selectedTrainingToSlot == null) return;
                  void submitAction({
                    action_type: "training",
                    training_from_slot: selectedFromSlot,
                    training_to_slot: selectedTrainingToSlot,
                  });
                }}
              >
                {submitting ? "제출 중…" : `훈련${confirmSuffix}`}
              </button>
            </div>
          </section>
        )}

      {step === "combatChooseMonster" && pendingAction === "combat" && (
        <section className="space-y-2 rounded-lg bg-zinc-900 p-3 text-base">
          <p className="font-semibold">전투 – 공격할 몬스터를 선택하세요.</p>
          <p className="text-sm text-zinc-400">대기열 순서대로 표시됩니다.</p>
          {state.monsters.length === 0 ? (
            <p className="text-sm text-zinc-500">대기열에 몬스터가 없습니다.</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {state.monsters
                .slice()
                .sort((a, b) => a.slotIndex - b.slotIndex)
                .map((m) => (
                  <button
                    key={m.instanceId}
                    type="button"
                    aria-label={`${m.name} 공격 (HP ${m.currentHp}/${m.maxHp}, ${m.points}점)`}
                    data-testid={`monster-${m.slotIndex}`}
                    className="flex min-h-11 flex-col items-start rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base hover:bg-zinc-900"
                    disabled={submitting}
                    onClick={() => {
                      setSelectedMonsterId(m.instanceId);
                      setStep("combatChooseCard");
                    }}
                  >
                    <span className="text-sm font-semibold">{m.name}</span>
                    <span className="mt-0.5 text-sm text-zinc-400">
                      HP {m.currentHp} / {m.maxHp} · 잔여 시간 :{" "}
                      {m.remainingTime} · {m.points}점
                    </span>
                  </button>
                ))}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              aria-label="전투 선택 취소"
              className={cancelButtonClass}
              disabled={submitting}
              onClick={() => {
                setPendingAction(null);
                setSelectedMonsterId(null);
                setStep("chooseAction");
              }}
            >
              취소
            </button>
          </div>
        </section>
      )}

      {step === "combatChooseCard" &&
        pendingAction === "combat" &&
        selectedMonsterId && (
          <section className="space-y-2 rounded-lg bg-zinc-900 p-3 text-base">
            <p className="font-semibold">전투 – 사용할 카드를 선택하세요.</p>
            {activeCards.length === 0 ? (
              <p className="text-sm text-zinc-500">활성화된 카드가 없습니다.</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {activeCards.map((c) => (
                  <button
                    key={c.cardSlot}
                    type="button"
                    aria-label={`숫자 ${c.cardValue} 카드 사용`}
                    aria-pressed={selectedCardSlot === c.cardSlot}
                    data-testid={`card-${c.cardSlot}`}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-base ${
                      selectedCardSlot === c.cardSlot
                        ? "border-amber-400 bg-zinc-800"
                        : "border-zinc-700 bg-zinc-950 hover:bg-zinc-900"
                    }`}
                    disabled={submitting}
                    onClick={() => {
                      setSelectedCardSlot(c.cardSlot);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-amber-300">
                        {c.cardValue}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-between gap-2">
              <button
                type="button"
                aria-label="전투 선택 취소"
                className={`${cancelButtonClass} flex-1`}
                disabled={submitting}
                onClick={() => {
                  setPendingAction(null);
                  setSelectedMonsterId(null);
                  setSelectedCardSlot(null);
                  setStep("chooseAction");
                }}
              >
                취소
              </button>
              <button
                type="button"
                aria-label={`전투${confirmSuffix}`}
                data-testid="confirm-combat"
                className={`${confirmButtonClass} flex-1`}
                disabled={submitting || selectedCardSlot == null}
                onClick={() => {
                  if (!selectedCardSlot) return;
                  void submitAction({
                    action_type: "combat",
                    target_monster_id: selectedMonsterId,
                    used_card_slot: selectedCardSlot,
                  });
                }}
              >
                {submitting ? "제출 중…" : `전투${confirmSuffix}`}
              </button>
            </div>
          </section>
        )}

      {error && (
        <section>
          <ErrorMessage message={error} />
        </section>
      )}
    </div>
  );
}
