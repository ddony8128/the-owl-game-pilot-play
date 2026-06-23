"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MafiaPlayerState,
  MafiaStockState,
  MafiaPhaseState,
} from "@/lib/types";

type StateResponse = {
  phase: MafiaPhaseState | null;
  stocks: MafiaStockState[];
  players: MafiaPlayerState[];
  playerNames?: Record<string, string>;
  error?: undefined;
};

type Ranked = {
  playerId: string;
  name: string;
  cash: number;
  holdingsValue: number;
  totalAssets: number;
  isMafia: boolean;
  job: string | null;
};

function computeRanked(
  players: MafiaPlayerState[],
  stocks: MafiaStockState[],
  names: Record<string, string>
): Ranked[] {
  const priceByStock = new Map<string, number>();
  for (const s of stocks) priceByStock.set(s.stock_key, s.price);

  const rows: Ranked[] = players.map((p) => {
    const rawStocks = (p as unknown as { stocks?: unknown }).stocks;
    let holdingsValue = 0;
    if (rawStocks && typeof rawStocks === "object") {
      const obj = rawStocks as Record<string, { amount?: number }>;
      for (const [stockKey, info] of Object.entries(obj)) {
        const amount =
          info && typeof info.amount === "number" ? info.amount : 0;
        if (amount <= 0) continue;
        holdingsValue += amount * (priceByStock.get(stockKey) ?? 0);
      }
    }
    return {
      playerId: p.player_id,
      name: names[p.player_id] ?? "(이름 없음)",
      cash: p.cash,
      holdingsValue,
      totalAssets: p.cash + holdingsValue,
      isMafia: p.is_mafia,
      job: p.job ?? null,
    };
  });

  return rows.sort((a, b) => b.totalAssets - a.totalAssets);
}

const RANK_ACCENT = ["text-amber-300", "text-zinc-200", "text-orange-400"];

export function MafiaBoardClient() {
  const [room] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("room")
      : null
  );
  const [roomInput, setRoomInput] = useState("");
  const [players, setPlayers] = useState<MafiaPlayerState[]>([]);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [revealMafia, setRevealMafia] = useState(false);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/mafia/state?all=1&room=${encodeURIComponent(room)}`
        );
        const json = (await res.json().catch(() => null)) as
          | StateResponse
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "마피아 상태를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setPlayers(json.players ?? []);
        setStocks(json.stocks ?? []);
        setNames(json.playerNames ?? {});
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "마피아 상태를 불러오지 못했습니다."
          );
        }
      }
    };
    void load();
    const interval = setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [room]);

  const ranked = useMemo(
    () => computeRanked(players, stocks, names),
    [players, stocks, names]
  );

  if (!room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-8 text-zinc-50">
        <p className="text-2xl">결과 페이지 — 방 코드가 필요합니다.</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const code = roomInput.trim().toUpperCase();
            if (code) {
              window.location.search = `?room=${encodeURIComponent(code)}`;
            }
          }}
        >
          <input
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base outline-none focus:border-zinc-400"
            placeholder="방 코드"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-amber-400 px-4 text-base font-semibold text-zinc-950 hover:bg-amber-300"
          >
            이동
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-8 py-8 text-zinc-50">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">
          자본주의 마피아 — 최종 순위
        </h1>
        <button
          type="button"
          onClick={() => setRevealMafia((v) => !v)}
          className="rounded-lg border border-red-500/50 px-4 py-2 text-lg font-semibold text-red-300 hover:bg-red-500/10"
        >
          {revealMafia ? "마피아 숨기기" : "마피아 공개"}
        </button>
      </header>

      {error && (
        <p className="mb-4 text-xl text-red-400">불러오기 오류: {error}</p>
      )}

      {ranked.length === 0 ? (
        <p className="text-2xl text-zinc-400">아직 플레이어 데이터가 없습니다.</p>
      ) : (
        <ol className="space-y-3">
          {ranked.map((r, i) => (
            <li
              key={r.playerId}
              className={`flex items-center justify-between rounded-2xl border bg-zinc-900 px-6 py-4 ${
                revealMafia && r.isMafia
                  ? "border-red-500/70 bg-red-950/40"
                  : "border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-6">
                <span
                  className={`w-14 text-center text-4xl font-black ${
                    RANK_ACCENT[i] ?? "text-zinc-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-3xl font-bold">
                    {r.name}
                    {revealMafia && r.isMafia && (
                      <span className="ml-3 rounded bg-red-600 px-2 py-0.5 text-lg font-semibold text-white">
                        마피아
                      </span>
                    )}
                  </p>
                  {r.job && (
                    <p className="mt-1 text-lg text-zinc-400">{r.job}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-amber-300">
                  {r.totalAssets.toLocaleString()}원
                </p>
                <p className="mt-1 text-base text-zinc-400">
                  현금 {r.cash.toLocaleString()} · 주식{" "}
                  {r.holdingsValue.toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
