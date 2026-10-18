"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { RoomGame } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { useGmAction } from "@/lib/hooks/useGmAction";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "현재 운영하지 않는 게임",
};

type CurrentRoom = {
  code: string;
  game: RoomGame;
  status?: "active" | "ended";
  created_at?: string;
};

// 방 관리 — bluecode674 포크 구성: 새 방 만들기(만들면 바로 게임 진행 화면으로) + 진행 가능한 방(체크박스 일괄 종료) + 종료된 방(결과 보기).
//  목록은 GET /api/gm/rooms(최근 50개). 참가 QR·방 종료·참가자 관리는 게임 진행 화면 상단과 참가자 관리 페이지에서 한다.
export default function RoomRegistryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<CurrentRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => new Set());
  const [bulkDialog, setBulkDialog] = useState<"end" | null>(null);

  // 방 목록(최근 50개) — 서버에서 읽는다.
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch("/api/gm/rooms", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { rooms?: CurrentRoom[]; error?: string } | null;
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error ?? `방 목록 조회 실패 (서버 응답 ${res.status || "없음"})`);
      }
      setRooms(json.rooms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 목록 조회 실패");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  // 일괄 종료는 GM 조작 공통(잠금·배너·멱등 키)을 거친다. 끝나면 목록을 다시 읽는다.
  const bulk = useGmAction(loadRooms);

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
      router.push(`/dashboard/x9a2k7/${game}?room=${json.room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 생성 실패");
    }
  };

  // 선택한 방들을 하나씩 종료한다(useGmAction 은 요청을 한 번에 하나만 보낸다). 실패한 코드는 선택에 남긴다.
  const [bulkEnding, setBulkEnding] = useState(false);
  const endSelectedRooms = async () => {
    const codes = [...selectedCodes];
    if (codes.length === 0) return;
    setBulkEnding(true);
    const failed: string[] = [];
    try {
      for (const code of codes) {
        const r = await bulk.run("/api/gm/rooms", {
          method: "PATCH",
          body: { code, status: "ended", ended_normally: true },
        });
        if (!r?.ok) failed.push(code);
      }
      setSelectedCodes(new Set(failed));
      await loadRooms();
    } finally {
      setBulkEnding(false);
    }
  };

  const activeRooms = rooms.filter((room) => room.status !== "ended");
  const endedRooms = rooms.filter((room) => room.status === "ended");
  const allActiveSelected = activeRooms.length > 0 && activeRooms.every((room) => selectedCodes.has(room.code));

  const toggleAll = (
    list: CurrentRoom[],
    allSelected: boolean,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    setter((currentCodes) => {
      const next = new Set(currentCodes);
      if (allSelected) list.forEach((room) => next.delete(room.code));
      else list.forEach((room) => next.add(room.code));
      return next;
    });
  };
  const toggleOne = (code: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((currentCodes) => {
      const next = new Set(currentCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
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
      <GmErrorBanner message={bulk.error} onClose={bulk.clearError} />
      <GmNoticeBanner message={bulk.notice} />

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

      {/* 진행 가능한 방 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={allActiveSelected}
                onChange={() => toggleAll(activeRooms, allActiveSelected, setSelectedCodes)}
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
                onClick={() => setBulkDialog("end")}
                disabled={bulkEnding}
                className="min-h-10 rounded-lg bg-red-950 px-3 text-sm font-semibold text-red-300 hover:bg-red-900 disabled:opacity-50"
              >
                {bulkEnding ? "정리 중…" : `선택 ${selectedCodes.size}개 종료`}
              </button>
            )}
            <button onClick={() => void loadRooms()} className="min-h-10 rounded-lg bg-zinc-800 px-3 text-sm hover:bg-zinc-700">
              ↻ 새로고침
            </button>
          </div>
        </div>
        {roomsLoading ? (
          <p className="text-xs text-zinc-500">방 목록을 불러오는 중…</p>
        ) : activeRooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">
            진행 가능한 방이 없습니다. 위에서 새 방을 만들어 주세요.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70">
            {activeRooms.map((room) => (
              <div key={room.code} className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3 last:border-b-0">
                <input
                  type="checkbox"
                  aria-label={`${room.code} 선택`}
                  checked={selectedCodes.has(room.code)}
                  onChange={() => toggleOne(room.code, setSelectedCodes)}
                  className="h-4 w-4 accent-red-500"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <span className="font-mono text-base font-bold tracking-widest text-amber-300">{room.code}</span>
                  <span className="truncate text-sm font-semibold text-zinc-200">{GAME_LABEL[room.game]}</span>
                  {room.created_at && (
                    <span className="ml-auto hidden text-xs text-zinc-500 sm:inline">{new Date(room.created_at).toLocaleString("ko-KR")}</span>
                  )}
                  <Link
                    prefetch={false}
                    href={`/dashboard/x9a2k7/${room.game}?room=${room.code}`}
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

      {/* 종료된 방 — 기록 확인용(읽기 전용). 삭제 API 는 두지 않는다. */}
      {endedRooms.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-zinc-300">종료된 방</h2>
            <p className="text-xs text-zinc-500">결과와 기록을 다시 볼 수 있습니다(읽기 전용).</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            {endedRooms.map((room) => (
              <div key={room.code} className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <span className="font-mono text-base font-bold tracking-widest text-zinc-400">{room.code}</span>
                  <span className="truncate text-sm font-semibold text-zinc-400">{GAME_LABEL[room.game]}</span>
                  <span className="rounded bg-red-900/70 px-2 py-0.5 text-xs font-semibold text-red-200">종료됨</span>
                  {room.created_at && (
                    <span className="ml-auto hidden text-xs text-zinc-600 sm:inline">{new Date(room.created_at).toLocaleString("ko-KR")}</span>
                  )}
                  <Link
                    prefetch={false}
                    href={`/dashboard/x9a2k7/${room.game}?room=${room.code}`}
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

      <ConfirmDialog
        open={bulkDialog === "end"}
        title={`선택한 방 ${selectedCodes.size}개 종료`}
        confirmLabel="종료"
        danger
        busy={bulkEnding}
        onClose={() => setBulkDialog(null)}
        onConfirm={async () => {
          setBulkDialog(null);
          await endSelectedRooms();
        }}
      >
        <p className="text-zinc-300">종료된 방은 읽기 전용이 되어 아래 「종료된 방」 목록으로 이동합니다. 기록은 보존됩니다.</p>
        <p className="font-mono text-xs text-zinc-400">{[...selectedCodes].join(", ")}</p>
      </ConfirmDialog>
    </div>
  );
}
