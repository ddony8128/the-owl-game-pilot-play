"use client";

import { useEffect, useState } from "react";
import type { QuizQuestion } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function DashboardQuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gm/quiz/questions");
        const json = (await res.json().catch(() => null)) as
          | { questions: QuizQuestion[]; error?: undefined }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "퀴즈 문제를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setQuestions(json.questions ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "퀴즈 문제를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateQuestion = async (
    id: number,
    patch: Partial<Pick<QuizQuestion, "question" | "is_open">>
  ) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/quiz/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...patch }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "문제를 업데이트하지 못했습니다.");
      }
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "문제를 업데이트하지 못했습니다.";
      setError(message);
    }
  };

  const openQuestion = async (id: number) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/quiz/open-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "현재 문제를 설정하지 못했습니다.");
      }
      setQuestions((prev) =>
        prev.map((q) => ({ ...q, is_open: q.id === id ? true : false }))
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "현재 문제를 설정하지 못했습니다.";
      setError(message);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <h2 className="text-base font-semibold">퀴즈 문제 관리</h2>
      <div className="space-y-4 text-xs">
        {questions
          .filter((q) => [7, 8, 9, 11, 12].includes(q.id))
          .map((q) => (
            <div key={q.id} className="rounded-lg bg-zinc-900 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">문제 {q.id}</span>
                <label className="flex items-center gap-1 text-[11px] text-zinc-300">
                  <input
                    type="checkbox"
                    checked={q.is_open}
                    onChange={() => openQuestion(q.id)}
                  />
                  <span>공개</span>
                </label>
              </div>
              <textarea
                className="mt-1 h-20 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs outline-none focus:border-zinc-400"
                value={q.question}
                onChange={(e) =>
                  updateQuestion(q.id, { question: e.target.value })
                }
              />
            </div>
          ))}
        {questions.length === 0 && (
          <p className="text-zinc-400">대상 문제가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
