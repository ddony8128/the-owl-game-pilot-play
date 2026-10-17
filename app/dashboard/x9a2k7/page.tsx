"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomGame, Player } from "@/lib/types";
import { RoomEndedBadge, useRoomStatus } from "./RoomEndedNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { useGmAction } from "@/lib/hooks/useGmAction";

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
    <div className="space-y-5 text-sm text-zinc-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          ← 다른 방 만들기/입장
        </button>
      </div>

      <GmErrorBanner message={action.error} onClose={action.clearError} />
      <GmNoticeBanner message={action.notice} />

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-zinc-400">방 코드</span>
          <span className="font-mono text-2xl font-bold tracking-widest text-amber-300">
            {room.code}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
            {GAME_LABEL[room.game] ?? room.game}
          </span>
          {ended && <RoomEndedBadge />}
        </div>
        {ended ? (
          <p className="mt-1 text-xs text-red-300">
            종료된 방입니다. 대시보드는 기록 확인용(읽기 전용)으로만 보세요. 게임을 다시 진행하려면 새 방을 만드세요.
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">이 코드를 참가자에게 안내하세요.</p>
        )}

        <div className="mt-3 flex gap-2">
          <a
            href={dashboardHref}
            className="rounded bg-amber-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400"
          >
            {ended ? "대시보드 보기(읽기 전용) →" : "대시보드 입장 →"}
          </a>
          {!ended && (
            <button
              onClick={() => window.open(`/join?code=${room.code}`, "owl-join", "width=720,height=900")}
              title="참가 QR과 방 코드를 새 창에 크게 띄웁니다 (입장·중간 합류·재접속용)"
              data-testid="join-qr-open"
              className="rounded bg-zinc-800 px-3 py-1.5 font-semibold text-amber-300 hover:bg-zinc-700"
            >
              📲 참가 QR
            </button>
          )}
          {!ended && (
            <button
              onClick={() => setConfirmEnd(true)}
              disabled={action.busy}
              data-testid="end-room"
              className="rounded bg-red-900 px-3 py-1.5 text-red-200 hover:bg-red-800 disabled:opacity-40"
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
        <h2 className="mb-2 text-sm font-semibold">참가자 등록</h2>
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
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3" data-testid="roster">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="참가자 닉네임"
          disabled={ended}
          className="h-8 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 outline-none disabled:opacity-50"
        />
        <button
          onClick={() => void add()}
          disabled={ended || action.busy}
          className="rounded bg-amber-500 px-3 text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          등록
        </button>
        <span className="self-center text-xs text-zinc-500">총 {players.length}명</span>
      </div>
      <GmErrorBanner message={action.error} onClose={action.clearError} />
      <GmNoticeBanner message={action.notice} />
      <div className="flex flex-wrap gap-1.5">
        {players.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs"
          >
            {p.nickname}
            {!ended && (
              <button
                onClick={() => setKick(p)}
                aria-label={`${p.nickname} 삭제`}
                className="text-zinc-500 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {players.length === 0 && (
          <span className="text-xs text-zinc-600">등록된 참가자 없음</span>
        )}
      </div>

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
