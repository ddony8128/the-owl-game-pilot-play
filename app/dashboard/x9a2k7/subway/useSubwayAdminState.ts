import { useEffect, useState } from "react";
import type { SubwayPlayerState } from "@/lib/types";

type SubwayAdminState = {
  players: SubwayPlayerState[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useSubwayAdminState(): SubwayAdminState {
  const [players, setPlayers] = useState<SubwayPlayerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/subway/state?all=1");
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            data?.error ?? "subway_player_state를 불러오지 못했습니다."
          );
        }
        const json = (await res.json()) as {
          state: SubwayPlayerState[] | null;
        };
        if (cancelled) return;
        setPlayers(json.state ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "subway_player_state를 불러오지 못했습니다.";
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
  }, [reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);

  return { players, loading, error, reload };
}
