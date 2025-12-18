"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

interface QuizQuestionSummary {
  id: number;
  question: string;
}

export default function QuizQuestionsPage() {
  const router = useRouter();
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md">
        <h1 className="text-lg font-semibold">퀴즈 문제 목록</h1>
        <p className="text-xs text-zinc-400">
          현재 사용 중인 퀴즈 문제들의 번호와 문항입니다. 정답이나 옵션은
          표시되지 않습니다.
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-3 text-sm">
        {error && <ErrorMessage message={error} />}

        {questions.length === 0 && !error && (
          <p className="mt-4 text-xs text-zinc-400">
            표시할 퀴즈 문제가 없습니다.
          </p>
        )}

        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
            >
              <p className="text-[11px] font-semibold text-amber-300">
                Q{q.id}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{q.question}</p>
            </div>
          ))}
        </div>

        <button
          className="mt-auto h-10 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-900"
          onClick={() => router.push("/rules")}
        >
          규칙 목록으로 돌아가기
        </button>
      </main>
    </div>
  );
}
