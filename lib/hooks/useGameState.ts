"use client";

import { useEffect, useState } from "react";
import type { GameState, RulesState } from "@/lib/types";

export function useGameState() {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [rulesMap, setRulesMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/state/game");
        if (!res.ok) {
          throw new Error("게임 상태를 불러오지 못했습니다.");
        }
        const json = (await res.json()) as {
          gameState: GameState | null;
          rules: RulesState[];
        };

        if (cancelled) return;

        const g = json.gameState;
        const r = json.rules || [];
        setActiveGame(g?.active_game ?? null);
        const map: Record<string, boolean> = {};
        for (const row of r) {
          map[row.rule_key] = row.is_open;
        }
        setRulesMap(map);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "게임 상태를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { activeGame, rulesMap, isLoading, error } as const;
}
