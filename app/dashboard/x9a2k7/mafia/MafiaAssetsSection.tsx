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

type PlayerAsset = {
  player: MafiaPlayerState | null;
  playerId: string;
  name: string;
  holdings: { stockKey: string; amount: number; price: number; value: number }[];
  holdingsValue: number;
  totalAssets: number | null;
};

// 자산 현황 — 총자산 순위표(bluecode674 포크 구성)에 우리 ±1 수동 보정(멱등 API·GM 조작 기록)을 얹었다.
//  보유 주식은 접지 않고 항상 보인다(보정 결과를 바로 확인).
export function MafiaAssetsSection({ players, playerNames, stocks, onAdjust, disabled = false }: Props) {
  const priceByStock = new Map(stocks.map((stock) => [stock.stock_key, stock.price]));
  const stockKeys = stocks.map((s) => s.stock_key);
  const [pickedStock, setPickedStock] = useState<Record<string, string>>({});

  const playerById = new Map(players.map((player) => [player.player_id, player]));
  const allPlayerIds = Array.from(new Set([...Object.keys(playerNames), ...players.map((player) => player.player_id)]));
  const rows: PlayerAsset[] = allPlayerIds
    .map((playerId) => {
      const player = playerById.get(playerId) ?? null;
      const rawStocks = player ? (player as unknown as { stocks?: unknown }).stocks : null;
      const holdings: PlayerAsset["holdings"] = [];
      if (rawStocks && typeof rawStocks === "object") {
        for (const [stockKey, info] of Object.entries(rawStocks as Record<string, { amount?: number }>)) {
          const amount = typeof info?.amount === "number" ? info.amount : 0;
          if (amount <= 0) continue;
          const price = priceByStock.get(stockKey) ?? 0;
          holdings.push({ stockKey, amount, price, value: amount * price });
        }
      }
      const holdingsValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
      return {
        player,
        playerId,
        name: playerNames[playerId] ?? "(이름 없음)",
        holdings,
        holdingsValue,
        totalAssets: player ? player.cash + holdingsValue : null,
      };
    })
    .sort((a, b) => (b.totalAssets ?? -1) - (a.totalAssets ?? -1) || a.name.localeCompare(b.name));

  return (
    <section className="space-y-2 text-sm" data-testid="mafia-assets">
      {players.length === 0 ? (
        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
          <p className="font-semibold text-zinc-300">자산은 직업 경매가 시작될 때 생성됩니다.</p>
          <p className="text-zinc-500">
            {Object.keys(playerNames).length > 0
              ? `등록 인원 ${Object.keys(playerNames).length}명: ${Object.values(playerNames).join(", ")}`
              : "아직 등록된 플레이어가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-[56px_minmax(140px,1.2fr)_200px_120px_130px_minmax(130px,1fr)_minmax(260px,1.4fr)] items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-bold text-zinc-400">
                <span className="text-center">순번</span>
                <span>플레이어명</span>
                <span className="text-center">현금</span>
                <span className="text-right">주식 평가액</span>
                <span className="text-right text-amber-300">총자산</span>
                <span>직업</span>
                <span>보유 주식</span>
              </div>

              {rows.map((row, index) => {
                const picked = pickedStock[row.playerId] ?? stockKeys[0] ?? "";
                const p = row.player;
                return (
                  <div
                    key={row.playerId}
                    className="grid grid-cols-[56px_minmax(140px,1.2fr)_200px_120px_130px_minmax(130px,1fr)_minmax(260px,1.4fr)] items-center gap-3 border-b border-zinc-800 px-4 py-3 last:border-b-0 hover:bg-zinc-900/70"
                    data-testid={`asset-card-${row.name}`}
                  >
                    <span
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-black ${
                        index < 3 ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-base font-bold text-white">{row.name}</span>

                    <span className="flex items-center justify-center gap-1">
                      {onAdjust && p && (
                        <button
                          type="button"
                          aria-label={`${row.name} 현금 -1`}
                          disabled={disabled}
                          className="h-7 w-7 rounded-full bg-zinc-800 text-xs font-bold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                          onClick={() => void onAdjust(row.playerId, "cash", -1)}
                        >
                          −
                        </button>
                      )}
                      <span className="w-16 text-center font-mono font-semibold tabular-nums text-zinc-100" data-testid="asset-cash">
                        {p ? `${p.cash}원` : "-"}
                      </span>
                      {onAdjust && p && (
                        <button
                          type="button"
                          aria-label={`${row.name} 현금 +1`}
                          disabled={disabled}
                          className="h-7 w-7 rounded-full bg-amber-400 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                          onClick={() => void onAdjust(row.playerId, "cash", 1)}
                        >
                          +
                        </button>
                      )}
                    </span>
                    <span className="text-right font-mono tabular-nums text-zinc-200">{p ? `${row.holdingsValue}원` : "-"}</span>
                    <span className="text-right font-mono text-base font-black tabular-nums text-amber-300">
                      {row.totalAssets == null ? "-" : `${row.totalAssets}원`}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-zinc-200">{p?.job ?? (p ? "미배정(월급쟁이)" : "준비 전")}</span>
                      {p?.is_mafia && (
                        <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-black text-red-300" title="마피아">
                          M
                        </span>
                      )}
                    </span>

                    <div className="space-y-1.5">
                      {row.holdings.length === 0 ? (
                        <p className="text-xs text-zinc-600">보유한 주식이 없습니다.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.holdings.map((h) => (
                            <span
                              key={h.stockKey}
                              className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                              title={`현재가 ${h.price}원 · 평가 ${h.value}원`}
                            >
                              <b>{h.stockKey}</b>
                              <span className="font-mono text-emerald-300" data-testid={`asset-stock-${h.stockKey}`}>
                                {h.amount}
                              </span>
                              주
                            </span>
                          ))}
                        </div>
                      )}
                      {onAdjust && p && stockKeys.length > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-zinc-500">주식 보정</span>
                          <select
                            aria-label={`${row.name} 보정 종목`}
                            value={picked}
                            disabled={disabled}
                            onChange={(e) => setPickedStock((m) => ({ ...m, [row.playerId]: e.target.value }))}
                            className="h-7 rounded border border-zinc-700 bg-zinc-950 px-1 text-xs text-zinc-100"
                          >
                            {stockKeys.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            aria-label={`${row.name} ${picked} -1주`}
                            disabled={disabled || !picked}
                            className="rounded bg-zinc-800 px-2 py-1 font-bold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                            onClick={() => void onAdjust(row.playerId, "stock", -1, picked)}
                          >
                            −1주
                          </button>
                          <button
                            type="button"
                            aria-label={`${row.name} ${picked} +1주`}
                            disabled={disabled || !picked}
                            className="rounded bg-amber-400 px-2 py-1 font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                            onClick={() => void onAdjust(row.playerId, "stock", 1, picked)}
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
          </div>
          <p className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500">화면이 좁으면 표를 좌우로 밀어서 확인할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}
