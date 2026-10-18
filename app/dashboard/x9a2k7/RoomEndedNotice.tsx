"use client";

import { useEffect, useState } from "react";

// 방 상태(active/ended)를 한 번 조회한다. 조회 실패·미존재는 null(배지 없음).
export function useRoomStatus(room: string | null): "active" | "ended" | null {
  const [status, setStatus] = useState<"active" | "ended" | null>(null);
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/gm/rooms?code=${encodeURIComponent(room)}`);
        const json = (await res.json().catch(() => null)) as {
          room?: { status?: "active" | "ended" } | null;
        } | null;
        if (!cancelled) setStatus(json?.room?.status ?? null);
      } catch {
        /* 배지 표시용이라 실패는 무시 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room]);
  return status;
}

export function RoomEndedBadge() {
  return (
    <span
      data-testid="room-ended-badge"
      className="rounded bg-red-900/70 px-2 py-0.5 text-xs font-semibold text-red-200"
    >
      종료됨
    </span>
  );
}

// 대시보드 상단 안내: 종료된 방은 기록 확인용으로만 쓴다.
export function RoomEndedNotice({ room }: { room: string }) {
  const status = useRoomStatus(room);
  if (status !== "ended") return null;
  return (
    <div
      data-testid="room-ended-notice"
      className="flex items-center gap-2 rounded border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200"
    >
      <RoomEndedBadge />
      <span>
        종료된 방입니다. 기록 확인용으로만 보세요. 게임을 다시 진행하려면 방 관리에서 새 방을 만드세요.
      </span>
    </div>
  );
}
