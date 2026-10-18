"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { defenseStageTitle } from "@/lib/defense/steps";
import { KickedScreen, RoomEndedBanner, RoomGoneScreen } from "@/components/PhoneNotices";
import { TabLayout, type TabKey } from "@/components/TabLayout";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { usePolling } from "@/lib/hooks/usePolling";
import { LATE_COMBAT_LOG_PREFIX } from "@/lib/defense/action";
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
  roomStatus?: "active" | "ended";
  stage?: string | null;
  prevRound?: number | null;
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
  /** 서버 타이머가 한 번이라도 시작됐는지(시작 전 0:00 과 "시간 끝" 을 구분) */
  started: boolean;
};

export default function DefenseClient() {
  return (
    <PageGuard requireLogin allowGames={["defense"]}>
      <DefenseInner />
    </PageGuard>
  );
}

function DefenseInner() {
  const router = useRouter();
  const { player, roomCode, nickname, clearNickname } = usePlayerAuth();
  // 강퇴/방 삭제 안내에서 [입장 화면으로]: 저장된 방·닉네임을 지우고 입장 화면으로 보낸다(같은 닉네임 재입장 가능).
  const leaveToEntrance = () => {
    clearNickname();
    router.replace("/");
  };
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const timerMetaRef = useRef<DefenseTimerApi | null>(null);

  // 플레이어 전용 상태 폴링(공용 훅): in-flight 가드·8초 타임아웃·실패해도 마지막 화면 유지.
  const stateUrl =
    roomCode && nickname
      ? `/api/defense/state?${new URLSearchParams({ room: roomCode, nickname }).toString()}`
      : null;
  const poll = usePolling<DefenseState>(stateUrl, 5000);
  const defenseState = poll.data;
  const loadState = poll.reload;

  const computeRemaining = useCallback(
    (api: DefenseTimerApi | null, nowMs: number): TimerState => {
      if (!api) {
        return { remainingSeconds: 0, isRunning: false, started: false };
      }

      const total = api.totalSeconds || 0;
      if (total <= 0) {
        return { remainingSeconds: 0, isRunning: false, started: false };
      }

      if (!api.timerStart && !api.pauseAt) {
        return { remainingSeconds: total, isRunning: false, started: false };
      }

      if (api.timerStart && api.timerStartAt) {
        const startMs = new Date(api.timerStartAt).getTime();
        if (Number.isNaN(startMs)) {
          return { remainingSeconds: total, isRunning: false, started: false };
        }
        const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
        const remaining = Math.max(0, total - elapsed);
        return { remainingSeconds: remaining, isRunning: remaining > 0, started: true };
      }

      if (!api.timerStart && api.timerStartAt && api.pauseAt) {
        const startMs = new Date(api.timerStartAt).getTime();
        const pauseMs = new Date(api.pauseAt).getTime();
        if (Number.isNaN(startMs) || Number.isNaN(pauseMs)) {
          return { remainingSeconds: total, isRunning: false, started: false };
        }
        const elapsed = Math.max(0, Math.floor((pauseMs - startMs) / 1000));
        const remaining = Math.max(0, total - elapsed);
        return { remainingSeconds: remaining, isRunning: false, started: true };
      }

      return { remainingSeconds: total, isRunning: false, started: false };
    },
    []
  );

  // 타이머 폴링 + 1초 틱 (마피아/서브웨이와 동일한 패턴). 타이머 오류는 게임 진행을 막지 않는다.
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch(
          `/api/gm/timers/defense?room=${encodeURIComponent(roomCode)}`,
          { cache: "no-store", signal: AbortSignal.timeout(8000) }
        );
        const json = (await res
          .json()
          .catch(() => null)) as DefenseTimerApi | null;
        if (!res.ok || !json || cancelled) return;

        const api = json;
        const prevMeta = timerMetaRef.current;

        if (
          prevMeta &&
          prevMeta.timerStart === api.timerStart &&
          prevMeta.timerStartAt === api.timerStartAt &&
          prevMeta.pauseAt === api.pauseAt &&
          prevMeta.totalSeconds === api.totalSeconds
        ) {
          return;
        }

        const now = Date.now();
        const nextState = computeRemaining(api, now);
        timerMetaRef.current = api;
        setTimerState(nextState);
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
  }, [computeRemaining, roomCode]);

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

  const totalSeconds = timerState?.remainingSeconds ?? null;
  const minutes =
    totalSeconds != null ? Math.floor(totalSeconds / 60) % 60 : null;
  const seconds = totalSeconds != null ? totalSeconds % 60 : null;
  const timerExpired = timerState != null && timerState.started && timerState.remainingSeconds <= 0;

  const stageNow = defenseState?.stage ?? null;
  const roundLabel =
    stageNow && stageNow !== "action" && roundNumber != null
      ? defenseStageTitle(roundNumber, stageNow, defenseState?.prevRound ?? null)
      : getRoundLabel(roundNumber);
  const isInitialLoading = !defenseState;
  const roomEnded = defenseState?.roomStatus === "ended";
  // 행동 탭은 "행동" 단계에만 연다(결과·점수 발표·본게임 준비 중에는 닫힘 — GM 이 [다음]으로 열어 준다)
  const hideInfoAndAction =
    roundNumber === 0 || roundNumber === 3 || roundNumber === 16 || (stageNow != null && stageNow !== "action");

  const tabsDef = useMemo(() => {
    const base: { key: TabKey; label: string }[] = [
      { key: "info", label: "정보" },
      { key: "rules", label: "규칙" },
      { key: "dex", label: "몬스터 도감" },
      { key: "logs", label: "로그" },
    ];

    if (!hideInfoAndAction) {
      base.splice(1, 0, { key: "action", label: "행동" });
    }

    return base;
  }, [hideInfoAndAction]);

  // 현재 라운드에 없는 탭(예: 결과 화면의 "행동")을 보고 있었다면 첫 탭으로 — effect 의 setState 대신 렌더에서 유도한다.
  const effectiveTab: TabKey = tabsDef.some((t) => t.key === activeTab) ? activeTab : tabsDef[0].key;

  // 정산과 겹쳐 반영되지 않은 전투가 되돌려졌을 때 서버가 남긴 "알림:" 로그(현재 라운드)를 행동 탭 위에 띄운다.
  const lateNotice = useMemo(() => {
    if (!defenseState || roundNumber == null) return null;
    const hit = defenseState.logs.find(
      (l) => l.round === roundNumber && l.log.startsWith(LATE_COMBAT_LOG_PREFIX)
    );
    return hit ? hit.log.slice(LATE_COMBAT_LOG_PREFIX.length).trim() : null;
  }, [defenseState, roundNumber]);

  if (!player) return <LoadingScreen />;

  // 강퇴/방 삭제: 입장(로그인)은 통과한 뒤이므로, 폴링이 403(not_registered) 으로 바뀌면 GM이 명단에서 지운 것이다
  // → 데이터가 비워지고 사유가 오면 즉시 안내(조용히 굳지 않음). 404 는 방 삭제.
  if (poll.status === 403) {
    return <KickedScreen onLeave={leaveToEntrance} />;
  }
  if (poll.status === 404 && poll.reason === "room_not_found") {
    return <RoomGoneScreen onLeave={leaveToEntrance} />;
  }

  // 아직 한 번도 못 받았고 오류만 있는 경우: 오류 문구 + 재연결 배지(폴링은 계속된다)
  if (!defenseState && poll.error && poll.failures > 0 && poll.status !== null && poll.status >= 500) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={poll.error} />
        <ConnectionBadge failures={poll.failures} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <DefenseHeader
        minutes={minutes}
        seconds={seconds}
        roundLabel={roundLabel}
      />

      <ConnectionBadge failures={poll.failures} className="mt-2 w-full max-w-md" />
      {roomEnded && (
        <div className="mt-2 w-full max-w-md">
          <RoomEndedBanner />
        </div>
      )}

      <p className="mt-2 text-base text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={effectiveTab} onChange={setActiveTab}>
          {effectiveTab === "info" && (
            <DefenseInfoTab
              monsters={defenseState?.monsters ?? []}
              cards={defenseState?.cards ?? []}
              score={defenseState?.score ?? 0}
              isLoading={isInitialLoading}
              showQueue={!hideInfoAndAction}
            />
          )}
          {effectiveTab === "action" && defenseState && !hideInfoAndAction && (
            // 라운드가 바뀌면 key 가 바뀌어 선택 단계가 초기화된다(effect 안 setState 없이).
            <DefenseActionTab
              key={`action-${roundNumber ?? "x"}`}
              state={defenseState}
              nickname={player.nickname}
              room={player.room_code}
              onActionCompleted={loadState}
              roomEnded={roomEnded}
              timerExpired={timerExpired}
              notice={lateNotice}
            />
          )}
          {effectiveTab === "rules" && <DefenseRulesTab />}
          {effectiveTab === "dex" && defenseState && (
            <DefenseDexTab dex={defenseState.dex} />
          )}
          {effectiveTab === "logs" && defenseState && (
            <DefenseLogsTab logs={defenseState.logs} />
          )}
        </TabLayout>
      </main>
    </div>
  );
}
