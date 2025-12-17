"use client";

import { ErrorMessage } from "@/components/ErrorMessage";

type Props = {
  name: string;
  content: string;
  submitting: boolean;
  error: string | null;
  onChangeName: (value: string) => void;
  onChangeContent: (value: string) => void;
  onSubmit: () => void;
};

export function ReportForm({
  name,
  content,
  submitting,
  error,
  onChangeName,
  onChangeContent,
  onSubmit,
}: Props) {
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
            onChange={(e) => onChangeName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label className="text-xs text-zinc-300">신고 내용</label>
          <textarea
            className="h-32 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
            value={content}
            onChange={(e) => onChangeContent(e.target.value)}
          />
        </div>

        <button
          className="mt-2 h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "제출 중..." : "신고 제출"}
        </button>
      </main>
    </div>
  );
}
