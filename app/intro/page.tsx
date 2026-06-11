"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import type { SubwayPlayerStateClient } from "@/lib/types";
import { useGameState } from "@/lib/hooks/useGameState";
import { IntroHeader } from "./IntroHeader";
import { IntroOwlScene } from "./IntroOwlScene";
import { IntroActions } from "./IntroActions";
import { IntroNicknameModal } from "./IntroNicknameModal";

export default function IntroPage() {
  const router = useRouter();
  const {
    nickname,
    player,
    setNickname,
    clearNickname,
    isLoading: authLoading,
  } = usePlayerAuth();
  const { activeGame } = useGameState();

  const [inputNickname, setInputNickname] = useState("");
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const showNicknameModal = !authLoading && !nickname;
  const [hasClearedSubway, setHasClearedSubway] = useState(false);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;

    const loadSubwayState = async () => {
      try {
        const res = await fetch(
          `/api/subway/state?nickname=${encodeURIComponent(nickname)}`
        );
        const json = (await res.json().catch(() => null)) as
          | { state: SubwayPlayerStateClient | null; error?: string }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          return;
        }
        if (cancelled) return;
        const rank = json.state?.finishedRank ?? null;
        setHasClearedSubway(typeof rank === "number");
      } catch {
        // 인트로 진입 시 subway 상태 조회 실패는 치명적이지 않으므로 무시
      }
    };

    void loadSubwayState();
    return () => {
      cancelled = true;
    };
  }, [nickname]);

  const handleNicknameSubmit = async () => {
    if (!inputNickname.trim()) return;

    setCheckingNickname(true);
    setNicknameError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname: inputNickname.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setNicknameError(data?.error ?? "등록되지 않은 닉네임입니다.");
        clearNickname();
        return;
      }

      setNickname(inputNickname.trim());
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "닉네임 확인 중 오류가 발생했습니다.";
      setNicknameError(message);
      clearNickname();
    } finally {
      setCheckingNickname(false);
    }
  };

  const handleMainAction = () => {
    // 1게임(이상교통)만 플레이 가능
    if (activeGame === "subway") {
      router.push("/subway");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between overflow-x-hidden bg-linear-to-b from-sky-600 via-sky-700 to-sky-600 px-4 py-8 text-zinc-50">
      <IntroHeader player={player} onClearNickname={clearNickname} />

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8">
        <IntroOwlScene />

        <IntroActions
          activeGame={activeGame ?? null}
          onOpenRules={() => router.push("/rules")}
          onMainAction={handleMainAction}
          subwayDisabled={hasClearedSubway}
        />
      </main>

      <IntroNicknameModal
        open={showNicknameModal}
        inputNickname={inputNickname}
        setInputNickname={setInputNickname}
        nicknameError={nicknameError}
        checkingNickname={checkingNickname}
        onSubmit={handleNicknameSubmit}
      />
    </div>
  );
}
