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
        <h1 className="text-2xl font-semibold">
          부엉경찰청 공개수배범 제보 페이지
        </h1>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-3">
        {error && <ErrorMessage message={error} />}

        <div className="flex flex-col gap-1 text-sm">
          <label className="text-base text-zinc-300">
            성함(닉네임)을 입력해주세요.
          </label>
          <textarea
            className="h-16 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label className="text-base text-zinc-300">
            수배범의 인상착의와 목격 장소를 설명 부탁드립니다.
          </label>
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
