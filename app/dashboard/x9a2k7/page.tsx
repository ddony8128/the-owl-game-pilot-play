"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { RoomGame, Player } from "@/lib/types";
import { RoomEndedBadge, useRoomStatus } from "./RoomEndedNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { useGmAction } from "@/lib/hooks/useGmAction";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "현재 운영하지 않는 게임",
};

const CURRENT_ROOM_KEY = "owlgm:room";
const RECENT_ROOMS_KEY = "owlgm:recent";
const RECENT_MAX = 20;

type CurrentRoom = {
  code: string;
  game: RoomGame;
  status?: "active" | "ended";
  created_at?: string;
};

function readRecent(): CurrentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    const list = raw ? (JSON.parse(raw) as CurrentRoom[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.code === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(list: CurrentRoom[]) {
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

// 방 관리 — 목록(진행 가능/종료, 일괄 종료)은 bluecode674 포크 구성, 선택한 방 패널(코드·참가 QR·방 종료·참가자 명단·확인창)은 우리 것.
//  서버는 전역 방 목록을 주지 않으므로(코드를 가진 사람만 그 방을 다룬다) 목록은 "이 브라우저에서 만들었거나 입장한 방"이다.
//  지금 다루는 방 1개는 localStorage 에 기억한다(새로고침해도 유지).
export default function RoomRegistryPage() {
  const [current, setCurrent] = useState<CurrentRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<CurrentRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => new Set());
  const [selectedEndedCodes, setSelectedEndedCodes] = useState<Set<string>>(() => new Set());
  const [bulkEnding, setBulkEnding] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<"end" | "forget" | null>(null);

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

  // 최근 방 목록 — 기억해 둔 방들의 상태(active/ended)를 서버에서 다시 읽는다.
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const remembered = readRecent();
      const refreshed = await Promise.all(
        remembered.map(async (r) => {
          try {
            const res = await fetch(`/api/gm/rooms?code=${encodeURIComponent(r.code)}`, { cache: "no-store" });
            if (res.status === 404) return null; // 삭제된 방은 목록에서 뺀다
            const json = (await res.json().catch(() => null)) as { room?: CurrentRoom | null } | null;
            return json?.room ? { ...r, ...json.room } : r;
          } catch {
            return r;
          }
        }),
      );
      const next = refreshed.filter((r): r is CurrentRoom => r != null);
      writeRecent(next);
      setRooms(next);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const remember = useCallback((room: CurrentRoom) => {
    const list = readRecent().filter((r) => r.code !== room.code);
    const next = [{ ...room }, ...list];
    writeRecent(next);
    setRooms(next);
  }, []);

  const openRoom = useCallback(
    (room: CurrentRoom) => {
      setCurrent(room);
      setError(null);
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_ROOM_KEY, JSON.stringify(room));
      }
      remember(room);
    },
    [remember],
  );

  const leave = useCallback(() => {
    setCurrent(null);
    setError(null);
    setCodeInput("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_ROOM_KEY);
    }
    void loadRooms();
  }, [loadRooms]);

  const forgetRoomIfSelected = (codes: string[]) => {
    if (current && codes.includes(current.code)) {
      setCurrent(null);
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
      openRoom({ code: json.room.code, game, status: "active", created_at: json.room.created_at });
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
      openRoom({ code: json.room.code, game: json.room.game, status: json.room.status, created_at: json.room.created_at });
      setCodeInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 조회 실패");
    }
  };

  const endSelectedRooms = async () => {
    const codes = [...selectedCodes];
    if (codes.length === 0) return;
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
        }),
      );
      forgetRoomIfSelected(codes);
      setSelectedCodes(new Set());
      await loadRooms();
    } catch (e) {
      setError(e instanceof Error ? e.message : "선택한 방을 종료하지 못했습니다.");
    } finally {
      setBulkEnding(false);
    }
  };

  // 종료된 방을 이 브라우저의 목록에서만 뺀다(서버 기록은 그대로 — 삭제 API 는 두지 않는다).
  const forgetSelectedRooms = () => {
    const codes = new Set(selectedEndedCodes);
    if (codes.size === 0) return;
    const next = readRecent().filter((r) => !codes.has(r.code));
    writeRecent(next);
    setRooms(next);
    forgetRoomIfSelected([...codes]);
    setSelectedEndedCodes(new Set());
  };

  const activeRooms = rooms.filter((room) => room.status !== "ended");
  const endedRooms = rooms.filter((room) => room.status === "ended");
  const allActiveSelected = activeRooms.length > 0 && activeRooms.every((room) => selectedCodes.has(room.code));
  const allEndedSelected = endedRooms.length > 0 && endedRooms.every((room) => selectedEndedCodes.has(room.code));

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

  // 초기 localStorage 읽기 전에는 깜빡임을 막기 위해 비워둔다.
  if (!ready) return <div className="text-sm text-zinc-500">불러오는 중…</div>;

  if (current) {
    return <RoomPanel room={current} onLeave={leave} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 text-base text-zinc-100">
      <div>
        <h1 className="text-2xl font-bold">방 관리</h1>
        <p className="mt-1 text-sm text-zinc-400">
          새 방을 만들거나, 이 브라우저에서 다뤘던 방을 아래 목록에서 고르세요. 다른 기기에서 만든 방은 코드로 입장합니다.
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

      {/* 코드로 입장 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">코드로 입장</h2>
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void enterByCode()}
            placeholder="방 코드 입력 (예: A3F82)"
            className="h-11 w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 font-mono uppercase outline-none focus:border-amber-400"
          />
          <button
            onClick={() => void enterByCode()}
            className="rounded-lg bg-zinc-800 px-4 font-semibold hover:bg-zinc-700"
          >
            입장
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
            진행 가능한 방이 없습니다. 위에서 새 방을 만들거나 코드로 입장하세요.
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
                  <button
                    type="button"
                    onClick={() => openRoom(room)}
                    className="shrink-0 rounded-md bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700"
                  >
                    관리
                  </button>
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

      {/* 종료된 방 */}
      {endedRooms.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={allEndedSelected}
                  onChange={() => toggleAll(endedRooms, allEndedSelected, setSelectedEndedCodes)}
                  className="h-4 w-4 accent-red-500"
                />
                전체 선택
              </label>
              <div>
                <h2 className="font-semibold text-zinc-300">종료된 방</h2>
                <p className="text-xs text-zinc-500">결과를 다시 보거나, 다 본 방은 목록에서 지울 수 있습니다(서버 기록은 남습니다).</p>
              </div>
            </div>
            {selectedEndedCodes.size > 0 && (
              <button
                type="button"
                onClick={() => setBulkDialog("forget")}
                className="min-h-10 rounded-lg bg-zinc-800 px-3 text-sm font-bold text-zinc-200 hover:bg-zinc-700"
              >
                선택 {selectedEndedCodes.size}개 목록에서 지우기
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            {endedRooms.map((room) => (
              <div key={room.code} className="flex items-center gap-3 border-b border-zinc-800 px-3 py-3 last:border-b-0">
                <input
                  type="checkbox"
                  aria-label={`${room.code} 목록 제거 선택`}
                  checked={selectedEndedCodes.has(room.code)}
                  onChange={() => toggleOne(room.code, setSelectedEndedCodes)}
                  className="h-4 w-4 accent-red-500"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <span className="font-mono text-base font-bold tracking-widest text-zinc-400">{room.code}</span>
                  <span className="truncate text-sm font-semibold text-zinc-400">{GAME_LABEL[room.game]}</span>
                  <RoomEndedBadge />
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
      <ConfirmDialog
        open={bulkDialog === "forget"}
        title={`종료된 방 ${selectedEndedCodes.size}개 목록에서 지우기`}
        confirmLabel="목록에서 지우기"
        onClose={() => setBulkDialog(null)}
        onConfirm={() => {
          setBulkDialog(null);
          forgetSelectedRooms();
        }}
      >
        <p className="text-zinc-300">이 브라우저의 목록에서만 사라집니다. 서버 기록은 그대로이며 코드로 다시 입장할 수 있습니다.</p>
        <p className="font-mono text-xs text-zinc-400">{[...selectedEndedCodes].join(", ")}</p>
      </ConfirmDialog>
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
  const ended = useRoomStatus(room.code) === "ended";
  const action = useGmAction();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const endRoom = async () => {
    const r = await action.run("/api/gm/rooms", {
      method: "PATCH",
      body: { code: room.code, status: "ended", ended_normally: true },
    });
    if (r?.ok) onLeave();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 text-sm text-zinc-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          ← 방 목록
        </button>
      </div>

      <GmErrorBanner message={action.error} onClose={action.clearError} />
      <GmNoticeBanner message={action.notice} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold tracking-[0.16em] text-zinc-500">ROOM</span>
          <span className="font-mono text-3xl font-black tracking-widest text-amber-300">
            {room.code}
          </span>
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300">
            {GAME_LABEL[room.game] ?? room.game}
          </span>
          {ended && <RoomEndedBadge />}
        </div>
        {ended ? (
          <p className="mt-2 text-xs text-red-300">
            종료된 방입니다. 대시보드는 기록 확인용(읽기 전용)으로만 보세요. 게임을 다시 진행하려면 새 방을 만드세요.
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">이 코드를 참가자에게 안내하세요. 참가자는 닉네임만 입력하면 들어옵니다.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={dashboardHref}
            className="min-h-11 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-400"
          >
            {ended ? "대시보드 보기(읽기 전용) →" : "대시보드 입장 →"}
          </a>
          {!ended && (
            <button
              onClick={() => window.open(`/join?code=${room.code}`, "owl-join", "width=720,height=900")}
              title="참가 QR과 방 코드를 새 창에 크게 띄웁니다 (입장·중간 합류·재접속용)"
              data-testid="join-qr-open"
              className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-semibold text-amber-300 hover:bg-zinc-800"
            >
              📲 참가 QR
            </button>
          )}
          {!ended && (
            <button
              onClick={() => setConfirmEnd(true)}
              disabled={action.busy}
              data-testid="end-room"
              className="min-h-11 rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-2.5 font-bold text-red-200 hover:bg-red-900/60 disabled:opacity-40"
            >
              방 종료
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title={`방 ${room.code} 종료`}
        confirmLabel="종료"
        danger
        busy={action.busy}
        onClose={() => setConfirmEnd(false)}
        onConfirm={async () => {
          setConfirmEnd(false);
          await endRoom();
        }}
      >
        <p className="text-zinc-300">
          종료하면 이 방의 라운드·페이즈·점수·타이머 조작이 모두 막히고(읽기 전용) 참가자도 더 행동할 수 없습니다. 기록은 보존됩니다.
          다시 진행하려면 새 방을 만들어야 합니다.
        </p>
      </ConfirmDialog>

      <div>
        <h2 className="mb-2 text-sm font-semibold">참가자 명단</h2>
        <p className="mb-2 text-xs text-zinc-500">참가자는 스스로 입장하며 여기에 자동으로 나타납니다. 미리 등록하거나 삭제(강퇴)할 때만 쓰세요.</p>
        <RoomRoster room={room.code} ended={ended} />
      </div>
    </div>
  );
}

function RoomRoster({ room, ended }: { room: string; ended: boolean }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [kick, setKick] = useState<Player | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/gm/players?room=${encodeURIComponent(room)}`);
    const json = await res.json();
    if (json.players) setPlayers(json.players);
  }, [room]);
  const action = useGmAction(reload);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 명단을 서버에서 불러온다
    void reload();
  }, [reload]);

  const add = async () => {
    const nick = name.trim();
    if (!nick) return;
    const r = await action.run("/api/gm/players", { body: { room, nickname: nick } });
    if (r?.ok) setName("");
  };

  const remove = async (p: Player) => {
    await action.run(
      "/api/gm/players",
      { method: "DELETE", body: { id: p.id } },
      { notice: `${p.nickname} 삭제됨` },
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4" data-testid="roster">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="참가자 닉네임"
          disabled={ended}
          maxLength={24}
          className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-amber-400 disabled:opacity-50"
        />
        <button
          onClick={() => void add()}
          disabled={ended || action.busy}
          className="min-h-11 rounded-lg bg-amber-500 px-5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          + 참가자 추가
        </button>
        <span className="self-center text-xs text-zinc-500">총 {players.length}명</span>
      </div>
      <GmErrorBanner message={action.error} onClose={action.clearError} />
      <GmNoticeBanner message={action.notice} />
      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-xs text-zinc-500">아직 참가자가 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="divide-y divide-zinc-800">
            {players.map((p, index) => (
              <div key={p.id} className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center px-3 py-2.5 hover:bg-zinc-800/40">
                <span className="text-center font-mono text-xs text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-sm font-black text-zinc-950">
                    {p.nickname.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="truncate font-bold text-zinc-100">{p.nickname}</span>
                </div>
                {!ended ? (
                  <button
                    onClick={() => setKick(p)}
                    aria-label={`${p.nickname} 삭제`}
                    className="justify-self-end rounded-md px-2.5 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-950 hover:text-red-300"
                  >
                    삭제
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={kick != null}
        title={`${kick?.nickname ?? ""} 삭제(강퇴)`}
        confirmLabel="삭제"
        danger
        busy={action.busy}
        onClose={() => setKick(null)}
        onConfirm={async () => {
          const target = kick;
          setKick(null);
          if (target) await remove(target);
        }}
      >
        <p className="text-zinc-300">
          이 참가자의 행동·자산·점수 기록이 모두 지워지고 즉시 접속이 끊깁니다. 진행 중인 라운드의 미제출 수·정산·순위에서도 빠집니다.
          같은 닉네임을 다시 등록하면 새 참가자로 들어옵니다.
        </p>
      </ConfirmDialog>
    </div>
  );
}
