import { useEffect, useState } from "react";
import type { GameState, Player, RulesState } from "@/lib/types";

type MainState = {
  gameState: GameState | null;
  rules: RulesState[];
  players: (Player & { feather?: number | null })[];
  loading: boolean;
  error: string | null;
  changeGame: (value: GameState["active_game"]) => Promise<void>;
  toggleRule: (ruleKey: string, isOpen: boolean) => Promise<void>;
  updateFeather: (playerId: string, delta: -1 | 1) => Promise<void>;
  clearError: () => void;
};

export function useDashboardMainState(): MainState {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rules, setRules] = useState<RulesState[]>([]);
  const [players, setPlayers] = useState<
    (Player & { feather?: number | null })[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gm/main-state");
        const json = (await res.json().catch(() => null)) as
          | {
              game: GameState | null;
              rules: RulesState[];
              players: (Player & { feather?: number | null })[];
              error?: undefined;
            }
          | { error: string }
          | null;

        if (cancelled) return;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "대시보드 정보를 불러오지 못했습니다."
          );
        }

        setGameState(json.game ?? null);
        setRules(json.rules ?? []);
        setPlayers(json.players ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "대시보드 정보를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearError = () => setError(null);

  const toggleRule = async (ruleKey: string, isOpen: boolean) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/rules/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rule_key: ruleKey, is_open: isOpen }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "규칙 공개 상태를 변경하지 못했습니다.");
      }
      setRules((prev) =>
        prev.map((r) =>
          r.rule_key === ruleKey ? { ...r, is_open: !isOpen } : r
        )
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "규칙 공개 상태를 변경하지 못했습니다.";
      setError(message);
    }
  };

  const changeGame = async (value: GameState["active_game"]) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/game/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active_game: value }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "게임 상태를 변경하지 못했습니다.");
      }
      setGameState((prev) =>
        prev
          ? { ...prev, active_game: value }
          : {
              id: 1,
              active_game: value,
              updated_at: "",
              timer_start: null,
              timer_start_at: null,
              pause_at: null,
            }
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "게임 상태를 변경하지 못했습니다.";
      setError(message);
    }
  };

  const updateFeather = async (playerId: string, delta: -1 | 1) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/players/feather", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId, delta }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
        feather?: number;
      } | null;
      if (!res.ok || !json?.ok || typeof json.feather !== "number") {
        throw new Error(json?.error ?? "부엉깃털을 변경하지 못했습니다.");
      }

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, feather: json.feather } : p
        )
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "부엉깃털을 변경하지 못했습니다.";
      setError(message);
    }
  };

  return {
    gameState,
    rules,
    players,
    loading,
    error,
    changeGame,
    toggleRule,
    updateFeather,
    clearError,
  };
}
