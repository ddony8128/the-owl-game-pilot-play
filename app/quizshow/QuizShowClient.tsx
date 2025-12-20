"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { QuizPlayer, QuizQuestion, QuizEvent } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { QuizShowHeader } from "./QuizShowHeader";
import { QuizShowTabs } from "./QuizShowTabs";

export default function QuizShowClient() {
  return (
    <PageGuard requireLogin allowGames={["quiz"]}>
      <QuizInner />
    </PageGuard>
  );
}

function QuizInner() {
  const { player } = usePlayerAuth();
  const [quizPlayer, setQuizPlayer] = useState<QuizPlayer | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [usedChance, setUsedChance] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitingNext, setWaitingNext] = useState(false);
  const [liveScores, setLiveScores] = useState<
    {
      nickname: string;
      score: number;
      chances: { peek: boolean; bet: boolean; safe: boolean };
      streak: number;
    }[]
  >([]);
  const [liveScoresError, setLiveScoresError] = useState<string | null>(null);

  const lastQuestionIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!player?.nickname) return;
    let cancelled = false;

    const load = async (nickname: string) => {
      try {
        const params = new URLSearchParams({ nickname });
        const res = await fetch(`/api/quiz/state?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | {
              player: QuizPlayer | null;
              openQuestions: QuizQuestion[];
              events: QuizEvent[];
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

        const openQuestions = json.openQuestions ?? [];
        const nextQuestion = openQuestions[0] ?? null;

        // 문제가 바뀌면 로컬 상태 초기화
        const prevId = lastQuestionIdRef.current;
        const nextId = nextQuestion?.id ?? null;
        if (prevId !== nextId) {
          lastQuestionIdRef.current = nextId;
          setAnswer("");
          setUsedChance(null);
          setWaitingNext(false);
        }

        setCurrentQuestion(nextQuestion);
        const evts = json.events ?? [];

        // 현재 열린 문제에 대해 이미 답변/무응답 이벤트가 있으면 대기 화면으로 전환
        if (nextQuestion) {
          const hasAnswered = evts.some(
            (e) =>
              e.question_id === nextQuestion.id &&
              (e.event_type === "answer_submitted" || e.event_type === "skip")
          );
          setWaitingNext(hasAnswered);
        } else {
          setWaitingNext(false);
        }

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
    const intervalId = setInterval(() => {
      void load(player.nickname);
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [player?.nickname]);

  // 관전자 모드에서 결승자 점수 실시간 폴링
  useEffect(() => {
    if (!player) return;
    const isFinalist = !!player.is_finalist;
    if (isFinalist) return;

    let cancelled = false;

    const loadScores = async () => {
      try {
        const res = await fetch("/api/quiz/live-scores");
        const json = (await res.json().catch(() => null)) as
          | {
              players: {
                nickname: string;
                score: number;
                chances: { peek: boolean; bet: boolean; safe: boolean };
                streak: number;
              }[];
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "점수 정보를 불러오지 못했습니다."
          );
        }

        if (cancelled) return;
        setLiveScores(json.players ?? []);
        setLiveScoresError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "점수 정보를 불러오지 못했습니다.";
        setLiveScoresError(message);
      }
    };

    void loadScores();
    const id = setInterval(() => {
      void loadScores();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [player]);

  const chances = useMemo(() => {
    type Chances = { peek?: boolean; bet?: boolean; safe?: boolean };
    const raw = quizPlayer?.chances as Chances | null | undefined;
    return {
      peek: raw?.peek ?? true,
      bet: raw?.bet ?? true,
      safe: raw?.safe ?? true,
    };
  }, [quizPlayer?.chances]);

  const handleSubmit = async () => {
    if (!player?.nickname || !currentQuestion) return;

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
          answer: answer.trim() || null,
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

  const score = quizPlayer?.score ?? 0;
  const nickname = player.nickname;
  const isFinalist = !!player.is_finalist;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      {isFinalist ? null : (
        <div className="mb-2 flex w-full max-w-md flex-col items-center gap-1 text-center">
          <p className="text-xl font-semibold text-emerald-300">
            관전자를 위한 페이지다부엉!
          </p>
          {liveScoresError && (
            <p className="text-[11px] text-red-400">{liveScoresError}</p>
          )}
        </div>
      )}
      <QuizShowHeader
        mode={isFinalist ? "finalist" : "spectator"}
        score={score}
        chances={chances}
        liveScores={liveScores}
      />

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <QuizShowTabs
          currentQuestion={currentQuestion}
          answer={answer}
          setAnswer={setAnswer}
          usedChance={usedChance}
          setUsedChance={setUsedChance}
          chances={chances}
          submitting={submitting}
          waitingNext={waitingNext}
          nickname={nickname}
          isFinalist={isFinalist}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
