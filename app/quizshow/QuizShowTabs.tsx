"use client";

import type { QuizQuestion } from "@/lib/types";
import { TabLayout, type TabKey } from "@/components/TabLayout";
import { useEffect, useState } from "react";

export function QuizShowTabs(props: {
  currentQuestion: QuizQuestion | null;
  answer: string;
  setAnswer: (value: string) => void;
  usedChance: string | null;
  setUsedChance: (value: string | null) => void;
  chances: { peek: boolean; bet: boolean; safe: boolean };
  submitting: boolean;
  waitingNext: boolean;
  nickname: string;
  isFinalist: boolean;
  onSubmit: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("rules");

  const tabs = [
    { key: "rules", label: "규칙" },
    { key: "questions", label: "문제" },
    { key: "submit", label: "제출" },
  ];

  return (
    <TabLayout tabs={tabs} activeKey={activeTab} onChange={setActiveTab}>
      {activeTab === "rules" && <QuizRulesTab />}
      {activeTab === "questions" && <QuizQuestionsTab />}
      {activeTab === "submit" &&
        (props.isFinalist ? (
          <QuizSubmitTab key={props.currentQuestion?.id ?? "none"} {...props} />
        ) : (
          <QuizSpectateTab currentQuestion={props.currentQuestion} />
        ))}
    </TabLayout>
  );
}

export function QuizRulesTab() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
      <p>
        부엉퀴즈쇼는 총 12문제로 진행되며, 가장 높은 점수를 얻은 1명이
        우승합니다. 동점자가 있을 경우, 더 많은 문제를 맞힌 사람이 우선입니다.
        그래도 동점이면 두 번째 게임의 점수를 기준으로 합니다.
      </p>

      <ul className="list-disc pl-4">
        <li>정답이면 +100점, 오답이면 -100점, 무응답이면 0점입니다.</li>
        <li>
          점수를 잃지 않고 연속으로 정답을 맞히면 매 정답마다 추가 +50점
          보너스를 받습니다. 예를 들어, 정답-무응답-정답-무응답-정답의 경우
          순서대로 +100점, 0점, +150점, 0점, +200점을 얻습니다.
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
          베팅 찬스는 해당 문제의 배점을 +100점 올리는 찬스입니다. 틀릴 경우에도
          100점을 더 잃습니다. 플레이어 모두에게 적용되며, 여러 명이 동시에 쓰면
          중첩됩니다.
        </li>
        <li>
          무산 찬스는 그 문제를 틀리더라도 0점 처리되며, 연속 정답 보너스도
          끊기지 않습니다.
        </li>
      </ul>
    </div>
  );
}

type QuizQuestionSummary = {
  id: number;
  question: string;
};

