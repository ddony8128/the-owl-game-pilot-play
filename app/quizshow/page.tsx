"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuizPlayer, QuizQuestion, QuizSubmission } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TabLayout, type TabKey } from "@/components/TabLayout";

export default function QuizShowPage() {
  return (
    <PageGuard requireLogin allowGames={["quiz"]} requireFinalist>
      <QuizInner />
    </PageGuard>
  );
}

function QuizInner() {
  const { player } = usePlayerAuth();
  const [quizPlayer, setQuizPlayer] = useState<QuizPlayer | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("rules");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [usedChance, setUsedChance] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitingNext, setWaitingNext] = useState(false);

  useEffect(() => {
    if (!player?.nickname) return;
    let cancelled = false;

    const load = async (nickname: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ nickname });
        const res = await fetch(`/api/quiz/state?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | {
              player: QuizPlayer | null;
              questions: QuizQuestion[];
              submissions: QuizSubmission[];
              error?: undefined;
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "퀴즈 정보를 불러오지 못했습니다."
          );
        }

        if (cancelled) return;

        setQuizPlayer(json.player ?? null);
        setQuestions(json.questions ?? []);
        setSubmissions(json.submissions ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "퀴즈 정보를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load(player.nickname);
    return () => {
      cancelled = true;
    };
  }, [player?.nickname]);

  const chances = useMemo(() => {
    type Chances = { peek?: boolean; bet?: boolean; safe?: boolean };
    const raw = quizPlayer?.chances as Chances | null | undefined;
    return {
      peek: raw?.peek ?? true,
      bet: raw?.bet ?? true,
      safe: raw?.safe ?? true,
    };
  }, [quizPlayer?.chances]);

  const currentQuestion = useMemo(() => {
    const answeredIds = new Set(
      submissions.map((s) => s.question_id).filter((id): id is number => !!id)
    );
    return questions.find((q) => !answeredIds.has(q.id)) ?? null;
  }, [questions, submissions]);

  const handleSubmit = async () => {
    if (!player?.nickname || !currentQuestion) return;
    if (!answer.trim()) {
      setError("답안을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: player.nickname,
          question_id: currentQuestion.id,
          answer: answer.trim(),
          used_chance: usedChance,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "제출 중 오류가 발생했습니다.");
      }

      setWaitingNext(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "제출 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !player) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const tabs = [
    { key: "rules", label: "규칙" },
    { key: "submit", label: "제출" },
  ];

  const score = quizPlayer?.score ?? 0;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <header className="flex w-full max-w-md items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">부엉퀴즈쇼</h1>
          <p className="text-xs text-zinc-400">결승 진출자 전용 퀴즈입니다.</p>
        </div>
        <div className="text-right text-[10px] text-zinc-400">
          <div>점수 {score}</div>
          <div>
            찬스 P/B/S: {chances.peek ? "O" : "X"}/{""}
            {chances.bet ? "O" : "X"}/{""}
            {chances.safe ? "O" : "X"}
          </div>
        </div>
      </header>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabs} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "rules" && <QuizRulesTab />}
          {activeTab === "submit" && (
            <QuizSubmitTab
              currentQuestion={currentQuestion}
              answer={answer}
              setAnswer={setAnswer}
              usedChance={usedChance}
              setUsedChance={setUsedChance}
              chances={chances}
              submitting={submitting}
              waitingNext={waitingNext}
              onSubmit={handleSubmit}
            />
          )}
        </TabLayout>
      </main>
    </div>
  );
}

function QuizRulesTab() {
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

function QuizSubmitTab({
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

function ChanceChip({ label, active, disabled, onClick }: ChanceChipProps) {
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
