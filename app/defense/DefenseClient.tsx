"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TabLayout, type TabKey } from "@/components/TabLayout";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { DefenseHeader } from "./DefenseHeader";
import { DefenseRulesTab } from "./DefenseRulesTab";
import { DefenseInfoTab } from "./DefenseInfoTab";
import { DefenseActionTab } from "./DefenseActionTab";
import { DefenseDexTab } from "./DefenseDexTab";
import { DefenseLogsTab } from "./DefenseLogsTab";

type DefenseMonsterClient = {
  instanceId: string;
  monsterId: number;
  slotIndex: number;
  currentHp: number;
  remainingTime: number;
  status: string;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  image: string;
};

type DefenseCardClient = {
  cardSlot: number;
  cardValue: number;
  isActive: boolean;
};

type DefenseActionClient = {
  round: number;
  actionType: string;
  targetMonsterId: string | null;
  usedCardSlot: number | null;
  trainingFromSlot: number | null;
  trainingToSlot: number | null;
} | null;

type DefenseDexEntry = {
  monsterId: number;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  remainingCount: number;
  image: string;
};

type DefenseLogEntry = {
  round: number;
  log: string;
  createdAt: string;
};

type DefenseState = {
  round: number | null;
  monsters: DefenseMonsterClient[];
  cards: DefenseCardClient[];
  score: number;
  action: DefenseActionClient;
  dex: DefenseDexEntry[];
  logs: DefenseLogEntry[];
};

type DefenseTimerApi = {
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
};

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
};

export default function DefenseClient() {
  return (
    <PageGuard requireLogin allowGames={["defense"]}>
      <DefenseInner />
    </PageGuard>
  );
}

function DefenseInner() {
  const { player } = usePlayerAuth();
  const [defenseState, setDefenseState] = useState<DefenseState | null>(null);
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  const loadState = useCallback(async () => {
    if (!player?.nickname) return;
    try {
      const params = new URLSearchParams({ nickname: player.nickname });
      const res = await fetch(`/api/defense/state?${params.toString()}`);
      const json = (await res.json().catch(() => null)) as
        | DefenseState
        | { error: string }
        | null;

      if (!res.ok || !json || "error" in json) {
        throw new Error(
          (json as { error?: string })?.error ??
            "디펜스 상태를 불러오지 못했습니다."
        );
      }

      setDefenseState(json as DefenseState);
      setError(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "디펜스 상태를 불러오지 못했습니다.";
      setError(message);
    }
  }, [player?.nickname]);

  // 플레이어 전용 상태 폴링
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await loadState();
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadState]);

  const computeRemaining = useCallback(
    (api: DefenseTimerApi | null, nowMs: number): TimerState => {
      if (!api) {
        return { remainingSeconds: 0, isRunning: false };
      }

      const total = api.totalSeconds || 0;
      if (total <= 0) {
        return { remainingSeconds: 0, isRunning: false };
      }

      if (!api.timerStart && !api.pauseAt) {
        return { remainingSeconds: total, isRunning: false };
      }

      if (api.timerStart && api.timerStartAt) {
        const startMs = new Date(api.timerStartAt).getTime();
        if (Number.isNaN(startMs)) {
          return { remainingSeconds: total, isRunning: false };
        }
        const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
        const remaining = Math.max(0, total - elapsed);
        return { remainingSeconds: remaining, isRunning: remaining > 0 };
      }

      if (!api.timerStart && api.timerStartAt && api.pauseAt) {
        const startMs = new Date(api.timerStartAt).getTime();
        const pauseMs = new Date(api.pauseAt).getTime();
        if (Number.isNaN(startMs) || Number.isNaN(pauseMs)) {
          return { remainingSeconds: total, isRunning: false };
        }
        const elapsed = Math.max(0, Math.floor((pauseMs - startMs) / 1000));
        const remaining = Math.max(0, total - elapsed);
        return { remainingSeconds: remaining, isRunning: false };
      }

      return { remainingSeconds: total, isRunning: false };
    },
    []
  );

  // 타이머 폴링 + 1초 틱 (마피아/서브웨이와 동일한 패턴)
  useEffect(() => {
    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch("/api/gm/timers/defense");
        const json = (await res
          .json()
          .catch(() => null)) as DefenseTimerApi | null;
        if (!res.ok || !json || cancelled) return;
        const now = Date.now();
        setTimerState(computeRemaining(json, now));
      } catch {
        // 타이머 오류는 게임 진행을 막지 않음
      }
    };

    void loadTimer();
    const pollId = setInterval(() => {
      void loadTimer();
    }, 2000);

    const tickId = setInterval(() => {
      setTimerState((prev) => {
        if (!prev) return prev;
        if (!prev.isRunning || prev.remainingSeconds <= 0) return prev;
        const next = prev.remainingSeconds - 1;
        if (next <= 0) {
          return { ...prev, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: next };
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [computeRemaining]);

  const tabsDef = useMemo(
    () =>
      [
        { key: "info", label: "정보" },
        { key: "action", label: "행동" },
        { key: "rules", label: "규칙" },
        { key: "dex", label: "몬스터 도감" },
        { key: "logs", label: "로그" },
      ] as { key: TabKey; label: string }[],
    []
  );

  useEffect(() => {
    if (!tabsDef.find((t) => t.key === activeTab) && tabsDef.length > 0) {
      setActiveTab(tabsDef[0].key);
    }
  }, [activeTab, tabsDef]);

  if (!player) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const roundNumber = defenseState?.round ?? null;
  const getRoundLabel = (r: number | null) => {
    if (r == null) return "-";
    if (r === 0) return "준비";
    if (r === 1) return "튜토리얼 1라운드";
    if (r === 2) return "튜토리얼 2라운드";
    if (r === 3) return "튜토리얼 결과";
    if (r >= 4 && r <= 13) {
      const gameRound = r - 3; // 4~13 -> 1~10라운드
      return `${gameRound}라운드`;
    }
    if (r === 14) return "게임 종료";
    return `알 수 없음 (DB round ${r})`;
  };

  const totalSeconds = timerState?.remainingSeconds ?? null;
  const minutes =
    totalSeconds != null ? Math.floor(totalSeconds / 60) % 60 : null;
  const seconds = totalSeconds != null ? totalSeconds % 60 : null;

  const roundLabel = getRoundLabel(roundNumber);
  const isInitialLoading = !defenseState;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <DefenseHeader
        minutes={minutes}
        seconds={seconds}
        roundLabel={roundLabel}
      />

      <p className="mt-2 text-base text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "info" && (
            <DefenseInfoTab
              monsters={defenseState?.monsters ?? []}
              cards={defenseState?.cards ?? []}
              score={defenseState?.score ?? 0}
              isLoading={isInitialLoading}
            />
          )}
          {activeTab === "action" && defenseState && (
            <DefenseActionTab
              state={defenseState}
              nickname={player.nickname}
              onActionCompleted={loadState}
            />
          )}
          {activeTab === "rules" && <DefenseRulesTab />}
          {activeTab === "dex" && defenseState && (
            <DefenseDexTab dex={defenseState.dex} />
          )}
          {activeTab === "logs" && defenseState && (
            <DefenseLogsTab logs={defenseState.logs} />
          )}
        </TabLayout>
      </main>
    </div>
  );
}
