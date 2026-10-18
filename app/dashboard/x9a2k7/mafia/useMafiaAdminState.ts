import { useEffect, useRef, useState } from "react";
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

export function useMafiaAdminState(room: string | null): MafiaAdminState {
  const [phase, setPhase] = useState<MafiaPhaseState | null>(null);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [players, setPlayers] = useState<MafiaPlayerState[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<MafiaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadedOnceRef = useRef(false);

  useEffect(() => {
    if (!room) {
      loadedOnceRef.current = false;
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (!loadedOnceRef.current) setLoading(true);
      try {
        const res = await fetch(
          `/api/mafia/state?all=1&room=${encodeURIComponent(room)}`
        );
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
        if (!cancelled) {
          loadedOnceRef.current = true;
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, room]);

  const reload = () => setReloadToken((v) => v + 1);

  return { phase, stocks, players, playerNames, logs, loading, error, reload };
}
