"use client";

import { useState } from "react";
import type { MafiaPlayerState, MafiaStockState } from "@/lib/types";

type Props = {
  players: MafiaPlayerState[];
  playerNames: Record<string, string>;
  stocks: MafiaStockState[];
};

type PlayerAsset = {
  player: MafiaPlayerState | null;
  playerId: string;
  name: string;
  holdings: { stockKey: string; amount: number; price: number; value: number }[];
  holdingsValue: number;
  totalAssets: number | null;
};

const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function MafiaAssetsSection({ players, playerNames, stocks }: Props) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const priceByStock = new Map(stocks.map((stock) => [stock.stock_key, stock.price]));

  const playerById = new Map(players.map((player) => [player.player_id, player]));
  const allPlayerIds = Array.from(new Set([...Object.keys(playerNames), ...players.map((player) => player.player_id)]));
  const rows: PlayerAsset[] = allPlayerIds
    .map((playerId) => {
      const player = playerById.get(playerId) ?? null;
      const rawStocks = player
        ? (player as unknown as { stocks?: unknown }).stocks
        : null;
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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
        <p className="font-semibold text-zinc-300">자산은 직업 경매가 시작될 때 생성됩니다.</p>
        <p className="mt-1 text-zinc-500">
          {Object.keys(playerNames).length > 0
            ? `현재 등록된 참가자 ${Object.keys(playerNames).length}명`
            : "아직 등록된 참가자가 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[64px_minmax(150px,1.3fr)_120px_130px_130px_minmax(140px,1fr)_110px] items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-bold text-zinc-400">
            <span className="text-center">순번</span>
            <span>플레이어명</span>
            <span className="text-right">현금</span>
            <span className="text-right">주식 평가액</span>
            <span className="text-right text-amber-300">총자산</span>
            <span>직업</span>
            <span className="text-center">보유 주식</span>
          </div>

          {rows.map((row, index) => {
            const expanded = expandedPlayerId === row.playerId;
            return (
              <div key={row.playerId} className="border-b border-zinc-800 last:border-b-0">
                <div className={`grid grid-cols-[64px_minmax(150px,1.3fr)_120px_130px_130px_minmax(140px,1fr)_110px] items-center gap-3 px-4 py-3 transition ${expanded ? "bg-amber-500/5" : "hover:bg-zinc-900/70"}`}>
                  <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-black ${index < 3 ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{index + 1}</span>
                  <span className="truncate text-base font-bold text-white">{row.name}</span>
                  <span className="text-right font-mono tabular-nums text-zinc-200">{row.player ? money(row.player.cash) : "-"}</span>
                  <span className="text-right font-mono tabular-nums text-zinc-200">{row.player ? money(row.holdingsValue) : "-"}</span>
                  <span className="text-right font-mono text-base font-black tabular-nums text-amber-300">{row.totalAssets == null ? "-" : money(row.totalAssets)}</span>
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-zinc-200">{row.player?.job ?? "미배정"}</span>
                    {row.player?.is_mafia && <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-black text-red-300">M</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedPlayerId(expanded ? null : row.playerId)}
                    disabled={!row.player}
                    className="min-h-9 rounded-lg bg-zinc-800 px-3 text-xs font-bold text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {!row.player ? "준비 전" : expanded ? "접기 ▲" : `${row.holdings.length}종 보기 ▼`}
                  </button>
                </div>

                {expanded && (
                  <div className="bg-zinc-900/70 px-6 py-4">
                    {row.holdings.length === 0 ? (
                      <p className="text-center text-sm text-zinc-500">보유한 주식이 없습니다.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {row.holdings.map((holding) => (
                          <div key={holding.stockKey} className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <b className="text-zinc-100">{holding.stockKey}</b>
                              <b className="text-emerald-300">{holding.amount}주</b>
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-zinc-500">
                              <span>현재가 {money(holding.price)}</span>
                              <span>평가 {money(holding.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-500">화면이 좁으면 표를 좌우로 밀어서 확인할 수 있습니다.</p>
    </section>
  );
}
