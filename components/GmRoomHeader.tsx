"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import type { GmActionApi } from "@/lib/hooks/useGmAction";

// 게임 대시보드 상단 고정 헤더(bluecode674 포크 구성) — 방 코드·참가자 수·재연결 배지·새로고침·참가 QR·게임 종료·보드.
//  게임 종료는 window.confirm 대신 우리 확인창(400ms 잠금)과 useGmAction(잠금·배너·멱등 키)을 거친다.
export function GmRoomHeader({
  eyebrow,
  eyebrowClass,
  room,
  playerCount,
  failures,
  boardHref,
  ended,
  action,
  onReload,
}: {
  eyebrow: string;
  eyebrowClass: string;
  room: string;
  playerCount: number;
  failures: number;
  boardHref: string;
  ended: boolean;
  action: GmActionApi;
  onReload: () => void | Promise<void>;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);

  const endGame = async () => {
    const r = await action.run(
      "/api/gm/rooms",
      { method: "PATCH", body: { code: room, status: "ended", ended_normally: true } },
      { notice: "방을 종료했습니다. 방 관리로 이동합니다." },
    );
    if (r?.ok) window.location.href = "/dashboard/x9a2k7";
  };

  return (
    <div className="sticky top-16 z-30 -mx-3 flex flex-wrap items-center gap-3 border-b border-zinc-700 bg-zinc-950/95 px-3 py-3 shadow-xl shadow-black/20 backdrop-blur xl:top-0">
      <div>
        <p className={`text-xs font-bold tracking-[0.18em] ${eyebrowClass}`}>{eyebrow}</p>
        <p className="mt-0.5 text-xl font-black text-white">
          게임 진행실{" "}
          <b className="ml-2 rounded-md bg-zinc-800 px-2 py-1 font-mono text-base text-amber-300">{room}</b>
        </p>
      </div>
      <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">
        ● 참가자 {playerCount}명
      </span>
      <ConnectionBadge failures={failures} />
      <button
        type="button"
        onClick={() => void onReload()}
        className="ml-auto min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-200 hover:bg-zinc-800"
        title="참가자 제출·점수·자산·기록을 지금 다시 불러옵니다(평소에도 몇 초마다 자동 갱신)."
      >
        ↻ 현황 새로고침
      </button>
      {!ended && (
        <button
          type="button"
          onClick={() => window.open(`/join?code=${room}`, "owl-join", "width=720,height=900")}
          title="참가 QR과 방 코드를 새 창에 크게 띄웁니다 (입장·중간 합류·재접속용)"
          data-testid="join-qr-open"
          className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-amber-300 hover:bg-zinc-800"
        >
          📲 참가 QR
        </button>
      )}
      {!ended && (
        <button
          type="button"
          onClick={() => setConfirmEnd(true)}
          disabled={action.busy}
          data-testid="end-game"
          className="min-h-11 rounded-xl border border-red-500/60 bg-red-950/40 px-4 text-sm font-black text-red-200 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ■ 게임 종료
        </button>
      )}
      <a
        href={boardHref}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-11 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-amber-300"
      >
        보드 ↗
      </a>

      <ConfirmDialog
        open={confirmEnd}
        title={`방 ${room} 종료`}
        confirmLabel="종료"
        danger
        busy={action.busy}
        onClose={() => setConfirmEnd(false)}
        onConfirm={async () => {
          setConfirmEnd(false);
          await endGame();
        }}
      >
        <p className="text-zinc-300">
          종료하면 이 방의 라운드·페이즈·점수·타이머 조작이 모두 막히고(읽기 전용) 참가자도 더 행동할 수 없습니다. 기록은 보존됩니다.
          다시 진행하려면 새 방을 만들어야 합니다.
        </p>
      </ConfirmDialog>
    </div>
  );
}
