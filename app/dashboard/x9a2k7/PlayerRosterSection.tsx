"use client";

import { useState } from "react";

type RosterPlayer = { id: string; nickname: string };

export function PlayerRosterSection({
  room,
  players,
  onAdded,
  onRemoved,
}: {
  room: string;
  players: RosterPlayer[];
  onAdded: (player: RosterPlayer) => void;
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (method: "POST" | "DELETE", body: { room: string; nickname: string } | { id: string }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gm/players", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as { error?: string; player?: RosterPlayer; id?: string } | null;
      if (!res.ok || json?.error) throw new Error(json?.error ?? "참가자 정보를 변경하지 못했습니다.");
      if (method === "POST" && json?.player) {
        setName("");
        onAdded(json.player);
      } else if (method === "DELETE" && "id" in body) {
        onRemoved(body.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "참가자 정보를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const nickname = name.trim();
    if (nickname) void request("POST", { room, nickname });
  };

  return (
    <div className="mt-4 space-y-5">
      <div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 sm:p-4">
        <label htmlFor="player-nickname" className="mb-2 block text-xs font-bold text-zinc-400">
          새 참가자 추가
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="player-nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="닉네임을 입력하세요"
            maxLength={24}
            className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-base outline-none transition placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10"
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={add}
            className="min-h-12 rounded-lg bg-amber-500 px-6 font-bold text-zinc-950 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "처리 중…" : "+ 참가자 추가"}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-500">
            ♟
          </div>
          <p className="font-semibold text-zinc-400">아직 참가자가 없습니다</p>
          <p className="mt-1 text-xs text-zinc-600">위에서 닉네임을 입력해 첫 참가자를 추가하세요.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center border-b border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-zinc-500 sm:grid-cols-[3rem_minmax(0,1fr)_8rem_5rem]">
            <span className="text-center">번호</span>
            <span>닉네임</span>
            <span className="hidden sm:block">상태</span>
            <span className="text-right">관리</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center px-3 py-3 transition hover:bg-zinc-800/40 sm:grid-cols-[3rem_minmax(0,1fr)_8rem_5rem]"
              >
                <span className="text-center font-mono text-xs text-zinc-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 font-black text-zinc-950 shadow-sm">
                    {player.nickname.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="truncate font-bold text-zinc-100">{player.nickname}</span>
                </div>
                <span className="hidden w-fit rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 sm:block">
                  참가 중
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`${player.nickname} 참가자를 삭제할까요?`)) {
                      void request("DELETE", { id: player.id });
                    }
                  }}
                  aria-label={`${player.nickname} 삭제`}
                  className="justify-self-end rounded-md px-2.5 py-1.5 text-xs font-semibold text-zinc-500 transition hover:bg-red-950 hover:text-red-300 disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
