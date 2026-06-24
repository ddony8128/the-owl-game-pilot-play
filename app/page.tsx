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
    case "subway":
      return "/subway";
    default:
      return null;
  }
}

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "이상교통",
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
  // 루트(/)는 자동 이동하지 않는다. 사용자가 '입장' 또는 '이 방으로 계속'을
  // 눌렀을 때(attempted)만, 방+닉네임 검증이 끝나면 해당 게임으로 이동한다.
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!attempted || authLoading) return;
    const path = gamePath(roomGame);
    if (player && path) router.replace(path);
  }, [attempted, authLoading, player, roomGame, router]);

  const handleSubmit = () => {
    const room = inputRoom.trim();
    const nick = inputNickname.trim();
    if (!room || !nick) return;
    setAttempted(true);
    enterRoom(room, nick);
  };

  const handleContinue = () => {
    if (player && gamePath(roomGame)) setAttempted(true);
  };

  // 입장/계속 진행 중에만 로딩 화면. 그냥 들어오면 항상 폼이 보인다.
  if (attempted && (authLoading || (player && gamePath(roomGame)))) {
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
          {hasPriorSession ? "다른 방 입장" : "입장하기"}
        </h1>
        <p className="mb-5 text-xs text-zinc-400">
          GM이 안내한 <b>방 코드</b>와 <b>등록된 닉네임</b>을 입력하세요.
        </p>

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

        {attempted && authError && (
          <p className="mb-2 text-xs text-red-400">{authError}</p>
        )}

        <button
          className="mt-2 h-11 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={handleSubmit}
          disabled={!inputRoom.trim() || !inputNickname.trim()}
        >
          입장하기
        </button>
      </div>
    </div>
  );
}
