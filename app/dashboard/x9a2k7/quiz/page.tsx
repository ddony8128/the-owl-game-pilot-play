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
    patch: Partial<
      Pick<QuizQuestion, "question" | "is_open" | "options" | "correct_answer">
    >
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
        <section className="rounded-lg bg-zinc-900 p-3">
          <h3 className="mb-2 text-xs font-semibold text-zinc-300">
            공개 상태 설정 (전체 1~12문항)
          </h3>
          <p className="mb-2 text-[11px] text-zinc-400">
            현재 공개할 문제를 선택하거나, 대기 상태(모든 문제 비공개)로 전환할
            수 있습니다.
          </p>
          <select
            className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs outline-none focus:border-zinc-400"
            value={questions.find((q) => q.is_open)?.id ?? 0}
            onChange={async (e) => {
              const value = Number(e.target.value);
              if (!Number.isFinite(value)) return;
              if (value === 0) {
                // 대기 상태
                setError(null);
                try {
                  const res = await fetch("/api/gm/quiz/open-question", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: null }),
                  });
                  const json = (await res.json().catch(() => null)) as {
                    ok?: true;
                    error?: string;
                  } | null;
                  if (!res.ok || !json?.ok) {
                    throw new Error(
                      json?.error ?? "대기 상태로 전환하지 못했습니다."
                    );
                  }
                  setQuestions((prev) =>
                    prev.map((q) => ({ ...q, is_open: false }))
                  );
                } catch (err: unknown) {
                  const message =
                    err instanceof Error
                      ? err.message
                      : "대기 상태로 전환하지 못했습니다.";
                  setError(message);
                }
              } else {
                await openQuestion(value);
              }
            }}
          >
            <option value={0}>대기 상태 (모든 문제 비공개)</option>
            {Array.from({ length: 12 }, (_, idx) => idx + 1).map((id) => (
              <option key={id} value={id}>
                문제 {id}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-300">
            가변 문제 내용 편집 (7, 8, 9, 11, 12번)
          </h3>
          {questions
            .filter((q) => [7, 8, 9, 11, 12].includes(q.id))
            .map((q) => (
              <div key={q.id} className="rounded-lg bg-zinc-900 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">문제 {q.id}</span>
                  <span className="text-[11px] text-zinc-400">
                    현재 상태: {q.is_open ? "공개" : "비공개"}
                  </span>
                </div>
                <label className="block text-[11px] text-zinc-400">
                  문제 텍스트
                </label>
                <textarea
                  className="mt-1 h-20 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs outline-none focus:border-zinc-400"
                  value={q.question}
                  onChange={(e) =>
                    updateQuestion(q.id, { question: e.target.value })
                  }
                />
                <label className="mt-3 block text-[11px] text-zinc-400">
                  보기 (줄바꿈으로 구분, 비워두면 주관식)
                </label>
                <textarea
                  className="mt-1 h-20 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs outline-none focus:border-zinc-400"
                  value={
                    Array.isArray(q.options)
                      ? (q.options as string[]).join("\n")
                      : ""
                  }
                  onChange={(e) =>
                    updateQuestion(q.id, { options: e.target.value })
                  }
                />
                <label className="mt-3 block text-[11px] text-zinc-400">
                  정답 (선택형인 경우 보기 텍스트와 동일하게 입력)
                </label>
                <input
                  className="mt-1 h-8 w-full rounded border border-zinc-700 bg-zinc-950 px-2 text-xs outline-none focus:border-zinc-400"
                  value={q.correct_answer ?? ""}
                  onChange={(e) =>
                    updateQuestion(q.id, { correct_answer: e.target.value })
                  }
                />
              </div>
            ))}
          {questions.length === 0 && (
            <p className="text-zinc-400">대상 문제가 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}
