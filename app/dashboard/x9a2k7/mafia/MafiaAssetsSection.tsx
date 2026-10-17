"use client";

import { useState } from "react";
import type { MafiaPlayerState, MafiaStockState } from "@/lib/types";

type Props = {
  players: MafiaPlayerState[];
  playerNames: Record<string, string>;
  stocks: MafiaStockState[];
  /** 현금·주식 ±1 수동 보정(Iteration 5). 없으면 조회 전용. */
  onAdjust?: (playerId: string, kind: "cash" | "stock", delta: 1 | -1, stockKey?: string) => Promise<void>;
  disabled?: boolean;
};

export function MafiaAssetsSection({ players, playerNames, stocks, onAdjust, disabled = false }: Props) {
  const priceByStock = new Map<string, number>();
  for (const s of stocks) {
    priceByStock.set(s.stock_key, s.price);
  }
  const stockKeys = stocks.map((s) => s.stock_key);
  const [pickedStock, setPickedStock] = useState<Record<string, string>>({});

  const computeHoldingsAndTotal = (p: MafiaPlayerState) => {
    const rawStocks = (p as unknown as { stocks?: unknown }).stocks;
    const holdings: {
      stock_key: string;
      amount: number;
      price: number;
      value: number;
    }[] = [];

    if (rawStocks && typeof rawStocks === "object") {
      const obj = rawStocks as Record<string, { amount?: number }>;
      for (const [stockKey, info] of Object.entries(obj)) {
        const amount =
          info && typeof info.amount === "number" ? info.amount : 0;
        if (amount <= 0) continue;
        const price = priceByStock.get(stockKey) ?? 0;
        const value = amount * price;
        holdings.push({ stock_key: stockKey, amount, price, value });
      }
    }

    const holdingsValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalAssets = p.cash + holdingsValue;
    return { holdings, holdingsValue, totalAssets };
  };

  const sorted = [...players].sort((a, b) =>
    (playerNames[a.player_id] ?? "").localeCompare(playerNames[b.player_id] ?? ""),
  );

  return (
    <section className="space-y-2 text-sm" data-testid="mafia-assets">
      <h2 className="text-base font-semibold">자산 현황</h2>
      {onAdjust && players.length > 0 && (
        <p className="text-xs text-zinc-500">현금·보유 주식을 ±1 씩 수동 보정할 수 있습니다(예외 처리용). 보정 내용은 GM 조작 기록에 남습니다.</p>
      )}
      {players.length === 0 ? (
        <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <p className="text-zinc-300">
            자산은 직업 경매가 시작될 때 생성됩니다.
          </p>
          <p className="text-zinc-400">
            {Object.keys(playerNames).length > 0
              ? `등록 인원 ${Object.keys(playerNames).length}명: ${Object.values(playerNames).join(", ")}`
              : "아직 등록된 플레이어가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((p) => {
            const name = playerNames[p.player_id] ?? "(이름 없음)";
            const { holdings, holdingsValue, totalAssets } =
              computeHoldingsAndTotal(p);
            const picked = pickedStock[p.player_id] ?? stockKeys[0] ?? "";
            return (
              <div
                key={p.player_id}
                className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm"
                data-testid={`asset-card-${name}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      직업:{" "}
                      <span className="font-semibold">
                        {p.job ?? "미배정(월급쟁이)"}
                      </span>
                    </p>
                    <p>
                      마피아:{" "}
                      <span className="font-semibold">
                        {p.is_mafia ? "예" : "아니오"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-zinc-950 px-2 py-1.5">
                  <p className="flex items-center justify-between text-sm text-zinc-300">
                    <span>현금</span>
                    <span className="flex items-center gap-1">
                      {onAdjust && (
                        <button
                          type="button"
                          aria-label={`${name} 현금 -1`}
                          disabled={disabled}
                          className="h-6 w-6 rounded-full bg-zinc-800 text-xs font-bold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                          onClick={() => void onAdjust(p.player_id, "cash", -1)}
                        >
                          −
                        </button>
                      )}
                      <span className="w-14 text-center font-semibold" data-testid="asset-cash">{p.cash}원</span>
                      {onAdjust && (
                        <button
                          type="button"
                          aria-label={`${name} 현금 +1`}
                          disabled={disabled}
                          className="h-6 w-6 rounded-full bg-amber-400 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                          onClick={() => void onAdjust(p.player_id, "cash", 1)}
                        >
                          +
                        </button>
                      )}
                    </span>
                  </p>
                  <p className="mt-1 flex justify-between text-sm text-zinc-300">
                    <span>주식 평가액</span>
                    <span className="font-semibold">{holdingsValue}원</span>
                  </p>
                  <p className="mt-1 flex justify-between text-sm text-amber-300">
                    <span>총 자산</span>
                    <span className="font-semibold">{totalAssets}원</span>
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-sm text-zinc-400">보유 주식</p>
                  {holdings.length === 0 ? (
                    <p className="text-sm text-zinc-600">
                      보유한 주식이 없습니다.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950">
                      <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-zinc-900">
                          <tr>
                            <th className="px-2 py-1 text-left">종목</th>
                            <th className="px-2 py-1 text-right">수량</th>
                            <th className="px-2 py-1 text-right">현재가</th>
                            <th className="px-2 py-1 text-right">평가금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((h) => (
                            <tr
                              key={h.stock_key}
                              className="border-t border-zinc-800"
                            >
                              <td className="px-2 py-1">{h.stock_key}</td>
                              <td className="px-2 py-1 text-right" data-testid={`asset-stock-${h.stock_key}`}>
                                {h.amount}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {h.price}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {h.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {onAdjust && stockKeys.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs">
                      <span className="text-zinc-500">주식 보정</span>
                      <select
                        aria-label={`${name} 보정 종목`}
                        value={picked}
                        disabled={disabled}
                        onChange={(e) => setPickedStock((m) => ({ ...m, [p.player_id]: e.target.value }))}
                        className="h-6 rounded border border-zinc-700 bg-zinc-950 px-1 text-xs text-zinc-100"
                      >
                        {stockKeys.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`${name} ${picked} -1주`}
                        disabled={disabled || !picked}
                        className="rounded bg-zinc-800 px-2 py-0.5 font-bold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                        onClick={() => void onAdjust(p.player_id, "stock", -1, picked)}
                      >
                        −1주
                      </button>
                      <button
                        type="button"
                        aria-label={`${name} ${picked} +1주`}
                        disabled={disabled || !picked}
                        className="rounded bg-amber-400 px-2 py-0.5 font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                        onClick={() => void onAdjust(p.player_id, "stock", 1, picked)}
                      >
                        +1주
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
