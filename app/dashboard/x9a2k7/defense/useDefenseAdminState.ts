import { useEffect, useRef, useState } from "react";
import type { Player } from "@/lib/types";

type DefenseAdminPlayer = Player & { defensePoints?: number | null };

type DefenseAdminState = {
  round: number | null;
  resultPending: boolean;
  scorePending: boolean;
  players: DefenseAdminPlayer[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  addPlayer: (player: { id: string; nickname: string; room_code?: string; created_at?: string }) => void;
  removePlayer: (id: string) => void;
};

export function useDefenseAdminState(room: string | null): DefenseAdminState {
  const [round, setRound] = useState<number | null>(null);
  const [resultPending, setResultPending] = useState(false);
  const [scorePending, setScorePending] = useState(false);
  const [players, setPlayers] = useState<DefenseAdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnceRef = useRef(false);

  const load = async () => {
    if (!room) {
      setLoading(false);
      return;
    }
    if (!loadedOnceRef.current) setLoading(true);
    setError(null);
    try {
      const roomParam = `?room=${encodeURIComponent(room)}`;
      const [roundRes, playersRes, scoresRes] = await Promise.all([
        fetch(`/api/defense/state${roomParam}`),
        fetch(`/api/gm/main-state${roomParam}`),
        fetch(`/api/gm/defense/score${roomParam}`),
      ]);

      const roundJson = (await roundRes.json().catch(() => null)) as
        | { round?: number | null; resultPending?: boolean; scorePending?: boolean; error?: string }
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
      setResultPending(roundJson.resultPending === true);
      setScorePending(roundJson.scorePending === true);
      setPlayers(mergedPlayers);
      setError(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "디펜스 정보를 불러오지 못했습니다.";
      setError(message);
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!room) {
      loadedOnceRef.current = false;
      setRound(null);
      setResultPending(false);
      setScorePending(false);
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return {
    round,
    resultPending,
    scorePending,
    players,
    loading,
    error,
    reload: () => {
      void load();
    },
    addPlayer: (player) => {
      setPlayers((current) => {
        if (current.some((item) => item.id === player.id)) return current;
        return [...current, {
          ...player,
          room_code: player.room_code ?? room ?? "",
          created_at: player.created_at ?? new Date().toISOString(),
          defensePoints: 0,
        }].sort((a, b) =>
          a.nickname.localeCompare(b.nickname, "ko")
        );
      });
    },
    removePlayer: (id) => {
      setPlayers((current) => current.filter((player) => player.id !== id));
    },
  };
}

