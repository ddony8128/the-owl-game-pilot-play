"use client";

import { useCallback, useEffect, useState } from "react";
import type { Room, RoomGame, Player } from "@/lib/types";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "이상교통",
};

export default function RoomRegistryPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/gm/rooms");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRooms(json.rooms ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createRoom = async (game: RoomGame) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 생성 실패");
    }
  };

  const endRoom = async (code: string) => {
    await fetch("/api/gm/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, status: "ended", ended_normally: true }),
    });
    await reload();
  };

  return (
    <div className="space-y-4 text-sm text-zinc-100">
      <div>
        <h1 className="text-lg font-bold">방(room) 관리</h1>
        <p className="text-xs text-zinc-400">
          새 방을 만들면 코드가 발급됩니다. 참가자는 코드 + 닉네임으로 입장합니다.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-700 bg-red-900/40 p-2 text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-sm font-semibold">새 방 만들기</h2>
        <div className="flex gap-2">
          <button
            onClick={() => void createRoom("mafia")}
            className="rounded bg-amber-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400"
          >
            + 마피아 방
          </button>
          <button
            onClick={() => void createRoom("defense")}
            className="rounded bg-amber-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400"
          >
            + 디펜스 방
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">방 목록</h2>
        {loading && <p className="text-zinc-500">불러오는 중…</p>}
        {!loading && rooms.length === 0 && (
          <p className="text-zinc-500">아직 만든 방이 없습니다.</p>
        )}
        {rooms.map((room) => (
          <RoomRow key={room.code} room={room} onEnd={() => void endRoom(room.code)} />
        ))}
      </div>
    </div>
  );
}

function RoomRow({ room, onEnd }: { room: Room; onEnd: () => void }) {
  const [open, setOpen] = useState(false);
  const dashboardHref = `/dashboard/x9a2k7/${room.game}?room=${room.code}`;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-base font-bold tracking-widest text-amber-300">
          {room.code}
        </span>
        <span className="text-zinc-300">{GAME_LABEL[room.game] ?? room.game}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            room.status === "active"
              ? "bg-green-900 text-green-300"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {room.status === "active" ? "진행" : "종료"}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
          >
            참가자
          </button>
          <a
            href={dashboardHref}
            className="rounded bg-zinc-800 px-2 py-1 text-amber-300 hover:bg-zinc-700"
          >
            대시보드 입장 →
          </a>
          <button
            onClick={onEnd}
            className="rounded bg-red-900 px-2 py-1 text-red-200 hover:bg-red-800"
          >
            종료
          </button>
        </div>
      </div>
      {open && <RoomRoster room={room.code} />}
    </div>
  );
}

function RoomRoster({ room }: { room: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/gm/players?room=${encodeURIComponent(room)}`);
    const json = await res.json();
    if (json.players) setPlayers(json.players);
  }, [room]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async () => {
    const nick = name.trim();
    if (!nick) return;
    setError(null);
    const res = await fetch("/api/gm/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, nickname: nick }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setName("");
    await reload();
  };

  const remove = async (id: string) => {
    await fetch("/api/gm/players", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await reload();
  };

  return (
    <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="참가자 닉네임"
          className="h-8 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 outline-none"
        />
        <button
          onClick={() => void add()}
          className="rounded bg-amber-500 px-3 text-zinc-950 hover:bg-amber-400"
        >
          등록
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {players.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs"
          >
            {p.nickname}
            <button
              onClick={() => void remove(p.id)}
              className="text-zinc-500 hover:text-red-400"
            >
              ✕
            </button>
          </span>
        ))}
        {players.length === 0 && (
          <span className="text-xs text-zinc-600">등록된 참가자 없음</span>
        )}
      </div>
    </div>
  );
}
