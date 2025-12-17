"use client";

import type { MafiaPlayerState } from "@/lib/types";

type Props = {
  mafiaPlayer: MafiaPlayerState | null;
};

export function MafiaInfoTab({ mafiaPlayer }: Props) {
  return (
    <div className="flex flex-col gap-2 text-sm text-zinc-100">
      <p className="text-xs text-zinc-400">당신의 현재 상태입니다.</p>
      <div className="rounded-xl bg-zinc-900 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">보유 현금</span>
          <span className="font-semibold text-amber-300">
            {mafiaPlayer?.cash ?? 0} 코인
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
          <span>직업</span>
          <span>{mafiaPlayer?.job ?? "(비공개)"}</span>
        </div>
      </div>
    </div>
  );
}
