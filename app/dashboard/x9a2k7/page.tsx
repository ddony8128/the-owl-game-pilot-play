"use client";

import { useCallback, useEffect, useState } from "react";
import type { Room, RoomGame, Player } from "@/lib/types";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "이상교통",
};

const MY_ROOMS_KEY = "owlgm:rooms";

type MyRoom = { code: string; game: RoomGame };

export default function RoomRegistryPage() {
  // 내가 만들었거나 코드를 직접 입력해 연 방만 보관(전역 목록은 제공하지 않음)
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(MY_ROOMS_KEY);
      if (raw) setMyRooms(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((rooms: MyRoom[]) => {
    setMyRooms(rooms);
    if (typeof window !== "undefined") {
      localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(rooms));
    }
  }, []);

  const addRoom = useCallback(
    (room: MyRoom) => {
      setMyRooms((prev) => {
        if (prev.some((r) => r.code === room.code)) return prev;
        const next = [room, ...prev];
        if (typeof window !== "undefined") {
          localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  const createRoom = async (game: RoomGame) => {
    setError(null);
    setLastCreated(null);
    try {
      const res = await fetch("/api/gm/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      addRoom({ code: json.room.code, game });
      setLastCreated(json.room.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 생성 실패");
    }
  };

  const enterByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setError(null);
    try {
      const res = await fetch(`/api/gm/rooms?code=${encodeURIComponent(code)}`);
      if (res.status === 404) throw new Error("그런 방 코드가 없습니다.");
      const json = await res.json();
      if (json.error || !json.room) throw new Error(json.error ?? "방을 찾을 수 없습니다.");
      addRoom({ code: json.room.code, game: json.room.game });
      setCodeInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 조회 실패");
    }
  };

  const endRoom = async (code: string) => {
    await fetch("/api/gm/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, status: "ended", ended_normally: true }),
    });
  };

  const removeFromList = (code: string) =>
    persist(myRooms.filter((r) => r.code !== code));

  return (
    <div className="space-y-5 text-sm text-zinc-100">
      <div>
        <h1 className="text-lg font-bold">방(room) 관리</h1>
        <p className="text-xs text-zinc-400">
          방을 만들면 코드가 발급됩니다. <b>방 코드를 가진 방만</b> 관리할 수 있습니다(전체 목록은 보이지 않습니다).
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-700 bg-red-900/40 p-2 text-red-300">
          {error}
        </div>
      )}

      {/* 새 방 만들기 */}
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
        {lastCreated && (
          <p className="text-xs text-amber-300">
            새 방 코드: <b className="font-mono tracking-widest">{lastCreated}</b> — 참가자에게 안내하세요.
          </p>
        )}
      </div>

      {/* 방 코드로 관리 */}
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">방 코드로 관리</h2>
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void enterByCode()}
            placeholder="방 코드 입력 (예: A3F82)"
            className="h-8 w-48 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono uppercase outline-none"
          />
          <button
            onClick={() => void enterByCode()}
            className="rounded bg-zinc-800 px-3 hover:bg-zinc-700"
          >
            불러오기
          </button>
        </div>
      </div>

      {/* 내가 여는 방 목록(세션) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">내 방 ({myRooms.length})</h2>
        {myRooms.length === 0 && (
          <p className="text-zinc-500">아직 만들거나 불러온 방이 없습니다.</p>
        )}
        {myRooms.map((room) => (
          <RoomRow
            key={room.code}
            room={room}
            onEnd={() => void endRoom(room.code)}
            onRemove={() => removeFromList(room.code)}
          />
        ))}
      </div>
    </div>
  );
}

function RoomRow({
  room,
  onEnd,
  onRemove,
}: {
  room: MyRoom;
  onEnd: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dashboardHref = `/dashboard/x9a2k7/${room.game}?room=${room.code}`;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-base font-bold tracking-widest text-amber-300">
          {room.code}
        </span>
        <span className="text-zinc-300">{GAME_LABEL[room.game] ?? room.game}</span>
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
          <button
            onClick={onRemove}
            className="rounded bg-zinc-800 px-2 py-1 text-zinc-400 hover:bg-zinc-700"
            title="이 목록에서만 치움(방은 유지)"
          >
            ✕
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
