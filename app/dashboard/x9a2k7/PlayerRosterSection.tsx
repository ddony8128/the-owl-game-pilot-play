"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { useGmAction } from "@/lib/hooks/useGmAction";

type RosterPlayer = { id: string; nickname: string };

// 참가자 관리 페이지의 명단(bluecode674 포크 구성). 삭제는 우리 확인창(강퇴 안내)·useGmAction(잠금·배너·멱등 키)을 거친다.
//  참가자는 스스로 입장하므로 이 화면은 미리 등록·오타 수정·강퇴용이다.
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
  const [kick, setKick] = useState<RosterPlayer | null>(null);
  const action = useGmAction();

  const add = async () => {
    const nickname = name.trim();
    if (!nickname) return;
    const r = await action.run<{ player?: RosterPlayer }>("/api/gm/players", { body: { room, nickname } });
    if (r?.ok && r.json.player) {
      setName("");
      onAdded(r.json.player);
    }
  };

  const remove = async (p: RosterPlayer) => {
    const r = await action.run("/api/gm/players", { method: "DELETE", body: { id: p.id } }, { notice: `${p.nickname} 삭제됨` });
    if (r?.ok) onRemoved(p.id);
  };

  return (
    <div className="mt-4 space-y-5">
      <div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 sm:p-4">
        <label htmlFor="player-nickname" className="mb-2 block text-xs font-bold text-zinc-400">
          참가자 미리 등록
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="player-nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void add()}
            placeholder="닉네임을 입력하세요"
            maxLength={24}
            className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-base outline-none transition placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10"
          />
          <button
            type="button"
            disabled={action.busy || !name.trim()}
            onClick={() => void add()}
            className="min-h-12 rounded-lg bg-amber-500 px-6 font-bold text-zinc-950 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action.busy ? "처리 중…" : "+ 참가자 추가"}
          </button>
        </div>
      </div>
      <GmErrorBanner message={action.error} onClose={action.clearError} />
      <GmNoticeBanner message={action.notice} />

      {players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-500">
            ♟
          </div>
          <p className="font-semibold text-zinc-400">아직 참가자가 없습니다</p>
          <p className="mt-1 text-xs text-zinc-600">참가자가 방 코드와 닉네임으로 입장하면 여기에 나타납니다.</p>
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
                  disabled={action.busy}
                  onClick={() => setKick(player)}
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
