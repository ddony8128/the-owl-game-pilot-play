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
  usedCardValue: number | null;
  trainingFrom: number | null;
  trainingTo: number | null;
} | null;

type DefenseDexEntry = {
  monsterId: number;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  remainingCount: number;
  totalCount: number;
  image: string;
};

type DefenseLogEntry = {
  round: number;
  log: string;
  createdAt: string;
};

type DefenseState = {
  round: number | null;
  resultPending: boolean;
  monsters: DefenseMonsterClient[];
  cards: DefenseCardClient[];
  score: number;
  action: DefenseActionClient;
  dex: DefenseDexEntry[];
  logs: DefenseLogEntry[];
};

export default function DefenseClient() {
  return (
    <PageGuard requireLogin allowGames={["defense"]}>
      <DefenseInner />
    </PageGuard>
  );
}

function DefenseInner() {
  const { player, roomCode, nickname } = usePlayerAuth();
  const [defenseState, setDefenseState] = useState<DefenseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  const loadState = useCallback(async () => {
    if (!roomCode || !nickname) return;
    try {
      const params = new URLSearchParams({ room: roomCode, nickname });
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
  }, [roomCode, nickname]);

  // 플레이어 상태는 최초 입장 때 한 번만 조회한다.
  // 이후에는 행동 완료 또는 사용자의 명시적 새로고침으로만 갱신한다.
  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!roomCode) return;
    const events = new EventSource(
      `/api/defense/phase-events?room=${encodeURIComponent(roomCode)}`
    );
    events.onmessage = () => void loadState();
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadState();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      events.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadState, roomCode]);

  const roundNumber = defenseState?.round ?? null;
  const getRoundLabel = (r: number | null) => {
    if (r == null) return "-";
    if (r === 0) return "준비";
    if (r === 1) return "튜토리얼 1라운드";
    if (r === 2) return "튜토리얼 2라운드";
    if (r === 3) return "튜토리얼 결과";
    if (r >= 4 && r <= 15) {
      const gameRound = r - 3; // 4~15 -> 1~12라운드
      return `${gameRound}라운드`;
    }
    if (r === 16) return "게임 종료";
    return `알 수 없음 (DB round ${r})`;
  };

  const roundLabel = getRoundLabel(roundNumber);
  const isInitialLoading = !defenseState;
  const hideInfoAndAction =
    defenseState?.resultPending === true ||
    roundNumber === 0 || roundNumber === 3 || roundNumber === 16;

  const tabsDef = useMemo(() => {
    const base: { key: TabKey; label: string }[] = [
      { key: "info", label: "정보" },
      { key: "dex", label: "몬스터 도감" },
      { key: "logs", label: "로그" },
      { key: "rules", label: "규칙" },
    ];

    if (!hideInfoAndAction) {
      base.splice(1, 0, { key: "action", label: "행동" });
    }

    return base;
  }, [hideInfoAndAction]);

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

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <DefenseHeader roundLabel={roundLabel} />

      <p className="mt-2 text-base text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <p className="mt-2 text-xs text-zinc-600">
        관리자가 다음 라운드로 넘기면 자동으로 갱신됩니다.
      </p>

      {defenseState?.resultPending ? (
        <p className="mt-4 rounded-xl border border-sky-500/30 bg-sky-950/40 px-4 py-3 text-center text-sm font-bold text-sky-200">
          전투 결과 확인 중입니다. 전광판을 확인해주세요.
        </p>
      ) : null}

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "info" && (
            <DefenseInfoTab
              cards={defenseState?.cards ?? []}
              score={defenseState?.score ?? 0}
              isLoading={isInitialLoading}
            />
          )}
          {activeTab === "action" && defenseState && !hideInfoAndAction && (
            <DefenseActionTab
              state={defenseState}
              nickname={player.nickname}
              room={player.room_code}
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
