"use client";

import Image from "next/image";
import type { MafiaStockState } from "@/lib/types";

type StockHistoryEntry = {
  round_number: number;
  price_before: number | null;
  price_after: number | null;
};

type Props = {
  stocks: MafiaStockState[];
  stockHistory: Record<string, StockHistoryEntry[]> | null;
};

const getStockLogoSrc = (key: string): string | null => {
  switch (key) {
    case "부엉교육":
      return "/mafia/company/edu.png";
    case "번쩍전기":
      return "/mafia/company/electricity.png";
    case "국채":
      return "/mafia/company/owl_flag.png";
    case "이상교통":
      return "/mafia/company/vehicle.png";
    default:
      return null;
  }
};

export function MafiaStocksTab({ stocks, stockHistory }: Props) {
  return (
    <div className="space-y-4 text-base text-zinc-100">
      <section className="space-y-2">
        <div className="divide-y divide-zinc-800 rounded-xl bg-zinc-900">
          {stocks.map((s) => (
            <div
              key={s.stock_key}
              className="flex items-center justify-between px-5 py-5 text-base"
            >
              <div className="flex items-center gap-2">
                {getStockLogoSrc(s.stock_key) && (
                  <div className="relative h-30 w-30 overflow-hidden rounded-md bg-zinc-800">
                    <Image
                      src={getStockLogoSrc(s.stock_key)!}
                      alt={s.stock_key}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <span className="text-zinc-200">{s.stock_key}</span>
              </div>
              <span className="font-semibold text-2xl text-emerald-300">
                {s.price} 코인
              </span>
            </div>
          ))}
          {stocks.length === 0 && (
            <p className="px-3 py-4 text-base text-zinc-400">
              아직 공개된 주가 정보가 없습니다.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm text-zinc-400">
          각 종목의 라운드별 주가 변동 히스토리입니다.
        </p>
        <div className="space-y-2 text-base text-zinc-300">
          {stocks.map((s) => {
            const history = stockHistory?.[s.stock_key] ?? [];
            if (history.length === 0) {
              return (
                <div key={s.stock_key}>
                  <span className="font-semibold text-zinc-100">
                    {s.stock_key}
                  </span>
                  <span className="ml-2 text-zinc-400">
                    아직 주가 변동이 없습니다.
                  </span>
                </div>
              );
            }

            const first = history[0];
            const initial =
              first.price_before ?? first.price_after ?? s.price ?? 0;

            const parts: string[] = [];
            parts.push(`초기: ${initial}원`);
            for (const h of history) {
              const roundLabel =
                h.round_number === 0
                  ? "튜토리얼 종료"
                  : `${h.round_number}라운드 종료`;
              const after =
                h.price_after ?? h.price_before ?? initial ?? s.price ?? 0;
              parts.push(`${roundLabel}: ${after}원`);
            }

            return (
              <div key={s.stock_key}>
                <span className="font-semibold text-zinc-100">
                  {s.stock_key}
                </span>
                <span className="ml-2 text-zinc-300">{parts.join(", ")}</span>
              </div>
            );
          })}
          {stocks.length === 0 && (
            <p className="text-xs text-zinc-400">
              종목이 없어서 히스토리를 표시할 수 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
