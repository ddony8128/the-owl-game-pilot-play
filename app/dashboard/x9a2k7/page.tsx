"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomGame, Player } from "@/lib/types";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "이상교통",
};

const CURRENT_ROOM_KEY = "owlgm:room";

type CurrentRoom = { code: string; game: RoomGame };

export default function RoomRegistryPage() {
  // 지금 다루는 방 1개만 기억한다(새로고침해도 유지). 목록 개념은 없다.
  const [current, setCurrent] = useState<CurrentRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(CURRENT_ROOM_KEY);
      if (raw) setCurrent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const openRoom = useCallback((room: CurrentRoom) => {
    setCurrent(room);
    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENT_ROOM_KEY, JSON.stringify(room));
    }
  }, []);

  const leave = useCallback(() => {
    setCurrent(null);
    setError(null);
    setCodeInput("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_ROOM_KEY);
    }
  }, []);

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
      openRoom({ code: json.room.code, game });
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
      openRoom({ code: json.room.code, game: json.room.game });
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 조회 실패");
    }
  };

  // 초기 localStorage 읽기 전에는 깜빡임을 막기 위해 비워둔다.
  if (!ready) return <div className="text-sm text-zinc-500">불러오는 중…</div>;

  if (current) {
    return (
      <RoomPanel room={current} onLeave={leave} />
    );
  }

  return (
    <div className="space-y-6 text-sm text-zinc-100">
      <div>
        <h1 className="text-lg font-bold">방(room) 관리</h1>
        <p className="text-xs text-zinc-400">
          새 방을 만들면 코드가 발급됩니다. 기존 방은 <b>코드를 입력</b>해 관리합니다(전체 목록은 보이지 않습니다).
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-700 bg-red-900/40 p-2 text-red-300">
          {error}
        </div>
      )}

      {/* 새 방 만들기 */}
      <div className="space-y-2">
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

      {/* 기존 방 입장 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">기존 방 입장</h2>
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
            입장
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomPanel({
  room,
  onLeave,
}: {
  room: CurrentRoom;
  onLeave: () => void;
}) {
  const dashboardHref = `/dashboard/x9a2k7/${room.game}?room=${room.code}`;

  const endRoom = async () => {
    if (!window.confirm(`방 ${room.code}을(를) 종료 처리할까요?`)) return;
    await fetch("/api/gm/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: room.code, status: "ended", ended_normally: true }),
    });
    onLeave();
  };

  return (
    <div className="space-y-5 text-sm text-zinc-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          ← 다른 방 만들기/입장
        </button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-zinc-400">방 코드</span>
          <span className="font-mono text-2xl font-bold tracking-widest text-amber-300">
            {room.code}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
            {GAME_LABEL[room.game] ?? room.game}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">이 코드를 참가자에게 안내하세요.</p>

        <div className="mt-3 flex gap-2">
          <a
            href={dashboardHref}
            className="rounded bg-amber-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400"
          >
            대시보드 입장 →
          </a>
          <button
            onClick={() => void endRoom()}
            className="rounded bg-red-900 px-3 py-1.5 text-red-200 hover:bg-red-800"
          >
            방 종료
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">참가자 등록</h2>
        <RoomRoster room={room.code} />
      </div>
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
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
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
        <span className="self-center text-xs text-zinc-500">총 {players.length}명</span>
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
