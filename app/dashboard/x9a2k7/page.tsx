"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { RoomGame } from "@/lib/types";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "현재 운영하지 않는 게임",
};

const CURRENT_ROOM_KEY = "owlgm:room";

type CurrentRoom = {
  code: string;
  game: RoomGame;
  status?: "active" | "ended";
  created_at?: string;
};

let roomListRequest: Promise<CurrentRoom[]> | null = null;
let roomListCache: { rooms: CurrentRoom[]; fetchedAt: number } | null = null;

async function fetchRoomList(force = false): Promise<CurrentRoom[]> {
  if (!force && roomListRequest) return roomListRequest;
  if (!force && roomListCache && Date.now() - roomListCache.fetchedAt < 1000) {
    return roomListCache.rooms;
  }

  roomListRequest = (async () => {
    const res = await fetch("/api/gm/rooms");
    const json = (await res.json().catch(() => null)) as
      | { rooms?: CurrentRoom[]; error?: string }
      | null;
    if (!res.ok || !json || json.error) {
      throw new Error(
        json?.error ?? `방 목록 조회 실패 (서버 응답 ${res.status || "없음"})`,
      );
    }
    const nextRooms = (json.rooms ?? []) as CurrentRoom[];
    roomListCache = { rooms: nextRooms, fetchedAt: Date.now() };
    return nextRooms;
  })();

  try {
    return await roomListRequest;
  } finally {
    roomListRequest = null;
  }
}

