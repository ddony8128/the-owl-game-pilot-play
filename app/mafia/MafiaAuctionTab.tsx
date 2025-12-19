"use client";

import { useState } from "react";
import Image from "next/image";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
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
  myAuctionBet: {
    job: string | null;
    amount: number | null;
    give_up: boolean;
  } | null;
  playerCash: number | null;
};

export function MafiaAuctionTab({ myAuctionBet, playerCash }: Props) {
  const [step, setStep] = useState<Step>("pickJob");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { player } = usePlayerAuth();

  const handleSubmitBet = async () => {
    if (!player?.nickname) return;
    if (!selectedJobId) return;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("양수를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
      setError(message);
      setSubmitting(false);
      return;
    }

    // 서버 반영/폴링이 따라올 시간을 조금 준다 (체감상 깜빡임 완화)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSubmitting(false);
    const jobLabel =
      JOBS.find((j) => j.id === selectedJobId)?.label ?? "선택한 직업";
    setInfo(`${jobLabel} 직업에 ${value}원을 베팅했습니다.`);
    setAmount("");
    setSelectedJobId(null);
    setStep("pickJob");
  };

  const handleSubmitGiveUp = async () => {
    if (!player?.nickname) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
      setError(message);
      setSubmitting(false);
      return;
    }

    // 서버 반영/폴링이 따라올 시간을 조금 준다
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSubmitting(false);
    setInfo("이번 라운드 직업 경매에서 베팅을 포기했습니다.");
    setSelectedJobId(null);
    setAmount("");
    setStep("pickJob");
  };

  const currentJobLabel =
    (selectedJobId && JOBS.find((j) => j.id === selectedJobId)?.label) ?? "";

  // 이미 서버에 기록된 베팅이 있다면, 해당 요약만 보여주고 재베팅은 막는다.
  if (myAuctionBet) {
    const chosenLabel =
      myAuctionBet.job && JOBS.find((j) => j.id === myAuctionBet.job)?.label;

    const message = myAuctionBet.give_up
      ? "이번 라운드 직업 경매에서 베팅을 포기했습니다."
      : `${chosenLabel ?? myAuctionBet.job ?? "선택한 직업"} 직업에 ${
          myAuctionBet.amount ?? 0
        }원을 베팅했습니다.`;

    return (
      <div className="space-y-3 text-sm text-zinc-100">
        {error && <ErrorMessage message={error} />}
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-base text-emerald-300 whitespace-pre-wrap">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      {info && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {info}
        </p>
      )}

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
