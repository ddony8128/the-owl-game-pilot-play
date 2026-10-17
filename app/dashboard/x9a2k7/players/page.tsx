"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PlayerRosterSection } from "../PlayerRosterSection";

type RosterPlayer = { id: string; nickname: string };
type Game = "mafia" | "defense";

const playerRequests = new Map<string, Promise<RosterPlayer[]>>();

async function fetchPlayers(room: string): Promise<RosterPlayer[]> {
  const pending = playerRequests.get(room);
  if (pending) return pending;

  const request = (async () => {
    const res = await fetch(`/api/gm/players?room=${encodeURIComponent(room)}`);
    const json = (await res.json().catch(() => null)) as
      | { players?: RosterPlayer[]; error?: string }
      | null;
    if (!res.ok || json?.error) {
      throw new Error(json?.error ?? "참가자 목록을 불러오지 못했습니다.");
    }
    return json?.players ?? [];
  })();
  playerRequests.set(room, request);
  try {
    return await request;
  } finally {
    playerRequests.delete(room);
  }
}

export default function PlayersPage() {
  const [room, setRoom] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextRoom = params.get("room")?.trim().toUpperCase() ?? "";
    const nextGame = params.get("game");
    setRoom(nextRoom || null);
    setGame(nextGame === "mafia" || nextGame === "defense" ? nextGame : null);
    if (!nextRoom) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextPlayers = await fetchPlayers(nextRoom);
        if (!cancelled) setPlayers(nextPlayers);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "참가자 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (!room || !game) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-zinc-400">
        <p>관리할 방이 선택되지 않았습니다.</p>
        <Link href="/dashboard/x9a2k7" className="rounded-lg bg-zinc-800 px-4 py-2 text-zinc-200">
          방 관리로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-amber-400">ROOM {room}</p>
          <h1 className="mt-1 text-2xl font-black">참가자 관리</h1>
          <p className="mt-1 text-sm text-zinc-500">참가자를 추가하거나 게임에서 제외할 수 있습니다.</p>
        </div>
        <Link
          prefetch={false}
          href={`/dashboard/x9a2k7/${game}?room=${encodeURIComponent(room)}`}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          게임 진행으로 돌아가기 →
        </Link>
      </div>

      {error ? <ErrorMessage message={error} /> : null}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">참가자 목록</h2>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{players.length}명</span>
        </div>
        <PlayerRosterSection
          room={room}
          players={players}
          onAdded={(player) =>
            setPlayers((current) =>
              current.some((item) => item.id === player.id)
                ? current
                : [...current, player].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"))
            )
          }
          onRemoved={(id) => setPlayers((current) => current.filter((player) => player.id !== id))}
        />
      </section>
    </div>
  );
}
