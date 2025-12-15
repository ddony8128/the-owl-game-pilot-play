"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function ReportPage() {
  const { nickname, isLoading } = usePlayerAuth();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) return <LoadingScreen />;

  const handleSubmit = async () => {
    if (name.trim().length < 2 || content.trim().length < 2) {
      setError("닉네임과 내용을 2글자 이상 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/subway/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname,
          name: name.trim(),
          content: content.trim(),
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ??
            "신고 처리 중 오류가 발생했습니다. GM에게 문의해 주세요."
        );
      }

      setSubmitted(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "신고 처리 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
        <h1 className="mb-2 text-lg font-semibold">신고가 접수되었습니다</h1>
        <p className="max-w-xs text-sm text-zinc-400">
          GM이 내용을 확인할 때까지 이 화면을 유지해 주세요.
          <br />
          승인 또는 기각은 현장에서 GM이 안내합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold">이상교통 수배범 신고</h1>
        <p className="mt-1 text-xs text-zinc-400">
          수상한 사람을 목격했다면 아래에 신고해 주세요.
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-3">
        {error && <ErrorMessage message={error} />}

        <div className="flex flex-col gap-1 text-sm">
          <label className="text-xs text-zinc-300">당신의 닉네임</label>
          <textarea
            className="h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label className="text-xs text-zinc-300">신고 내용</label>
          <textarea
            className="h-32 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <button
          className="mt-2 h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "제출 중..." : "신고 제출"}
        </button>
      </main>
    </div>
  );
}
