"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function EntryPage() {
  const router = useRouter();
  const {
    nickname,
    setNickname,
    clearNickname,
    isLoading: authLoading,
  } = usePlayerAuth();

  const [inputNickname, setInputNickname] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 닉네임이 등록되어 있으면 곧바로 8번출구 플레이 화면으로 진입한다.
  useEffect(() => {
    if (!authLoading && nickname) {
      router.replace("/subway");
    }
  }, [authLoading, nickname, router]);

  const handleSubmit = async () => {
    const value = inputNickname.trim();
    if (!value) return;

    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "등록되지 않은 닉네임입니다.");
        clearNickname();
        return;
      }

      setNickname(value);
      router.replace("/subway");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "닉네임 확인 중 오류가 발생했습니다.";
      setError(message);
      clearNickname();
    } finally {
      setChecking(false);
    }
  };

  // 인증 로딩 중이거나, 이미 닉네임이 있어 곧 리다이렉트되는 동안은 로딩 화면을 보여준다.
  if (authLoading || nickname) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900/80 p-6 shadow-xl ring-1 ring-zinc-800/60">
        <h1 className="mb-1 text-2xl font-semibold">이상교통 8번출구</h1>
        <p className="mb-5 text-xs text-zinc-400">
          딜러가 등록한 닉네임을 그대로 입력해주세요.
        </p>

        <input
          className="mb-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="닉네임을 입력하세요"
          value={inputNickname}
          onChange={(e) => setInputNickname(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
          }}
        />

        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

        <button
          className="mt-2 h-11 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={() => void handleSubmit()}
          disabled={checking || !inputNickname.trim()}
        >
          {checking ? "확인 중..." : "입장하기"}
        </button>
      </div>
    </div>
  );
}
