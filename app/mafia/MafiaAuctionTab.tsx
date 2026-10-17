"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Player } from "@/lib/types";
import { ErrorMessage } from "@/components/ErrorMessage";

const JOBS: { id: string; label: string; icon: string | null }[] = [
  {
    id: "up_manipulator",
    label: "상승 주가조작범",
    icon: "/mafia/job/up_manip.png",
  },
  {
    id: "down_manipulator",
    label: "하락 주가조작범",
    icon: "/mafia/job/down_manip.png",
  },
  { id: "robber", label: "강도", icon: "/mafia/job/robber.png" },
  { id: "police", label: "경찰", icon: "/mafia/job/police.png" },
  { id: "tax_auditor", label: "세무조사원", icon: "/mafia/job/investor.png" },
  { id: "broker", label: "증권사 직원", icon: "/mafia/job/financial.png" },
  { id: "mayor", label: "시장", icon: "/mafia/job/mayor.png" },
  { id: "ceo", label: "CEO", icon: "/mafia/job/ceo.png" },
];

type Step = "pickJob" | "enterAmount" | "confirmGiveUp";

type Props = {
  // 인증은 상위(MafiaInner)에서 한 번만 확인하고 내려준다 — 탭마다 재확인하면 직후 제출이 버려진다.
  player: Pick<Player, "nickname">;
  roomCode: string;
  myAuctionBet: {
    job: string | null;
    amount: number | null;
    give_up: boolean;
  } | null;
  playerCash: number | null;
};

