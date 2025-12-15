"use client";

import { useEffect } from "react";

const ASK_FORM_URL = process.env.NEXT_PUBLIC_ASK_FORM_URL;

export default function AskPage() {
  useEffect(() => {
    if (ASK_FORM_URL) {
      window.location.href = ASK_FORM_URL;
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <h1 className="mb-2 text-lg font-semibold">설문 페이지로 이동 중...</h1>
      {ASK_FORM_URL ? (
        <p className="text-sm text-zinc-400">
          잠시 후 자동으로 이동하지 않으면
          <br />
          <a
            href={ASK_FORM_URL}
            className="mt-1 inline-block text-amber-300 underline"
          >
            이 링크를 눌러 주세요.
          </a>
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          설문 링크가 아직 설정되지 않았습니다. GM에게 문의해 주세요.
        </p>
      )}
    </div>
  );
}
