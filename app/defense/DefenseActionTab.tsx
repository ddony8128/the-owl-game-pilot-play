"use client";

import { useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";

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
    usedCardSlot: number | null;
    trainingFromSlot: number | null;
    trainingToSlot: number | null;
  } | null;
};

type Props = {
  state: DefenseStateForAction;
  nickname: string;
  onActionCompleted: () => Promise<void> | void;
};

type Step =
  | "chooseAction"
  | "confirmRest"
  | "trainingChooseFrom"
  | "trainingChooseTo"
  | "combatChooseMonster"
  | "combatChooseCard";

export function DefenseActionTab({
  state,
  nickname,
  onActionCompleted,
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

  const hasActionThisRound =
    state.action != null && state.action.round === state.round;

  const activeCards = state.cards.filter((c) => c.isActive);

  const submitAction = async (payload: {
    action_type: "rest" | "training" | "combat";
    target_monster_id?: string | null;
    used_card_slot?: number | null;
    training_from_slot?: number | null;
    training_to_slot?: number | null;
  }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/defense/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname,
          ...payload,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "행동 처리 중 오류가 발생했습니다.");
      }

      await onActionCompleted();
      setPendingAction(null);
      setStep("chooseAction");
      setSelectedFromSlot(null);
      setSelectedTrainingToSlot(null);
      setSelectedMonsterId(null);
      setSelectedCardSlot(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "행동 처리 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (hasActionThisRound) {
    const a = state.action!;
    let description = "";
    if (a.actionType === "rest") {
      description = "이번 라운드에 휴식을 선택했습니다.";
    } else if (a.actionType === "training") {
      const fromSlot = a.trainingFromSlot;
      const toSlot = a.trainingToSlot;
      const fromCard =
        fromSlot != null
          ? state.cards.find((c) => c.cardSlot === fromSlot) ?? null
          : null;
      const toCard =
        toSlot != null
          ? state.cards.find((c) => c.cardSlot === toSlot) ?? null
          : null;

      if (fromCard && toCard) {
        const fromValue = fromCard.cardValue;
        const toValue = toCard.cardValue;
        description = `이번 라운드에 훈련을 선택했습니다. 숫자 ${fromValue} 카드를 비활성화하고 숫자 ${toValue} 카드를 ${
          toValue + 1
        }로 강화했습니다.`;
      } else {
        description =
          "이번 라운드에 훈련을 선택했습니다. 한 장을 비활성화하고 다른 한 장을 강화했습니다.";
      }
    } else if (a.actionType === "combat") {
      const monster = a.targetMonsterId
        ? state.monsters.find((m) => m.instanceId === a.targetMonsterId) ?? null
        : null;
      const card =
        a.usedCardSlot != null
          ? state.cards.find((c) => c.cardSlot === a.usedCardSlot) ?? null
          : null;

      if (monster && card) {
        description = `이번 라운드에 대기열 ${monster.slotIndex + 1}번 몬스터 ${
          monster.name
        }에게 숫자 ${card.cardValue} 카드를 사용했습니다.`;
      } else {
        description = "이번 라운드에 전투를 선택했습니다.";
      }
    }

    return (
      <div className="space-y-3 text-base text-zinc-200">
        <div className="rounded-lg bg-zinc-900 p-3 text-base">
          <p>{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-base text-zinc-200">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          전투 / 휴식 / 훈련 중 어느 것을 선택하시겠습니까?
        </h2>
        <p className="text-base text-zinc-400">
          선택하지 않으면 휴식으로 자동 결정됩니다.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="h-16 rounded-full bg-emerald-500 text-base font-semibold text-zinc-950 hover:bg-emerald-400"
            disabled={submitting}
            onClick={() => {
              setPendingAction("combat");
              setStep("combatChooseMonster");
            }}
          >
            전투 <br /> (몬스터에게 숫자 카드 사용)
          </button>
          <button
            type="button"
            className="h-16 rounded-full bg-zinc-800 text-base font-semibold text-zinc-100 hover:bg-zinc-700"
            disabled={submitting}
            onClick={() => {
              setPendingAction("rest");
              setStep("confirmRest");
            }}
          >
            휴식
            <br /> (모든 숫자 카드 다시 활성화)
          </button>
          <button
            type="button"
            className="h-16 rounded-full bg-indigo-500 text-base font-semibold text-zinc-50 hover:bg-indigo-400"
            disabled={submitting}
            onClick={() => {
              setPendingAction("training");
              setStep("trainingChooseFrom");
            }}
          >
            훈련 <br /> (한 카드를 비활성화해 다른 카드를 강화)
          </button>
        </div>
      </section>

      {step === "confirmRest" && pendingAction === "rest" && (
        <section className="space-y-2 rounded-lg bg-zinc-900 p-3 text-base">
          <p>정말 휴식을 선택하시겠습니까?</p>
          <p className="text-sm text-zinc-400">
            이번 라운드에는 다른 행동을 할 수 없고, 다음 라운드에서 모든 카드가
            활성화된 상태로 시작합니다.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="h-9 flex-1 rounded-full bg-zinc-800 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
              disabled={submitting}
              onClick={() => {
                setPendingAction(null);
                setStep("chooseAction");
              }}
            >
              취소
            </button>
            <button
              type="button"
              className="h-9 flex-1 rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
              disabled={submitting}
              onClick={() =>
                submitAction({
                  action_type: "rest",
                })
              }
            >
              휴식 확정
            </button>
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
                  className={`rounded-lg border px-3 py-2 text-base ${
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
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="h-8 rounded-full bg-zinc-800 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
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
                  className={`rounded-lg border px-3 py-2 text-base ${
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
                className="h-8 flex-1 rounded-full bg-zinc-800 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
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
                className="h-8 flex-1 rounded-full bg-amber-400 px-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
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
                훈련 확정
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
                    className="flex flex-col items-start rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base hover:bg-zinc-900"
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
              className="h-8 rounded-full bg-zinc-800 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
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
                    className={`rounded-lg border px-3 py-2 text-base ${
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
                className="h-8 flex-1 rounded-full bg-zinc-800 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
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
                className="h-8 flex-1 rounded-full bg-amber-400 px-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
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
                전투 확정
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
