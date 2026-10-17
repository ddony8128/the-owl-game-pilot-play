"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { RoomGame } from "@/lib/types";

function gamePath(game: RoomGame | null): string | null {
  switch (game) {
    case "mafia":
      return "/mafia";
    case "defense":
      return "/defense";
    default:
      return null;
  }
}

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "현재 운영하지 않는 게임",
};

const GAME_DESCRIPTION: Record<"mafia" | "defense", string> = {
  mafia: "경매 · 주식 거래 · 직업 능력 · 최종 투표",
  defense: "카드 선택 · 전투 · 훈련 · 휴식",
};

export default function EntryPage() {
  const router = useRouter();
  const {
    player,
    roomCode,
    roomGame,
    enterRoom,
    isLoading: authLoading,
    error: authError,
  } = usePlayerAuth();

  const [inputRoom, setInputRoom] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [selectedGame, setSelectedGame] = useState<RoomGame | null>(null);
  // 루트(/)는 자동 이동하지 않는다. 사용자가 '입장' 또는 '이 방으로 계속'을
  // 눌렀을 때(attempted)만, 방+닉네임 검증이 끝나면 해당 게임으로 이동한다.
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!attempted || authLoading) return;
    const path = gamePath(roomGame);
    if (player && path && selectedGame === roomGame) router.replace(path);
  }, [attempted, authLoading, player, roomGame, router, selectedGame]);

  const handleSubmit = () => {
    const room = inputRoom.trim();
    const nick = inputNickname.trim();
    if (!selectedGame || !room || !nick) return;
    setAttempted(true);
    enterRoom(room, nick);
  };

  const handleContinue = () => {
    if (player && roomGame && gamePath(roomGame)) {
      setSelectedGame(roomGame);
      setAttempted(true);
    }
  };

  // 입장/계속 진행 중에만 로딩 화면. 그냥 들어오면 항상 폼이 보인다.
  const gameMismatch =
    attempted && player && selectedGame && roomGame !== selectedGame;

  if (
    attempted &&
    !gameMismatch &&
    (authLoading || (player && gamePath(roomGame)))
  ) {
    return <LoadingScreen />;
  }

  const hasPriorSession = !!player && !!gamePath(roomGame);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-sky-600 via-sky-700 to-sky-600 px-4 text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-950/85 p-6 shadow-xl ring-1 ring-zinc-800/60 backdrop-blur-sm">
        {hasPriorSession && (
          <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-zinc-300">
              이전에 입장한 방{" "}
              <b className="font-mono text-amber-300">{roomCode}</b>
              {roomGame ? ` (${GAME_LABEL[roomGame]})` : ""}
            </p>
            <button
              className="mt-2 h-9 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
              onClick={handleContinue}
            >
              이 방으로 계속하기 →
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              다른 방에 들어가려면 아래에 새 방 코드를 입력하세요.
            </p>
          </div>
        )}

        <h1 className="mb-1 text-xl font-semibold">
          {hasPriorSession ? "다른 게임 입장" : "게임 선택"}
        </h1>
        <p className="mb-5 text-xs text-zinc-400">
          참여할 게임을 먼저 선택하세요.
        </p>

        <div className="mb-5 grid gap-2">
          {(["mafia", "defense"] as const).map((game) => {
            const selected = selectedGame === game;
            return (
              <button
                key={game}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setSelectedGame(game);
                  setAttempted(false);
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-amber-300 bg-amber-400/15 ring-1 ring-amber-300"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                }`}
              >
                <span className="block font-semibold text-zinc-50">
                  {GAME_LABEL[game]}
                </span>
                <span className="mt-1 block text-xs text-zinc-400">
                  {GAME_DESCRIPTION[game]}
                </span>
              </button>
            );
          })}
        </div>

        {selectedGame && (
          <p className="mb-3 text-sm font-semibold text-amber-300">
            {GAME_LABEL[selectedGame]} 입장
          </p>
        )}

        <input
          className="mb-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="방 코드 (예: A3F82)"
          value={inputRoom}
          onChange={(e) => setInputRoom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <input
          className="mb-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="닉네임을 입력하세요"
          value={inputNickname}
          onChange={(e) => setInputNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {attempted && (authError || gameMismatch) && (
          <p className="mb-2 text-xs text-red-400">
            {gameMismatch
              ? `이 방은 ${roomGame ? GAME_LABEL[roomGame] : "다른 게임"} 방입니다. 게임 선택을 확인해 주세요.`
              : authError}
          </p>
        )}

        <button
          className="mt-2 h-11 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={handleSubmit}
          disabled={
            !selectedGame || !inputRoom.trim() || !inputNickname.trim()
          }
        >
          {selectedGame ? `${GAME_LABEL[selectedGame]} 입장하기` : "게임을 선택하세요"}
        </button>
      </div>
    </div>
  );
}