function QuizQuestionsTab() {
  const [questions, setQuestions] = useState<QuizQuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/quiz/questions-list");
        const json = (await res.json().catch(() => null)) as
          | { questions: QuizQuestionSummary[]; error?: undefined }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "퀴즈 문제 목록을 불러오지 못했습니다."
          );
        }

        if (cancelled) return;
        setQuestions(json.questions ?? []);
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e instanceof Error
            ? e.message
            : "퀴즈 문제 목록을 불러오지 못했습니다.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
        퀴즈 문제를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 text-sm text-zinc-100">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {questions.length === 0 && !error && (
        <p className="text-xs text-zinc-400">표시할 퀴즈 문제가 없습니다.</p>
      )}

      <div className="space-y-3">
        {questions.map((q) => (
          <div
            key={q.id}
            className="rounded-lg bg-zinc-900 px-4 py-4 text-xs text-zinc-100"
          >
            <p className="text-base font-semibold text-amber-300">Q{q.id}</p>
            <p className="mt-2 whitespace-pre-wrap text-base">{q.question}</p>
          </div>
        ))}
      </div>
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
  nickname: string;
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
  nickname,
  onSubmit,
}: QuizSubmitProps) {
  const questionId = currentQuestion?.id ?? null;
  const [step, setStep] = useState<"answer" | "chance">("answer");
  const [peekAnswers, setPeekAnswers] = useState<
    { nickname: string; answer: string }[] | null
  >(null);
  const [peekError, setPeekError] = useState<string | null>(null);
  const [canReopen, setCanReopen] = useState(false);

  // 문제가 바뀌면 컨닝 관련 상태 초기화
  useEffect(() => {
    setStep("answer");
    setPeekAnswers(null);
    setPeekError(null);
    setCanReopen(false);
  }, [questionId]);

  // 컨닝을 사용한 플레이어가 모든 다른 컨닝 사용자들의 확정을 기다리는 폴링
  useEffect(() => {
    if (!waitingNext) return;
    if (!questionId) return;
    if (usedChance !== "peek") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/quiz/peek-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nickname,
            question_id: questionId,
          }),
        });
        const json = (await res.json().catch(() => null)) as
          | { is_peek_user: boolean; all_others_answered: boolean }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          return;
        }

        if (cancelled) return;

        if (json.is_peek_user && json.all_others_answered) {
          setCanReopen(true);
        }
      } catch {
        // 폴링 에러는 무시
      }
    };

    void poll();
    const id = setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waitingNext, usedChance, nickname, questionId]);

  // 컨닝 확정 후(대기 화면) 다른 사람들의 답안을 주기적으로 갱신
  useEffect(() => {
    if (!waitingNext) return;
    if (!questionId) return;
    if (usedChance !== "peek") return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/quiz/peek-answers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nickname,
            question_id: questionId,
          }),
        });
        const json = (await res.json().catch(() => null)) as
          | { answers: { nickname: string; answer: string }[] }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          return;
        }

        if (cancelled) return;
        setPeekAnswers(json.answers ?? []);
      } catch {
        // 에러는 조용히 무시
      }
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waitingNext, usedChance, nickname, questionId]);

  if (waitingNext) {
    const isPeekFlow = usedChance === "peek";
    const showReopenButton = isPeekFlow && canReopen;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-base text-zinc-200">
        <div>
          <p>{isPeekFlow ? "슬쩍 컨닝하는 중..." : "답안을 제출했습니다."}</p>
        </div>

        {isPeekFlow && (
          <div className="w-full max-w-md space-y-2 text-xs text-zinc-200">
            {(!peekAnswers || peekAnswers.length === 0) && (
              <p className="text-[11px] text-zinc-400">
                다른 플레이어의 답안을 불러오는 중입니다...
              </p>
            )}
            {peekError && (
              <p className="text-[11px] text-red-400">{peekError}</p>
            )}
            {peekAnswers && peekAnswers.length > 0 && (
              <div className="rounded-lg bg-zinc-900 p-2">
                <p className="mb-1 text-[12px] font-semibold text-zinc-100">
                  다른 플레이어들의 답
                </p>
                <ul className="space-y-1">
                  {peekAnswers.map((a, idx) => (
                    <li
                      key={idx}
                      className="flex flex-col rounded bg-zinc-950 px-2 py-1"
                    >
                      <span className="text-[11px] font-semibold text-amber-300">
                        {a.nickname}
                      </span>
                      <span className="mt-1 text-[11px] wrap-break-word">
                        {a.answer && a.answer.length > 0
                          ? a.answer
                          : "(무응답)"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {showReopenButton && (
          <button
            type="button"
            className="mt-2 h-10 rounded-full border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
            onClick={async () => {
              if (!questionId) return;
              setPeekError(null);
              try {
                const res = await fetch("/api/quiz/reset-answer", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    nickname,
                    question_id: questionId,
                  }),
                });
                const json = (await res.json().catch(() => null)) as
                  | { ok: true }
                  | { error: string }
                  | null;

                if (!res.ok || !json || "error" in json) {
                  throw new Error(
                    (json as { error?: string })?.error ??
                      "다시 답변하기를 시작하지 못했습니다."
                  );
                }

                setStep("answer");
                setPeekAnswers(null);
                setCanReopen(false);
                setUsedChance(null);
              } catch (e: unknown) {
                const message =
                  e instanceof Error
                    ? e.message
                    : "다시 답변하기를 시작하지 못했습니다.";
                setPeekError(message);
              }
            }}
          >
            다시 답변하기
          </button>
        )}
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-base text-zinc-200">
        <p>현재 풀이할 수 있는 문제가 없습니다.</p>
      </div>
    );
  }

  const options = Array.isArray(currentQuestion.options)
    ? (currentQuestion.options as string[])
    : null;

  const handleTogglePeek = () => {
    // 이미 선택된 상태면 단순 해제 (UI 상 토글만)
    if (usedChance === "peek") {
      setUsedChance(null);
      setPeekAnswers(null);
      setPeekError(null);
      return;
    }

    // 찬스가 이미 소진되었으면 아무 것도 하지 않음
    if (!chances.peek) return;

    setUsedChance("peek");
    setPeekError(null);
  };

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
    <div className="flex h-full flex-col gap-4 text-sm text-zinc-100">
      <div className="rounded-xl bg-zinc-900 p-3">
        <p className="text-base text-zinc-400">문제 {currentQuestion.id}</p>
        <p className="mt-2 text-base text-zinc-100">
          {currentQuestion.question}
        </p>
        {options && options.length > 0 && (
          <div className="mt-3 space-y-2">
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className={`flex w-full items-center justify-start rounded-lg border px-3 py-2 text-sm ${
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
              <label className="text-sm text-zinc-300">답안</label>
              <textarea
                className="h-32 w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>
          )}
          <div className="mt-2 flex flex-col gap-2 text-base text-zinc-400">
            <div className="flex gap-2">
              <button
                className="h-12 flex-1 rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                type="button"
                onClick={handleSubmitAnswer}
                disabled={submitting}
              >
                {submitting ? "제출 중..." : "답안 제출"}
              </button>
              <button
                className="h-12 flex-1 rounded-full border border-zinc-700 bg-zinc-900 text-base font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
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
          <div className="space-y-2 text-sm text-zinc-200">
            <p>이 문제에 사용할 찬스를 선택해 주세요.</p>
            <div className="flex gap-2">
              <ChanceChip
                label="컨닝"
                active={usedChance === "peek"}
                disabled={!chances.peek}
                onClick={handleTogglePeek}
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
            className="mt-2 h-12 w-full rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
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
      className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
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

type QuizSpectateProps = {
  currentQuestion: QuizQuestion | null;
};

function QuizSpectateTab({ currentQuestion }: QuizSpectateProps) {
  const questionId = currentQuestion?.id ?? null;
  const [answers, setAnswers] = useState<
    { nickname: string; answer: string | null }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!questionId) {
      setAnswers([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const params = new URLSearchParams({
          question_id: String(questionId),
        });
        const res = await fetch(`/api/quiz/live-answers?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | { answers: { nickname: string; answer: string | null }[] }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ?? "답안을 불러오지 못했습니다."
          );
        }

        if (cancelled) return;
        setAnswers(json.answers ?? []);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "답안을 불러오지 못했습니다.";
        setError(message);
      }
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [questionId]);

  if (!currentQuestion) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-200">
        <p>현재 풀이할 수 있는 문제가 없습니다.</p>
        <p className="text-xs text-zinc-400">
          결승 진출자들이 문제를 푸는 동안 관전 모드로 대기 중입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 text-sm text-zinc-100">
      <div className="rounded-xl bg-zinc-900 p-3">
        <p className="text-sm text-zinc-400">문제 {currentQuestion.id}</p>
        <p className="mt-2 text-base text-zinc-100">
          {currentQuestion.question}
        </p>
      </div>

      <div className="space-y-2 text-sm text-zinc-200">
        <p className="text-sm text-zinc-400">
          결승 진출자들이 어떤 답을 제출하고 있는지 실시간으로 보여준다부엉!
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {answers.length === 0 && !error && (
          <p className="text-sm text-zinc-400">아직 제출된 답이 없습니다.</p>
        )}
        <ul className="space-y-2">
          {answers.map((a, idx) => (
            <li
              key={idx}
              className="flex flex-col rounded-lg bg-zinc-900 px-3 py-2"
            >
              <span className="text-sm font-semibold text-amber-300">
                {a.nickname}
              </span>
              <span className="mt-1 whitespace-pre-wrap text-sm">
                {a.answer ?? "(무응답)"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
