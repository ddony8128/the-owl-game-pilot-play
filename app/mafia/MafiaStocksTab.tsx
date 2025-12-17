"use client";

import type { MafiaStockState } from "@/lib/types";

type Props = {
  stocks: MafiaStockState[];
};

export function MafiaStocksTab({ stocks }: Props) {
  return (
    <div className="space-y-2 text-sm text-zinc-100">
      <p className="text-xs text-zinc-400">현재 공개된 주가입니다.</p>
      <div className="divide-y divide-zinc-800 rounded-xl bg-zinc-900">
        {stocks.map((s) => (
          <div
            key={s.stock_key}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className="capitalize text-zinc-200">{s.stock_key}</span>
            <span className="font-semibold text-emerald-300">
              {s.price} 코인
            </span>
          </div>
        ))}
        {stocks.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-400">
            아직 공개된 주가 정보가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
