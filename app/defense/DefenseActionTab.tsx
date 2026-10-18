"use client";

import { useState } from "react";
import Image from "next/image";
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
  notice?: string | null;
};

type Step =
  | "chooseAction"
  | "restChooseCards"
  | "trainingChooseFrom"
  | "trainingChooseTo"
  | "combatChooseMonster"
  | "combatChooseCard";

// 행동 탭 — 계약(ITER6, 2026-10-18 또니 — 낙장불입): 제출한 행동은 그 라운드에 바꿀 수 없다.
//  - 제출됨 상태: 요약 + 「제출됨」만 보여 준다(다시 고르기 없음, 서버도 두 번째 제출을 409 already_submitted로 거부)
//  - 라운드가 바뀌면 부모가 key 를 바꿔 이 컴포넌트가 새로 마운트된다(단계 초기화)
//  - 소프트 타이머: 폰에는 시간을 표시하지 않고, GM이 라운드를 넘기기 전까지는 제출할 수 있다(서버도 막지 않음)
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

  const hasActionThisRound =
    state.action != null && state.action.round === state.round;

  const activeCards = state.cards.filter((c) => c.isActive);
  const inactiveCards = state.cards.filter((c) => !c.isActive);
  const sortedMonsters = state.monsters.slice().sort((a, b) => a.slotIndex - b.slotIndex);

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
        error?: string;
        reason?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        const message = describeSubmitFailure(status, json, "행동 처리 중 오류가 발생했습니다.");
        // 라운드가 넘어갔거나 이미 제출된 경우 최신 상태를 바로 다시 읽는다(제출됨 화면으로)
        if (json?.reason === "round_mismatch" || json?.reason === "round_advanced" || json?.reason === "already_submitted") {
          await onActionCompleted();
        }
        throw new Error(message);
      }

      await onActionCompleted();
      resetSelection();
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

  const actionTitle = (): string => {
    const t = state.action?.actionType;
    if (t === "rest") return "휴식";
    if (t === "training") return "훈련";
    if (t === "combat") return "전투";
    return "행동";
  };

  // ── 제출됨 상태(낙장불입 — 이 라운드에는 더 바꾸지 않는다) ──────────
  if (hasActionThisRound) {
    return (
      <div className="space-y-3 text-base text-zinc-200" data-testid="action-submitted">
        {notice && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" data-testid="late-notice">
            {notice}
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-2xl text-zinc-950">✓</div>
          <p className="text-lg font-bold text-white">{actionTitle()} 제출 완료</p>
          <p className="mt-2 leading-6 text-zinc-300">{describeAction()}</p>
          <p className="mt-4 text-sm font-semibold text-emerald-300" data-testid="submitted-label">
            제출됨 · 제출한 행동은 바꿀 수 없습니다
          </p>
        </div>
      </div>
    );
  }

  if (roomEnded) {
    return (
      <div className="space-y-3 text-base text-zinc-200">
        <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">종료된 방입니다. 행동을 제출할 수 없습니다.</p>
      </div>
    );
  }

  const cancelButtonClass =
    "min-h-12 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50";
  const confirmSuffix = " 확정";
  const cardTile = (selected: boolean, tone: "emerald" | "indigo" | "rose") => {
    const on =
      tone === "emerald"
        ? "border-emerald-400 bg-emerald-950/50 shadow-lg shadow-emerald-950"
        : tone === "indigo"
          ? "border-indigo-400 bg-indigo-950/50 shadow-lg shadow-indigo-950"
          : "border-rose-400 bg-rose-950/50 shadow-lg shadow-rose-950";
    return `relative min-h-32 rounded-2xl border-2 px-3 py-3 text-base transition active:scale-95 disabled:opacity-40 ${
      selected ? on : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
    }`;
  };

  return (
    <div className="space-y-4 text-base text-zinc-200" data-testid="action-chooser">
      {notice && !hasActionThisRound && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" data-testid="late-notice">
          {notice}
        </p>
      )}
      {step === "chooseAction" && (
        <section className="space-y-4">
          <div>
            <p className="text-sm font-bold text-amber-300">이번 라운드 행동</p>
            <h2 className="mt-1 text-2xl font-black text-white">무엇을 할까요?</h2>
            <p className="mt-1 text-sm text-zinc-400" data-testid="action-final-note">한 번 제출하면 이번 라운드에는 바꿀 수 없습니다.</p>
          </div>
          <div className="grid gap-3">
            <button
              type="button"
              aria-label="전투 선택"
              className="group flex min-h-24 items-center gap-4 rounded-2xl border border-rose-400/40 bg-gradient-to-r from-rose-950/80 to-zinc-900 p-4 text-left transition active:scale-[0.98]"
              disabled={submitting}
              onClick={() => {
                setPendingAction("combat");
                setSelectedMonsterId(null);
                setSelectedCardSlot(null);
                setStep("combatChooseMonster");
              }}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-3xl">⚔</span>
              <span className="min-w-0">
                <b className="block text-xl text-white">전투</b>
                <span className="mt-1 block text-sm text-rose-100/70">몬스터 하나에게 숫자 카드 한 장을 사용합니다.</span>
              </span>
              <span className="ml-auto text-2xl text-rose-300">›</span>
            </button>
            <button
              type="button"
              aria-label="휴식 선택"
              className="flex min-h-24 items-center gap-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950/70 to-zinc-900 p-4 text-left transition active:scale-[0.98]"
              disabled={submitting}
              onClick={() => {
                setPendingAction("rest");
                setSelectedRestSlots([]);
                setStep("restChooseCards");
              }}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-3xl">✦</span>
              <span className="min-w-0">
                <b className="block text-xl text-white">휴식</b>
                <span className="mt-1 block text-sm text-emerald-100/70">비활성 카드 중 최대 3장을 활성화합니다.</span>
              </span>
              <span className="ml-auto text-2xl text-emerald-300">›</span>
            </button>
            <button
              type="button"
              aria-label="훈련 선택"
              className="flex min-h-24 items-center gap-4 rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-950/80 to-zinc-900 p-4 text-left transition active:scale-[0.98]"
              disabled={submitting}
              onClick={() => {
                setPendingAction("training");
                setSelectedFromSlot(null);
                setSelectedTrainingToSlot(null);
                setStep("trainingChooseFrom");
              }}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-3xl">↑</span>
              <span className="min-w-0">
                <b className="block text-xl text-white">훈련</b>
                <span className="mt-1 block text-sm text-indigo-100/70">카드 한 장을 비활성화해 다른 카드를 강화합니다.</span>
              </span>
              <span className="ml-auto text-2xl text-indigo-300">›</span>
            </button>
          </div>
        </section>
      )}

      {step === "restChooseCards" && pendingAction === "rest" && (
        <section className="space-y-3 rounded-2xl border border-emerald-500/20 bg-zinc-900 p-4 text-base">
          <div>
            <p className="text-sm font-bold text-emerald-300">휴식</p>
            <p className="mt-1 text-xl font-black text-white">다시 활성화할 카드 선택</p>
            <p className="mt-1 text-sm text-zinc-400">비활성화된 숫자 카드 중 최대 3장을 선택합니다.</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {inactiveCards.map((c) => {
              const selected = selectedRestSlots.includes(c.cardSlot);
              const disabledSelection = !selected && selectedRestSlots.length >= 3;
              return (
                <button
                  key={c.cardSlot}
                  type="button"
                  aria-label={`숫자 ${c.cardValue} 카드 ${selected ? "선택 해제" : "선택"}`}
                  aria-pressed={selected}
                  className={cardTile(selected, "emerald")}
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
                  <div className="flex h-full flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white">{c.cardValue}</span>
                    <span className="mt-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">카드 {c.cardSlot} · 비활성</span>
                  </div>
                  {selected && <span className="absolute right-2 top-2 text-emerald-300">✓</span>}
                </button>
              );
            })}
          </div>
          {inactiveCards.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">비활성화된 숫자 카드가 없습니다.</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-zinc-400">
              선택한 카드:{" "}
              {selectedRestSlots.length > 0
                ? selectedRestSlots
                    .map((slot) => state.cards.find((c) => c.cardSlot === slot)?.cardValue)
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
                className="min-h-12 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50"
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
        <section className="space-y-3 rounded-2xl border border-indigo-500/20 bg-zinc-900 p-4 text-base">
          <div>
            <p className="text-sm font-bold text-indigo-300">훈련 1/2</p>
            <p className="mt-1 text-xl font-black text-white">비활성화할 카드 선택</p>
            <p className="mt-1 text-sm text-zinc-400">활성 카드 한 장을 훈련 비용으로 비활성화합니다.</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {activeCards.map((c) => (
              <button
                key={c.cardSlot}
                type="button"
                aria-label={`숫자 ${c.cardValue} 카드를 비활성화`}
                className={cardTile(selectedFromSlot === c.cardSlot, "indigo")}
                disabled={submitting}
                onClick={() => {
                  setSelectedFromSlot(c.cardSlot);
                  setSelectedTrainingToSlot(null);
                  setStep("trainingChooseTo");
                }}
              >
                <div className="flex h-full flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white">{c.cardValue}</span>
                  <span className="mt-2 text-xs text-zinc-500">카드 {c.cardSlot} · 활성</span>
                </div>
              </button>
            ))}
          </div>
          {activeCards.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              활성화된 숫자 카드가 없습니다. 훈련을 선택해도 변화가 거의 없을 수 있습니다.
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
          <section className="space-y-3 rounded-2xl border border-indigo-500/20 bg-zinc-900 p-4 text-base">
            <div>
              <p className="text-sm font-bold text-indigo-300">훈련 2/2</p>
              <p className="mt-1 text-xl font-black text-white">강화할 카드 선택</p>
              <p className="mt-1 text-sm text-zinc-400">아무 카드나 +1 할 수 있습니다. 방금 비활성화할 카드도 고를 수 있습니다.</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {state.cards.map((c) => (
                <button
                  key={c.cardSlot}
                  type="button"
                  aria-label={`숫자 ${c.cardValue} 카드를 ${c.cardValue + 1}로 강화`}
                  aria-pressed={selectedTrainingToSlot === c.cardSlot}
                  className={cardTile(selectedTrainingToSlot === c.cardSlot, "indigo")}
                  disabled={submitting}
                  onClick={() => {
                    setSelectedTrainingToSlot(c.cardSlot);
                  }}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">
                      {c.cardValue} → {c.cardValue + 1}
                    </span>
                    <span className="mt-2 text-xs text-zinc-500">
                      카드 {c.cardSlot} · {c.isActive ? "활성" : "비활성"}
                    </span>
                    {c.cardSlot === selectedFromSlot && (
                      <span className="mt-1 text-xs font-bold text-indigo-300">강화 후에도 비활성</span>
                    )}
                  </div>
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
                className="min-h-12 flex-1 rounded-xl bg-indigo-500 px-3 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
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
        <section className="space-y-3 rounded-2xl border border-rose-500/20 bg-zinc-900 p-4 text-base">
          <div>
            <p className="text-sm font-bold text-rose-300">전투 1/2</p>
            <p className="mt-1 text-xl font-black text-white">공격할 몬스터 선택</p>
          </div>
          {sortedMonsters.length === 0 ? (
            <p className="text-sm text-zinc-500">대기열에 몬스터가 없습니다.</p>
          ) : (
            <div className="mt-2 grid gap-3">
              {sortedMonsters.map((m) => (
                <button
                  key={m.instanceId}
                  type="button"
                  aria-label={`${m.name} 공격 (HP ${m.currentHp}/${m.maxHp}, ${m.points}점)`}
                  data-testid={`monster-${m.slotIndex}`}
                  className="flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-left transition hover:border-rose-400 active:scale-[0.98] disabled:opacity-50"
                  disabled={submitting}
                  onClick={() => {
                    setSelectedMonsterId(m.instanceId);
                    setStep("combatChooseCard");
                  }}
                >
                  <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                    {m.image ? (
                      <Image src={m.image} alt="" fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-3xl">👾</span>
                    )}
                    <b className="absolute left-1 top-1 rounded-md bg-zinc-950/90 px-1.5 py-0.5 text-xs text-amber-300">#{m.slotIndex + 1}</b>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-lg text-white">{m.name}</b>
                      <b className="shrink-0 text-amber-300">{m.points}점</b>
                    </span>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-zinc-800">
                      <span
                        className="block h-full rounded-full bg-rose-500"
                        style={{ width: `${Math.max(0, Math.min(100, (m.currentHp / Math.max(1, m.maxHp)) * 100))}%` }}
                      />
                    </span>
                    <span className="mt-1 flex justify-between text-xs text-zinc-400">
                      <span>HP {m.currentHp}/{m.maxHp}</span>
                      <span>잔여 시간 {m.remainingTime}</span>
                    </span>
                  </span>
                  <span className="text-2xl text-zinc-500">›</span>
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
          <section className="space-y-3 rounded-2xl border border-rose-500/20 bg-zinc-900 p-4 text-base">
            <div>
              <p className="text-sm font-bold text-rose-300">전투 2/2</p>
              <p className="mt-1 text-xl font-black text-white">사용할 카드 선택</p>
              <p className="mt-1 text-sm text-zinc-400">사용한 카드는 전투 후 비활성화됩니다.</p>
            </div>
            {(() => {
              const target = state.monsters.find((m) => m.instanceId === selectedMonsterId);
              return target ? (
                <div className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2">
                  <span className="text-sm text-zinc-400">공격 대상</span>
                  <b className="text-white">
                    #{target.slotIndex + 1} {target.name}
                  </b>
                </div>
              ) : null;
            })()}
            {activeCards.length === 0 ? (
              <p className="text-sm text-zinc-500">활성화된 카드가 없습니다.</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3">
                {activeCards.map((c) => (
                  <button
                    key={c.cardSlot}
                    type="button"
                    aria-label={`숫자 ${c.cardValue} 카드 사용`}
                    aria-pressed={selectedCardSlot === c.cardSlot}
                    data-testid={`card-${c.cardSlot}`}
                    className={cardTile(selectedCardSlot === c.cardSlot, "rose")}
                    disabled={submitting}
                    onClick={() => {
                      setSelectedCardSlot(c.cardSlot);
                    }}
                  >
                    <div className="flex h-full flex-col items-center justify-center">
                      <span className="text-xs font-bold tracking-widest text-zinc-500">POWER</span>
                      <span className="mt-1 text-5xl font-black text-white">{c.cardValue}</span>
                      <span className="mt-2 text-xs text-zinc-500">카드 {c.cardSlot}</span>
                    </div>
                    {selectedCardSlot === c.cardSlot && <span className="absolute right-2 top-2 text-rose-300">✓</span>}
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
                className="min-h-12 flex-1 rounded-xl bg-rose-500 px-3 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-50"
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
