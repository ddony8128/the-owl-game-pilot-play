"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuizPlayer, QuizQuestion, QuizSubmission } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { QuizShowHeader } from "./QuizShowHeader";
import { QuizShowTabs } from "./QuizShowTabs";

export default function QuizShowClient() {
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

  const score = quizPlayer?.score ?? 0;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <QuizShowHeader score={score} chances={chances} />

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
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
