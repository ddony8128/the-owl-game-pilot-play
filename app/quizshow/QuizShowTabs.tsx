"use client";

import type { QuizQuestion } from "@/lib/types";
import { TabLayout, type TabKey } from "@/components/TabLayout";
import { useState } from "react";

export function QuizShowTabs(props: {
  currentQuestion: QuizQuestion | null;
  answer: string;
  setAnswer: (value: string) => void;
  usedChance: string | null;
  setUsedChance: (value: string | null) => void;
  chances: { peek: boolean; bet: boolean; safe: boolean };
  submitting: boolean;
  waitingNext: boolean;
  onSubmit: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("rules");

  const tabs = [
    { key: "rules", label: "규칙" },
    { key: "submit", label: "제출" },
  ];

  return (
    <TabLayout tabs={tabs} activeKey={activeTab} onChange={setActiveTab}>
      {activeTab === "rules" && <QuizRulesTab />}
      {activeTab === "submit" && (
        <QuizSubmitTab key={props.currentQuestion?.id ?? "none"} {...props} />
      )}
    </TabLayout>
  );
}

export function QuizRulesTab() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-200">
      <p>
        부엉퀴즈쇼는 총 12문제로 진행되며, 가장 높은 점수를 얻은 사람이
        우승합니다.
      </p>
      <p>
        이 화면에서는 점수와 찬스 사용 여부를 확인하고, 각 문제에 대한 답안을
        제출합니다.
      </p>
      <ul className="list-disc pl-4">
        <li>
          각 문제는 정답이면 +100점, 오답이면 -100점, 무응답이면 0점입니다.
        </li>
        <li>
          점수를 잃지 않고 연속으로 정답을 맞히면 매 정답마다 추가 +50점
          보너스를 받습니다.
        </li>
        <li>
          찬스는 컨닝 / 베팅 / 무산 3가지이며, 각 찬스는 게임 전체에서 1번씩만
          사용할 수 있습니다.
        </li>
        <li>
          컨닝 찬스는 다른 플레이어들의 답안을 확인한 뒤 자신의 답을 한 번 더
          바꿀 수 있는 찬스입니다.
        </li>
        <li>
          베팅 찬스는 해당 문제의 배점을 +100점 올리는 찬스입니다. 여러 명이
          동시에 쓰면 누적됩니다.
        </li>
        <li>
          무산 찬스는 그 문제를 틀리더라도 0점 처리되며, 연속 정답 보너스도
          끊기지 않습니다.
        </li>
        <li>
          문제와 문제 사이에는 대기 화면이 나타나며, GM이 다음 문제를 열어 줄 때
          자동으로 다음 문제 화면으로 전환됩니다.
        </li>
      </ul>
    </div>
  );
}

type QuizSubmitProps = {
  currentQuestion: QuizQuestion | null;
  answer: string;
  setAnswer: (value: string) => void;
  usedChance: string | null;
  setUsedChance: (value: string | null) => void;
  chances: { peek: boolean; bet: boolean; safe: boolean };
  submitting: boolean;
  waitingNext: boolean;
  onSubmit: () => void;
};

export function QuizSubmitTab({
  currentQuestion,
  answer,
  setAnswer,
  usedChance,
  setUsedChance,
  chances,
  submitting,
  waitingNext,
  onSubmit,
}: QuizSubmitProps) {
  if (waitingNext) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-200">
        <p>답안을 제출했습니다.</p>
        <p className="mt-2 text-xs text-zinc-400">
          다음 문제가 열릴 때까지 잠시만 기다려 주세요.
        </p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-200">
        <p>현재 풀이할 수 있는 문제가 없습니다.</p>
        <p className="mt-2 text-xs text-zinc-400">
          GM이 다음 문제를 열어 줄 때까지 기다려 주세요.
        </p>
      </div>
    );
  }

  const options = Array.isArray(currentQuestion.options)
    ? (currentQuestion.options as string[])
    : null;

  const [step, setStep] = useState<"answer" | "chance">("answer");

  const handleSubmitAnswer = () => {
    // 답안만 먼저 확정하고, 이후 단계에서 찬스를 선택하도록 분리
    if (!answer.trim() && !options) {
      // 주관식인데 아무 것도 적지 않은 경우
      // (무응답 버튼은 별도로 제공)
      return;
    }
    setStep("chance");
  };

  const handleSkip = () => {
    // 무응답: 답안을 비워 두고 바로 찬스 선택 단계로 이동
    setAnswer("");
    setStep("chance");
  };

  const handleFinalSubmit = () => {
    onSubmit();
  };

  return (
    <div className="flex h-full flex-col gap-3 text-sm text-zinc-100">
      <div className="rounded-xl bg-zinc-900 p-3">
        <p className="text-xs text-zinc-400">문제 {currentQuestion.id}</p>
        <p className="mt-2 text-sm text-zinc-100">{currentQuestion.question}</p>
        {options && options.length > 0 && (
          <div className="mt-3 space-y-2">
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className={`flex w-full items-center justify-start rounded-lg border px-3 py-2 text-xs ${
                  answer === opt
                    ? "border-amber-400 bg-amber-400/10 text-amber-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200"
                }`}
                onClick={() => setAnswer(opt)}
                disabled={step !== "answer"}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {step === "answer" && (
        <>
          {!options && (
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs text-zinc-300">답안</label>
              <textarea
                className="h-32 w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>
          )}
          <div className="mt-2 flex flex-col gap-2 text-[11px] text-zinc-400">
            <p>
              답안을 제출하거나, 이번 문제는 답하지 않고 넘어갈 수 있습니다.
            </p>
            <div className="flex gap-2">
              <button
                className="h-9 flex-1 rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                type="button"
                onClick={handleSubmitAnswer}
                disabled={submitting}
              >
                {submitting ? "제출 중..." : "답안 제출"}
              </button>
              <button
                className="h-9 flex-1 rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
                type="button"
                onClick={handleSkip}
                disabled={submitting}
              >
                이번 문제는 답하지 않기
              </button>
            </div>
          </div>
        </>
      )}

      {step === "chance" && (
        <>
          <div className="space-y-2 text-xs text-zinc-200">
            <p>이 문제에 사용할 찬스를 선택해 주세요. (선택)</p>
            <div className="flex gap-2">
              <ChanceChip
                label="컨닝"
                active={usedChance === "peek"}
                disabled={!chances.peek}
                onClick={() =>
                  setUsedChance(usedChance === "peek" ? null : "peek")
                }
              />
              <ChanceChip
                label="베팅"
                active={usedChance === "bet"}
                disabled={!chances.bet}
                onClick={() =>
                  setUsedChance(usedChance === "bet" ? null : "bet")
                }
              />
              <ChanceChip
                label="무산"
                active={usedChance === "safe"}
                disabled={!chances.safe}
                onClick={() =>
                  setUsedChance(usedChance === "safe" ? null : "safe")
                }
              />
            </div>
          </div>
          <button
            className="mt-2 h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
            type="button"
            onClick={handleFinalSubmit}
            disabled={submitting}
          >
            {submitting ? "제출 중..." : "이대로 확정하기"}
          </button>
        </>
      )}
    </div>
  );
}

type ChanceChipProps = {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function ChanceChip({
  label,
  active,
  disabled,
  onClick,
}: ChanceChipProps) {
  return (
    <button
      type="button"
      className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
        active
          ? "bg-amber-400 text-zinc-950"
          : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
      } ${disabled ? "opacity-40" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
