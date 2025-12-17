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
      {activeTab === "submit" && <QuizSubmitTab {...props} />}
    </TabLayout>
  );
}

export function QuizRulesTab() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-200">
      <p>부엉퀴즈쇼의 문제는 현장에서 GM이 구두로 안내합니다.</p>
      <p>
        이 화면에서는 점수와 찬스 사용 여부, 그리고 각 문제에 대한 답안을
        제출합니다.
      </p>
      <ul className="list-disc pl-4">
        <li>각 문제마다 답안은 한 번만 제출할 수 있습니다.</li>
        <li>찬스는 문제 당 하나만 선택할 수 있으며, 한 번 쓰면 사라집니다.</li>
        <li>
          문제 사이에는 대기 화면이 나타나며, GM이 다음 문제를 열어 줍니다.
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

  return (
    <div className="flex h-full flex-col gap-3 text-sm text-zinc-100">
      <div className="rounded-xl bg-zinc-900 p-3">
        <p className="text-xs text-zinc-400">문제 {currentQuestion.id}</p>
        <p className="mt-2 text-sm text-zinc-100">{currentQuestion.question}</p>
        {options && options.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-zinc-200">
            {options.map((opt, idx) => (
              <li key={idx}>{opt}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 text-xs text-zinc-200">
        <p>사용할 찬스를 선택해 주세요. (선택)</p>
        <div className="flex gap-2">
          <ChanceChip
            label="Peek"
            active={usedChance === "peek"}
            disabled={!chances.peek}
            onClick={() => setUsedChance(usedChance === "peek" ? null : "peek")}
          />
          <ChanceChip
            label="Bet"
            active={usedChance === "bet"}
            disabled={!chances.bet}
            onClick={() => setUsedChance(usedChance === "bet" ? null : "bet")}
          />
          <ChanceChip
            label="Safe"
            active={usedChance === "safe"}
            disabled={!chances.safe}
            onClick={() => setUsedChance(usedChance === "safe" ? null : "safe")}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <label className="text-xs text-zinc-300">답안</label>
        <textarea
          className="h-32 w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>

      <button
        className="mt-2 h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? "제출 중..." : "답안 제출"}
      </button>
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
