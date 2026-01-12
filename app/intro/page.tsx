"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import type { SubwayPlayerStateClient } from "@/lib/types";
import { useGameState } from "@/lib/hooks/useGameState";
import { HiddenPieceModal } from "@/app/intro/HiddenPieceModal";
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
  const [sunLevel, setSunLevel] = useState(50);
  const [owlLeftWing, setOwlLeftWing] = useState(false);
  const [owlRightWing, setOwlRightWing] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [showHiddenPiece, setShowHiddenPiece] = useState(false);
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
    switch (activeGame) {
      case "subway":
        router.push("/subway");
        break;
      case "mafia_tutorial":
      case "mafia":
        router.push("/mafia");
        break;
      case "defense":
        router.push("/defense");
        break;
      case "vote":
        router.push("/vote");
        break;
      case "survey":
        window.open("https://forms.gle/wZ6R4PtJvKWC2CD88", "_blank");
        break;
      default:
        break;
    }
  };

  const resetIntroState = () => {
    setSunLevel(65);
    setOwlLeftWing(false);
    setOwlRightWing(false);
  };

  const bright4BgColor = "from-sky-500 via-sky-600 to-sky-500";
  const bright3BgColor = "from-sky-600 via-sky-700 to-sky-600";
  const bright2BgColor = "from-sky-650 via-sky-700 to-sky-650";
  const bright1BgColor = "from-purple-650 via-amber-700 to-purple-650";
  const backgroundClass =
    sunLevel > 75
      ? bright4BgColor
      : sunLevel > 50
      ? bright3BgColor
      : sunLevel > 25
      ? bright2BgColor
      : bright1BgColor;

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-between bg-linear-to-b px-4 py-8 text-zinc-50 ${backgroundClass}`}
    >
      <IntroHeader player={player} onClearNickname={clearNickname} />

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8">
        <IntroOwlScene
          sunLevel={sunLevel}
          setSunLevel={setSunLevel}
          owlLeftWing={owlLeftWing}
          setOwlLeftWing={setOwlLeftWing}
          owlRightWing={owlRightWing}
          setOwlRightWing={setOwlRightWing}
          onRevealHidden={() => setShowHiddenPiece(true)}
        />

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

      <HiddenPieceModal
        open={showHiddenPiece}
        onClose={() => setShowHiddenPiece(false)}
        onResetIntro={resetIntroState}
      />
    </div>
  );
}
