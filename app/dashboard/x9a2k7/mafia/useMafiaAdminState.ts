"use client";

import { useCallback } from "react";
import type {
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
} from "@/lib/types";
import { usePolling } from "@/lib/hooks/usePolling";
import type { GmLogItem } from "@/components/GmLogSection";
import type { PendingInfo } from "../defense/useDefenseAdminState";

export type MafiaDashboardDto = {
  room: { code: string; game: string; status: "active" | "ended"; reveal_result?: boolean | null };
  phase: MafiaPhaseState | null;
  stocks: MafiaStockState[];
  players: MafiaPlayerState[];
  playerNames: Record<string, string>;
  playerCount: number;
  logs: MafiaLog[];
  pending: PendingInfo | null;
  gmLogs: GmLogItem[];
  gmLogsWarning: string | null;
  phoneToggles?: { phoneLogs: boolean; phoneRemainingCount: boolean; columnMissing: boolean };
  serverNow: string;
};

type MafiaAdminState = {
  data: MafiaDashboardDto | null;
  phase: MafiaPhaseState | null;
  stocks: MafiaStockState[];
  players: MafiaPlayerState[];
  playerNames: Record<string, string>;
  playerCount: number;
  logs: MafiaLog[];
  pending: PendingInfo | null;
  roomStatus: "active" | "ended" | null;
  phoneToggles: { phoneLogs: boolean; phoneRemainingCount: boolean; columnMissing: boolean } | null;
  revealResult: boolean;
  gmLogs: GmLogItem[];
  gmLogsWarning: string | null;
  loading: boolean;
  error: string | null;
  failures: number;
  reload: () => Promise<void>;
};

// 마피아 GM 대시보드 상태 — 공용 usePolling 위에 얹는다(실패 시 마지막 화면 유지 + failures 로 재연결 배지).
export function useMafiaAdminState(room: string | null): MafiaAdminState {
  const url = room ? `/api/gm/mafia/dashboard?room=${encodeURIComponent(room)}` : null;
  const { data, error, failures, reload } = usePolling<MafiaDashboardDto>(url, 4000);

  const refresh = useCallback(async () => {
    await reload();
    setTimeout(() => void reload(), 350);
  }, [reload]);

  return {
    data,
    phase: data?.phase ?? null,
    stocks: data?.stocks ?? [],
    players: data?.players ?? [],
    playerNames: data?.playerNames ?? {},
    playerCount: data?.playerCount ?? 0,
    logs: data?.logs ?? [],
    pending: data?.pending ?? null,
    roomStatus: data?.room.status ?? null,
    phoneToggles: data?.phoneToggles ?? null,
    revealResult: !!data?.room.reveal_result,
    gmLogs: data?.gmLogs ?? [],
    gmLogsWarning: data?.gmLogsWarning ?? null,
    loading: !data && !error,
    error: !data ? error : null,
    failures,
    reload: refresh,
  };
}
