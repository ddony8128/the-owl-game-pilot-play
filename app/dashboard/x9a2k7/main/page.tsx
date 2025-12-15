"use client";

import { useEffect, useState } from "react";
import type { GameState, Player, RulesState } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

const GAME_OPTIONS = [
  "ready",
  "subway",
  "mafia_tutorial",
  "mafia",
  "vote",
  "quiz",
  "survey",
];

export default function DashboardMainPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rules, setRules] = useState<RulesState[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
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
              players: Player[];
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

  const toggleRule = async (ruleKey: string, isOpen: boolean) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/rules/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rule_key: ruleKey, is_open: !isOpen }),
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

  const changeGame = async (value: string) => {
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
          : { id: 1, active_game: value, updated_at: "" }
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "게임 상태를 변경하지 못했습니다.";
      setError(message);
    }
  };

  const toggleFinalist = async (playerId: string, isFinalist: boolean) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/players/finalist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ player_id: playerId, is_finalist: isFinalist }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        player?: Player;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.player) {
        throw new Error(
          json?.error ?? "결승 진출자 상태를 변경하지 못했습니다."
        );
      }

      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? json.player! : p))
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "결승 진출자 상태를 변경하지 못했습니다.";
      setError(message);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 text-sm">
      <section>
        <h2 className="mb-2 text-base font-semibold">전역 게임 상태</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">active_game</span>
          <select
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
            value={gameState?.active_game ?? "ready"}
            onChange={(e) => changeGame(e.target.value)}
          >
            {GAME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">규칙 공개 상태</h2>
        <div className="space-y-1 text-xs">
          {rules.map((r) => (
            <label key={r.rule_key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.is_open}
                onChange={() => toggleRule(r.rule_key, r.is_open)}
              />
              <span>{r.rule_key}</span>
            </label>
          ))}
          {rules.length === 0 && (
            <p className="text-zinc-400">rules_state에 데이터가 없습니다.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">결승 진출자 선정</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {players.map((p) => (
            <label
              key={p.id}
              className="flex items-center justify-between gap-2"
            >
              <span>{p.nickname}</span>
              <span className="flex items-center gap-2">
                <span className="text-zinc-400">finalist</span>
                <input
                  type="checkbox"
                  checked={!!p.is_finalist}
                  onChange={() => toggleFinalist(p.id, !!p.is_finalist)}
                />
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
