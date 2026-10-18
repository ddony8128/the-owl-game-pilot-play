"use client";

import { useCallback } from "react";
import type { Player } from "@/lib/types";
import { usePolling } from "@/lib/hooks/usePolling";
import type { GmLogItem } from "@/components/GmLogSection";

export type DefenseAdminPlayer = Player & { defensePoints?: number | null };

export type PendingInfo = {
  applicable: boolean;
  label: string;
  total: number;
  submitted: number;
  pending: { id: string; nickname: string }[];
};

export type DefenseDashboardDto = {
  room: { code: string; game: string; status: "active" | "ended"; reveal_result?: boolean | null };
  round: number;
  stage: string;
  prevRound: number;
  stageTitle: string;
  nextStep: { label: string; kind: "round" | "stage"; settles: boolean } | null;
  players: DefenseAdminPlayer[];
  pending: PendingInfo;
  gmLogs: GmLogItem[];
  gmLogsWarning: string | null;
  serverNow: string;
};

type DefenseAdminState = {
  data: DefenseDashboardDto | null;
  round: number | null;
  stage: string | null;
  prevRound: number | null;
  players: DefenseAdminPlayer[];
  pending: PendingInfo | null;
  roomStatus: "active" | "ended" | null;
  gmLogs: GmLogItem[];
  gmLogsWarning: string | null;
  loading: boolean;
  error: string | null;
  /** 연속 폴링 실패 횟수(≥1 이면 "다시 연결 중" 배지) */
  failures: number;
  reload: () => Promise<void>;
};

// 디펜스 GM 대시보드 상태 — 공용 usePolling(in-flight 가드·8초 제한·실패 시 마지막 화면 유지) 위에 얹는다.
// Iteration 5 WS-A 7: 폴링이 실패해도 data 가 남아 화면이 사라지지 않고, failures 로 재연결 배지를 띄운다.
export function useDefenseAdminState(room: string | null): DefenseAdminState {
  const url = room ? `/api/gm/defense/dashboard?room=${encodeURIComponent(room)}` : null;
  const { data, error, failures, reload } = usePolling<DefenseDashboardDto>(url, 4000);

  // GM 조작 뒤 즉시 갱신. 폴링 요청이 떠 있어 건너뛰어졌을 수 있으니 잠시 뒤 한 번 더 읽는다.
  const refresh = useCallback(async () => {
    await reload();
    setTimeout(() => void reload(), 350);
  }, [reload]);

  return {
    data,
    round: data ? data.round : null,
    stage: data ? data.stage : null,
    prevRound: data ? data.prevRound : null,
    players: data?.players ?? [],
    pending: data?.pending ?? null,
    roomStatus: data?.room.status ?? null,
    gmLogs: data?.gmLogs ?? [],
    gmLogsWarning: data?.gmLogsWarning ?? null,
    loading: !data && !error,
    error: !data ? error : null,
    failures,
    reload: refresh,
  };
}