export default function RoomRegistryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<CurrentRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedEndedCodes, setSelectedEndedCodes] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkEnding, setBulkEnding] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadRooms = useCallback(async (force = false) => {
    setRoomsLoading(true);
    try {
      const nextRooms = await fetchRoomList(force);
      setRooms(nextRooms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 목록 조회 실패");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const openRoom = useCallback((room: CurrentRoom) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENT_ROOM_KEY, JSON.stringify(room));
    }
  }, []);

  const forgetRoomIfSelected = (codes: string[]) => {
    try {
      const raw = localStorage.getItem(CURRENT_ROOM_KEY);
      const remembered = raw ? (JSON.parse(raw) as CurrentRoom) : null;
      if (remembered && codes.includes(remembered.code)) {
        localStorage.removeItem(CURRENT_ROOM_KEY);
      }
    } catch {
      localStorage.removeItem(CURRENT_ROOM_KEY);
    }
  };

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
      const room = { code: json.room.code, game, status: "active" as const };
      openRoom(room);
      router.push(`/dashboard/x9a2k7/${game}?room=${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 생성 실패");
    }
  };

  const endSelectedRooms = async () => {
    const codes = [...selectedCodes];
    if (codes.length === 0) return;
    if (!window.confirm(`선택한 방 ${codes.length}개를 종료할까요?\n종료된 방은 아래 기록으로 이동합니다.`)) return;

    setBulkEnding(true);
    setError(null);
    try {
      await Promise.all(
        codes.map(async (code) => {
          const res = await fetch("/api/gm/rooms", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, status: "ended", ended_normally: true }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error ?? `${code} 종료 실패`);
          }
        })
      );
      forgetRoomIfSelected(codes);
      setSelectedCodes(new Set());
      await loadRooms(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "선택한 방을 종료하지 못했습니다.");
    } finally {
      setBulkEnding(false);
    }
  };

  const deleteSelectedRooms = async () => {
    const codes = [...selectedEndedCodes];
    if (codes.length === 0) return;
    if (!window.confirm(`종료된 방 ${codes.length}개를 영구 삭제할까요?\n플레이어, 점수, 행동과 라운드 기록도 복구할 수 없습니다.`)) return;

    setBulkDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/gm/rooms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.error) {
        throw new Error(json?.error ?? "종료된 방 삭제 실패");
      }
      forgetRoomIfSelected(codes);
      setSelectedEndedCodes(new Set());
      await loadRooms(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "종료된 방을 삭제하지 못했습니다.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const activeRooms = rooms.filter((room) => room.status !== "ended");
  const endedRooms = rooms.filter((room) => room.status === "ended");
  const allActiveSelected =
    activeRooms.length > 0 &&
    activeRooms.every((room) => selectedCodes.has(room.code));
  const allEndedSelected =
    endedRooms.length > 0 &&
    endedRooms.every((room) => selectedEndedCodes.has(room.code));

  const toggleAllActiveRooms = () => {
    setSelectedCodes((currentCodes) => {
      const next = new Set(currentCodes);
      if (allActiveSelected) {
        activeRooms.forEach((room) => next.delete(room.code));
      } else {
        activeRooms.forEach((room) => next.add(room.code));
      }
      return next;
    });
  };

  const toggleAllEndedRooms = () => {
    setSelectedEndedCodes((currentCodes) => {
      const next = new Set(currentCodes);
      if (allEndedSelected) {
        endedRooms.forEach((room) => next.delete(room.code));
      } else {
        endedRooms.forEach((room) => next.add(room.code));
      }
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 text-base text-zinc-100">
      <div>
        <h1 className="text-2xl font-bold">방 관리</h1>
        <p className="mt-1 text-sm text-zinc-400">
          새 방을 만들거나 아래 목록에서 기존 방을 선택하세요. 방 코드를 외울 필요가 없습니다.
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
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => void createRoom("mafia")}
            className="min-h-14 rounded-xl bg-amber-500 px-4 text-base font-bold text-zinc-950 hover:bg-amber-400 active:scale-[0.99]"
          >
            + 마피아 방
          </button>
          <button
            onClick={() => void createRoom("defense")}
            className="min-h-14 rounded-xl bg-sky-500 px-4 text-base font-bold text-zinc-950 hover:bg-sky-400 active:scale-[0.99]"
          >
            + 디펜스 방
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={allActiveSelected}
                onChange={toggleAllActiveRooms}
                disabled={roomsLoading || activeRooms.length === 0}
                className="h-4 w-4 accent-red-500 disabled:opacity-40"
              />
              전체 선택
            </label>
            <div>
            <h2 className="font-semibold">진행 가능한 방</h2>
            <p className="text-xs text-zinc-500">사용하지 않는 방을 선택해 한 번에 종료할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCodes.size > 0 && (
              <button
                type="button"
                onClick={() => void endSelectedRooms()}
                disabled={bulkEnding}
                className="min-h-10 rounded-lg bg-red-950 px-3 text-sm font-semibold text-red-300 hover:bg-red-900 disabled:opacity-50"
              >
                {bulkEnding ? "정리 중…" : `선택 ${selectedCodes.size}개 종료`}
              </button>
            )}
            <button onClick={() => void loadRooms(true)} className="min-h-10 rounded-lg bg-zinc-800 px-3 text-sm hover:bg-zinc-700">↻ 새로고침</button>
          </div>
        </div>
        {roomsLoading ? (
          <p className="text-xs text-zinc-500">방 목록을 불러오는 중…</p>
        ) : activeRooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">진행 가능한 방이 없습니다. 위에서 새 방을 만들어 주세요.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
            {activeRooms.map((room) => (
              <div key={room.code} className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3 last:border-b-0">
                <input
                  type="checkbox"
                  aria-label={`${room.code} 선택`}
                  checked={selectedCodes.has(room.code)}
                  onChange={() =>
                    setSelectedCodes((currentCodes) => {
                      const next = new Set(currentCodes);
                      if (next.has(room.code)) next.delete(room.code);
                      else next.add(room.code);
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-red-500"
                />
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-mono text-base font-bold tracking-widest text-amber-300">{room.code}</span>
                  <span className="truncate text-sm font-semibold text-zinc-200">{GAME_LABEL[room.game]}</span>
                  {room.created_at && <span className="ml-auto hidden text-xs text-zinc-500 sm:inline">{new Date(room.created_at).toLocaleString("ko-KR")}</span>}
                  <Link
                    prefetch={false}
                    href={`/dashboard/x9a2k7/${room.game}?room=${room.code}`}
                    onClick={() => openRoom(room)}
                    className="shrink-0 rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                  >
                    입장하기 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {endedRooms.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={allEndedSelected}
                  onChange={toggleAllEndedRooms}
                  className="h-4 w-4 accent-red-500"
                />
                전체 선택
              </label>
              <div>
                <h2 className="font-semibold text-zinc-300">종료된 방</h2>
                <p className="text-xs text-zinc-500">결과를 다시 보거나 테스트 기록을 완전히 삭제할 수 있습니다.</p>
              </div>
            </div>
            {selectedEndedCodes.size > 0 && (
              <button
                type="button"
                onClick={() => void deleteSelectedRooms()}
                disabled={bulkDeleting}
                className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {bulkDeleting ? "삭제 중…" : `선택 ${selectedEndedCodes.size}개 영구 삭제`}
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            {endedRooms.map((room) => (
              <div key={room.code} className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3 last:border-b-0">
                <input
                  type="checkbox"
                  aria-label={`${room.code} 삭제 선택`}
                  checked={selectedEndedCodes.has(room.code)}
                  onChange={() =>
                    setSelectedEndedCodes((currentCodes) => {
                      const next = new Set(currentCodes);
                      if (next.has(room.code)) next.delete(room.code);
                      else next.add(room.code);
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-red-500"
                />
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-mono text-base font-bold tracking-widest text-zinc-400">{room.code}</span>
                  <span className="truncate text-sm font-semibold text-zinc-400">{GAME_LABEL[room.game]}</span>
                  {room.created_at && <span className="ml-auto hidden text-xs text-zinc-600 sm:inline">{new Date(room.created_at).toLocaleString("ko-KR")}</span>}
                  <Link
                    prefetch={false}
                    href={`/dashboard/x9a2k7/${room.game}?room=${room.code}`}
                    onClick={() => openRoom(room)}
                    className="shrink-0 rounded-md bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700"
                  >
                    결과 보기 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