export function MafiaAuctionTab({
  player,
  roomCode,
  myAuctionBet,
  playerCash,
}: Props) {
  const [step, setStep] = useState<Step>("pickJob");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedBet, setSubmittedBet] = useState<Props["myAuctionBet"]>(null);
  const submitLockRef = useRef(false);

  const handleSubmitBet = async () => {
    if (submitLockRef.current || myAuctionBet || submittedBet) return;
    if (!player?.nickname || !roomCode) return;
    if (!selectedJobId) return;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("양수를 입력해 주세요.");
      return;
    }
    const optimisticBet = {
      job: selectedJobId,
      amount: value,
      give_up: false,
    };
    submitLockRef.current = true;
    setSubmittedBet(optimisticBet);
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: roomCode,
          nickname: player.nickname,
          type: "bet",
          payload: { job: selectedJobId, amount: value },
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "베팅을 기록하지 못했습니다.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "베팅을 기록하지 못했습니다.";
      submitLockRef.current = false;
      setSubmittedBet(null);
      setError(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setAmount("");
  };

  const handleSubmitGiveUp = async () => {
    if (submitLockRef.current || myAuctionBet || submittedBet) return;
    if (!player?.nickname || !roomCode) return;
    submitLockRef.current = true;
    setSubmittedBet({ job: null, amount: null, give_up: true });
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: roomCode,
          nickname: player.nickname,
          type: "bet",
          payload: { job: null, give_up: true },
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "베팅 포기를 기록하지 못했습니다.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "베팅 포기를 기록하지 못했습니다.";
      submitLockRef.current = false;
      setSubmittedBet(null);
      setError(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setAmount("");
  };

  const currentJobLabel =
    (selectedJobId && JOBS.find((j) => j.id === selectedJobId)?.label) ?? "";

  const effectiveBet = submittedBet ?? myAuctionBet;

  // 서버 기록 또는 방금 제출한 베팅이 있으면 요약만 보여주고 재베팅을 막는다.
  if (effectiveBet) {
    const chosenJob = JOBS.find((j) => j.id === effectiveBet.job);
    const chosenLabel = chosenJob?.label;

    const message = effectiveBet.give_up
      ? "이번 라운드 직업 경매에서 베팅을 포기했습니다."
      : `${chosenLabel ?? effectiveBet.job ?? "선택한 직업"} 직업에 ${
          effectiveBet.amount ?? 0
        }원을 베팅했습니다.`;

    return (
      <div className="space-y-3 text-sm text-zinc-100">
        {error && <ErrorMessage message={error} />}
        <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-zinc-900 p-5 text-center">
          {chosenJob?.icon ? (
            <div className="relative mx-auto h-48 w-48 overflow-hidden rounded-full border-4 border-emerald-400/40 bg-zinc-800 shadow-xl shadow-emerald-950/40">
              <Image
                src={chosenJob.icon}
                alt={chosenJob.label}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-red-500/10 text-4xl">
              ×
            </div>
          )}
          <p className="mt-4 text-xs font-black tracking-[0.2em] text-emerald-400">
            {effectiveBet.give_up ? "경매 포기 완료" : "입찰 완료"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-lg font-bold text-zinc-100">
            {message}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            제출한 입찰은 이번 라운드에서 변경할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}

      {step === "pickJob" && (
        <div className="space-y-3">
          <p className="text-base text-zinc-400">
            어떤 직업에 베팅하시겠습니까? <br /> (한 라운드에 하나의 직업만
            선택할 수 있습니다.)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {JOBS.map((job) => (
              <button
                key={job.id}
                type="button"
                className="flex flex-col items-center justify-between rounded-xl bg-zinc-900 px-3 py-3 text-xs hover:bg-zinc-800"
                onClick={() => {
                  setSelectedJobId(job.id);
                  setAmount("");
                  setStep("enterAmount");
                  setError(null);
                }}
              >
                {job.icon && (
                  <div className="relative h-40 w-40 overflow-hidden rounded-full bg-zinc-800 md:h-40 md:w-40">
                    <Image
                      src={job.icon}
                      alt={job.label}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="pt-1">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-red-500/60 bg-zinc-950 px-3 py-2 text-lg text-red-300 hover:bg-red-500/10"
              onClick={() => {
                setSelectedJobId("give_up");
                setError(null);
                setStep("confirmGiveUp");
              }}
            >
              <span>베팅 포기</span>
            </button>
          </div>
        </div>
      )}

      {step === "enterAmount" &&
        selectedJobId &&
        selectedJobId !== "give_up" && (
          <div className="space-y-3">
            <p className="text-base text-zinc-400">
              {currentJobLabel} 직업에 얼마나 베팅하시겠습니까? <br /> (최소
              1원)
            </p>
            {playerCash != null && (
              <p className="text-sm text-zinc-500">
                현재 보유 현금:{" "}
                <span className="font-semibold text-amber-300">
                  {playerCash} 코인
                </span>
              </p>
            )}
            <input
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="베팅 금액"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="h-12 flex-1 rounded-full bg-zinc-800 text-base font-semibold text-zinc-100 hover:bg-zinc-700"
                type="button"
                onClick={() => {
                  setStep("pickJob");
                  setSelectedJobId(null);
                  setAmount("");
                }}
              >
                취소
              </button>
              <button
                className="h-12 flex-1 rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                type="button"
                onClick={handleSubmitBet}
                disabled={submitting}
              >
                {submitting ? "제출 중..." : "베팅 제출"}
              </button>
            </div>
          </div>
        )}

      {step === "confirmGiveUp" && (
        <div className="space-y-3">
          <p className="text-base text-zinc-400">
            정말 이번 라운드에서 직업 경매 베팅을 포기하시겠습니까?
          </p>
          <div className="flex gap-2">
            <button
              className="h-10 flex-1 rounded-full bg-zinc-800 text-base font-semibold text-zinc-100 hover:bg-zinc-700"
              type="button"
              onClick={() => {
                setStep("pickJob");
                setSelectedJobId(null);
              }}
            >
              취소
            </button>
            <button
              className="h-10 flex-1 rounded-full bg-red-500 text-base font-semibold text-zinc-950 hover:bg-red-400 disabled:opacity-40"
              type="button"
              onClick={handleSubmitGiveUp}
              disabled={submitting}
            >
              {submitting ? "제출 중..." : "베팅 포기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
