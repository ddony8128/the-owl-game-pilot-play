"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { useGameState } from "@/lib/hooks/useGameState";
import { HiddenPieceModal } from "@/components/HiddenPieceModal";
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
        return;
      }

      setNickname(inputNickname.trim());
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "닉네임 확인 중 오류가 발생했습니다.";
      setNicknameError(message);
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
      case "vote":
        router.push("/vote");
        break;
      case "quiz":
        router.push("/quizshow");
        break;
      default:
        // ready 또는 알 수 없음
        break;
    }
  };

  const resetIntroState = () => {
    setSunLevel(50);
    setOwlLeftWing(false);
    setOwlRightWing(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-linear-to-b from-zinc-950 to-zinc-900 px-4 py-8 text-zinc-50">
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
