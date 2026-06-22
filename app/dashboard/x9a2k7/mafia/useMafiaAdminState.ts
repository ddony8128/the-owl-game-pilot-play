import { useEffect, useState } from "react";
import type {
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
} from "@/lib/types";

type MafiaAdminState = {
  phase: MafiaPhaseState | null;
  stocks: MafiaStockState[];
  players: MafiaPlayerState[];
  playerNames: Record<string, string>;
  logs: MafiaLog[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useMafiaAdminState(): MafiaAdminState {
  const [phase, setPhase] = useState<MafiaPhaseState | null>(null);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [players, setPlayers] = useState<MafiaPlayerState[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<MafiaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // silent=true 면 주기 폴링 시 로딩 스피너를 띄우지 않고 조용히 갱신한다.
    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch("/api/mafia/state?all=1");
        const json = (await res.json().catch(() => null)) as
          | {
              phase: MafiaPhaseState | null;
              stocks: MafiaStockState[];
              players: MafiaPlayerState[];
              logs: MafiaLog[];
              playerNames?: Record<string, string>;
              error?: undefined;
            }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "마피아 정보를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setPhase(json.phase ?? null);
        setStocks(json.stocks ?? []);
        setPlayers(json.players ?? []);
        setLogs(json.logs ?? []);
        setPlayerNames(json.playerNames ?? {});
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "마피아 정보를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    // 플레이어 행동으로 바뀌는 정보(페이즈/주식/자산/로그)를 주기적으로 갱신한다.
    const interval = setInterval(() => void load(true), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);

  return { phase, stocks, players, playerNames, logs, loading, error, reload };
}
