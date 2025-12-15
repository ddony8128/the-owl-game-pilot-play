"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { useGameState } from "@/lib/hooks/useGameState";
import { HiddenPieceModal } from "@/components/HiddenPieceModal";

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
      <header className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">The Owl Game</h1>
            <p className="text-xs text-zinc-400">Pilot Program</p>
          </div>
          {player && (
            <div className="text-right text-xs text-zinc-300">
              <div>{player.nickname}</div>
              <button
                className="mt-1 text-[10px] text-zinc-500 underline"
                onClick={clearNickname}
              >
                닉네임 변경
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-6">
          {/* 태양 */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-24 w-24 rounded-full bg-linear-to-br from-amber-300 to-amber-500 shadow-[0_0_40px_rgba(251,191,36,0.6)]" />
            <input
              type="range"
              min={0}
              max={100}
              value={sunLevel}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSunLevel(value);
                if (value === 0 && owlLeftWing && owlRightWing) {
                  setShowHiddenPiece(true);
                }
              }}
              className="w-40"
            />
            <span className="text-xs text-zinc-400">태양 밝기: {sunLevel}</span>
          </div>

          {/* 부엉이 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-zinc-800">
              <div
                className={`absolute left-4 top-10 h-6 w-8 cursor-pointer rounded-full bg-zinc-700 transition-transform ${
                  owlLeftWing ? "-rotate-12 -translate-y-2" : "rotate-6"
                }`}
                onClick={() =>
                  setOwlLeftWing((v) => {
                    const next = !v;
                    if (sunLevel === 0 && next && owlRightWing) {
                      setShowHiddenPiece(true);
                    }
                    return next;
                  })
                }
              />
              <div className="h-16 w-16 rounded-full bg-zinc-600" />
              <div
                className={`absolute right-4 top-10 h-6 w-8 cursor-pointer rounded-full bg-zinc-700 transition-transform ${
                  owlRightWing ? "rotate-12 -translate-y-2" : "-rotate-6"
                }`}
                onClick={() =>
                  setOwlRightWing((v) => {
                    const next = !v;
                    if (sunLevel === 0 && owlLeftWing && next) {
                      setShowHiddenPiece(true);
                    }
                    return next;
                  })
                }
              />
            </div>
            <p className="text-xs text-zinc-400">
              부엉이 날개를 톡톡 눌러 보세요.
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-md flex-col gap-3">
          <button
            className="h-11 rounded-full border border-zinc-700 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
            onClick={() => router.push("/rules")}
          >
            규칙 보기
          </button>
          <button
            className="h-11 rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
            onClick={handleMainAction}
            disabled={!activeGame}
          >
            {activeGame === "subway" && "이상교통 8번출구 시작"}
            {activeGame === "mafia_tutorial" && "자본주의 마피아 튜토리얼"}
            {activeGame === "mafia" && "자본주의 마피아 입장"}
            {activeGame === "vote" && "투표하러 가기"}
            {activeGame === "quiz" && "부엉퀴즈쇼 입장"}
            {!activeGame && "곧 시작됩니다"}
          </button>
        </div>
      </main>

      {/* 닉네임 모달 */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-950 p-6 text-zinc-50 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">닉네임 확인</h2>
            <p className="mb-4 text-xs text-zinc-300">
              GM이 미리 등록한 닉네임만 입장할 수 있습니다.
            </p>
            <input
              className="mb-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="닉네임을 입력하세요"
              value={inputNickname}
              onChange={(e) => setInputNickname(e.target.value)}
            />
            {nicknameError && (
              <p className="mb-2 text-xs text-red-400">{nicknameError}</p>
            )}
            <button
              className="mt-2 h-10 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
              onClick={handleNicknameSubmit}
              disabled={checkingNickname}
            >
              {checkingNickname ? "확인 중..." : "입장하기"}
            </button>
          </div>
        </div>
      )}

      <HiddenPieceModal
        open={showHiddenPiece}
        onClose={() => setShowHiddenPiece(false)}
        onResetIntro={resetIntroState}
      />
    </div>
  );
}
