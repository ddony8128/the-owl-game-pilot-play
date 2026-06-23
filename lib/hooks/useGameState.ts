"use client";

import { useEffect, useState } from "react";
import type { GameState, RulesState } from "@/lib/types";

// 방(room) 단위 게임 상태. room 이 없으면 유휴 상태.
export function useGameState(room: string | null) {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [rulesMap, setRulesMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/state/game?room=${encodeURIComponent(room)}`,
        );
        if (!res.ok) throw new Error("게임 상태를 불러오지 못했습니다.");
        const json = (await res.json()) as {
          gameState: GameState | null;
          rules: RulesState[];
        };
        if (cancelled) return;

        setActiveGame(json.gameState?.active_game ?? null);
        const map: Record<string, boolean> = {};
        for (const row of json.rules || []) map[row.rule_key] = row.is_open;
        setRulesMap(map);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "게임 상태를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room]);

  return { activeGame, rulesMap, isLoading, error } as const;
}
