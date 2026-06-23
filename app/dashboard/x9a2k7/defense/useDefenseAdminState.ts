import { useEffect, useState } from "react";
import type { Player } from "@/lib/types";

type DefenseAdminPlayer = Player & { defensePoints?: number | null };

type DefenseAdminState = {
  round: number | null;
  players: DefenseAdminPlayer[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useDefenseAdminState(room: string | null): DefenseAdminState {
  const [round, setRound] = useState<number | null>(null);
  const [players, setPlayers] = useState<DefenseAdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // silent=true 면 주기 폴링 시 로딩 스피너를 띄우지 않고 조용히 갱신한다.
  const load = async (silent = false) => {
    if (!room) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const roomParam = `?room=${encodeURIComponent(room)}`;
      const [roundRes, playersRes, scoresRes] = await Promise.all([
        fetch(`/api/defense/state${roomParam}`),
        fetch(`/api/gm/main-state${roomParam}`),
        fetch(`/api/gm/defense/score${roomParam}`),
      ]);

      const roundJson = (await roundRes.json().catch(() => null)) as
        | { round?: number | null; error?: string }
        | { error: string }
        | null;
      const mainJson = (await playersRes.json().catch(() => null)) as
        | {
            game: unknown;
            rules: unknown[];
            players: Player[];
            error?: undefined;
          }
        | { error: string }
        | null;
      const scoresJson = (await scoresRes.json().catch(() => null)) as
        | { scores: { player_id: string; points: number }[]; error?: undefined }
        | { error: string }
        | null;

      if (!roundRes.ok || !roundJson || "error" in roundJson) {
        throw new Error(
          (roundJson as { error?: string })?.error ??
            "디펜스 라운드 정보를 불러오지 못했습니다."
        );
      }

      if (!playersRes.ok || !mainJson || "error" in mainJson) {
        throw new Error(
          (mainJson as { error?: string })?.error ??
            "플레이어 정보를 불러오지 못했습니다."
        );
      }

      if (!scoresRes.ok || !scoresJson || "error" in scoresJson) {
        throw new Error(
          (scoresJson as { error?: string })?.error ??
            "디펜스 점수 정보를 불러오지 못했습니다."
        );
      }

      const scoreMap = new Map<string, number>();
      (scoresJson.scores ?? []).forEach((s) => {
        scoreMap.set(s.player_id, s.points);
      });

      const mergedPlayers: DefenseAdminPlayer[] = (mainJson.players ?? []).map(
        (p) => ({
          ...p,
          defensePoints: scoreMap.get(p.id) ?? 0,
        })
      );

      setRound(
        typeof roundJson.round === "number" ? roundJson.round : round ?? 0
      );
      setPlayers(mergedPlayers);
      setError(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "디펜스 정보를 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!room) {
      setRound(null);
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
    // 라운드/점수/플레이어 현황을 주기적으로 갱신한다.
    const interval = setInterval(() => void load(true), 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return {
    round,
    players,
    loading,
    error,
    reload: () => {
      void load();
    },
  };
}

