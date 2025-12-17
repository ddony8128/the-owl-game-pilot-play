"use client";

import type {
  MafiaLog,
  MafiaPlayerState,
  MafiaStockState,
  MafiaStocksHolding,
} from "@/lib/types";

type Props = {
  mafiaPlayer: MafiaPlayerState | null;
  stocks: MafiaStockState[];
  logs: MafiaLog[];
};

export function MafiaInfoTab({ mafiaPlayer, stocks, logs }: Props) {
  const holdings: MafiaStocksHolding =
    (mafiaPlayer?.stocks as MafiaStocksHolding | null) ?? {};

  const priceByKey = new Map<string, number>();
  for (const s of stocks) {
    priceByKey.set(s.stock_key, s.price);
  }

  const rows =
    holdings && typeof holdings === "object"
      ? Object.entries(holdings)
      : ([] as [string, { amount: number }][]);

  let totalStockValue = 0;
  const stockRows = rows.map(([key, info]) => {
    const amount = typeof info.amount === "number" ? info.amount : 0;
    const price = priceByKey.get(key) ?? 0;
    const value = amount * price;
    totalStockValue += value;
    return { key, amount, price, value };
  });

  const cash = mafiaPlayer?.cash ?? 0;
  const totalAsset = cash + totalStockValue;

  return (
    <div className="flex flex-col gap-4 text-sm text-zinc-100">
      <section className="space-y-2">
        <p className="text-xs text-zinc-400">당신의 현재 상태입니다.</p>
        <div className="rounded-xl bg-zinc-900 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">보유 현금</span>
            <span className="font-semibold text-amber-300">{cash} 코인</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>직업</span>
            <span>{mafiaPlayer?.job ?? "(비공개)"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>총 자산(현금 + 주식 평가액)</span>
            <span className="font-semibold text-emerald-300">
              {totalAsset} 코인
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs text-zinc-400">보유 주식과 평가 금액입니다.</p>
        <div className="divide-y divide-zinc-800 rounded-xl bg-zinc-900">
          {stockRows.length === 0 && (
            <p className="px-3 py-4 text-xs text-zinc-400">
              아직 보유한 주식이 없습니다.
            </p>
          )}
          {stockRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <div className="flex flex-col">
                <span className="text-sm text-zinc-100">{row.key}</span>
                <span className="text-[11px] text-zinc-400">
                  수량 {row.amount}개 · 현재가 {row.price} 코인
                </span>
              </div>
              <span className="text-sm font-semibold text-emerald-300">
                {row.value} 코인
              </span>
            </div>
          ))}
          {stockRows.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-[11px] text-zinc-400">
                주식 평가액 합계
              </span>
              <span className="text-sm font-semibold text-emerald-300">
                {totalStockValue} 코인
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs text-zinc-400">GM이 공개한 게임 로그입니다.</p>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
            >
              {log.content}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-xs text-zinc-400">
              아직 공개된 로그가 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
