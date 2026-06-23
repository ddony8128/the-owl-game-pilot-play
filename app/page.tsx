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

export default function EntryPage() {
  const router = useRouter();
  const {
    player,
    roomGame,
    enterRoom,
    isLoading: authLoading,
    error: authError,
  } = usePlayerAuth();

  const [inputRoom, setInputRoom] = useState("");
  const [inputNickname, setInputNickname] = useState("");

  // 방+닉네임이 검증되면 곧바로 해당 게임으로 진입한다.
  useEffect(() => {
    if (authLoading) return;
    const path = gamePath(roomGame);
    if (player && path) router.replace(path);
  }, [authLoading, player, roomGame, router]);

  const handleSubmit = () => {
    const room = inputRoom.trim();
    const nick = inputNickname.trim();
    if (!room || !nick) return;
    enterRoom(room, nick);
  };

  // 검증 중이거나, 이미 입장 완료되어 리다이렉트되는 동안은 로딩 화면.
  if (authLoading || (player && gamePath(roomGame))) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900/80 p-6 shadow-xl ring-1 ring-zinc-800/60">
        <h1 className="mb-1 text-xl font-semibold">입장하기</h1>
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

        {authError && <p className="mb-2 text-xs text-red-400">{authError}</p>}

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
