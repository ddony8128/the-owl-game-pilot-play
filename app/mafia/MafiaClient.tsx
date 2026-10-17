"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MafiaAbilityResult,
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
  MafiaStocksHolding,
  Player,
} from "@/lib/types";
import type { MafiaRoundLog } from "@/lib/mafia/playerLog";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { usePolling } from "@/lib/hooks/usePolling";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { KickedScreen, RoomEndedBanner, RoomGoneScreen } from "@/components/PhoneNotices";
import { TabLayout, type TabKey } from "@/components/TabLayout";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { MafiaHeader } from "./MafiaHeader";
import { MafiaInfoTab } from "./MafiaInfoTab";
import { MafiaRulesTab } from "./MafiaRulesTab";
import { MafiaStocksTab } from "./MafiaStocksTab";
import { MafiaAuctionTab } from "./MafiaAuctionTab";
import { MafiaTradeTab } from "./MafiaTradeTab";
import { MafiaAbilityTab } from "./MafiaAbilityTab";
import { MafiaResultTab } from "./MafiaResultTab";
import { MafiaVoteTab } from "./MafiaVoteTab";
import { MafiaLogTab } from "./MafiaLogTab";

type MafiaStateResponse = {
  phase: MafiaPhaseState | null;
  roomStatus?: "active" | "ended";
  stocks: MafiaStockState[];
  playerState: MafiaPlayerState | null;
  players?: Player[];
  logs: MafiaLog[];
  stockHistory?: Record<
    string,
    {
      round_number: number;
      price_before: number | null;
      price_after: number | null;
    }[]
  >;
  abilityResults?: MafiaAbilityResult[];
  ticketPrice?: number | null;
  myVoteSummary?: {
    target: string;
    vote_count: number;
    total_spent: number;
  }[];
  myAuctionBet?: {
    job: string | null;
    amount: number | null;
    give_up: boolean;
  } | null;
  hasUsedAbilityThisPhase?: boolean;
  myAbilityActionThisPhase?: {
    job: string | null;
    payload: Record<string, unknown> | null;
  } | null;
  myTradesThisRound?: Record<string, { bought: boolean; sold: boolean }> | null;
  myLog?: MafiaRoundLog[];
};

type MafiaTimerApi = {
  phase: string | null;
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
};

export default function MafiaClient() {
  return (
    <PageGuard requireLogin allowGames={["mafia", "mafia_tutorial"]}>
      <MafiaInner />
    </PageGuard>
  );
}

function MafiaInner() {
  const { player, roomCode, nickname, clearNickname } = usePlayerAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  // 상태 폴링(공용 훅): in-flight 가드·타임아웃·실패해도 마지막 화면 유지(반면교사 1-5).
  const stateUrl =
    roomCode && nickname
      ? `/api/mafia/state?${new URLSearchParams({ room: roomCode, nickname }).toString()}`
      : null;
  const poll = usePolling<MafiaStateResponse>(stateUrl, 3000);
  const data = poll.data;
  const reload = poll.reload;

  const mafiaPlayer = data?.playerState ?? null;
  const stocks = data?.stocks ?? [];
  const phase = data?.phase ?? null;
  const logs = data?.logs ?? [];
  const players = data?.players ?? [];
  const stockHistory = data?.stockHistory ?? null;
  const abilityResults = data?.abilityResults ?? [];
  const ticketPrice = typeof data?.ticketPrice === "number" ? data.ticketPrice : null;
  const myVoteSummary = data?.myVoteSummary ?? [];
  const myAuctionBet = data?.myAuctionBet ?? null;
  const hasUsedAbilityThisPhase = !!data?.hasUsedAbilityThisPhase;
  const myAbilityActionThisPhase = data?.myAbilityActionThisPhase ?? null;
  const myTradesThisRound = data?.myTradesThisRound ?? null;
  const myLog = data?.myLog ?? [];
  const roomEnded = data?.roomStatus === "ended";

  const [timerState, setTimerState] = useState<{
    remainingSeconds: number;
    isRunning: boolean;
  } | null>(null);
  const timerMetaRef = useRef<MafiaTimerApi | null>(null);

  const computeRemaining = useCallback(
    (
      api: MafiaTimerApi | null,
      nowMs: number
    ): { remainingSeconds: number; isRunning: boolean } => {
      if (!api || !api.phase) {
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

  // 서버 타이머 폴링 + 로컬 1초 틱 (GM 카운트다운과 동일 패턴). 타이머 오류는 게임 진행을 막지 않는다.
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch(
          `/api/gm/timers/mafia?room=${encodeURIComponent(roomCode)}`,
          { cache: "no-store", signal: AbortSignal.timeout(8000) }
        );
        const json = (await res
          .json()
          .catch(() => null)) as MafiaTimerApi | null;
        if (!res.ok || !json || cancelled) return;

        const api = json;
        const prevMeta = timerMetaRef.current;

        if (
          prevMeta &&
          prevMeta.phase === api.phase &&
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

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "rules", "stocks", "result", "log"];
    const phaseKey = phase?.phase;
    if (phaseKey === "auction") base.push("auction");
    if (phaseKey === "trade") {
      base.push("trade", "ability");
    }
    if (phaseKey === "vote") base.push("vote");
    return base;
  }, [phase?.phase]);

  const tabsDef = useMemo(
    () =>
      [
        { key: "info", label: "정보" },
        { key: "rules", label: "규칙" },
        { key: "stocks", label: "주가" },
        { key: "auction", label: "경매" },
        { key: "trade", label: "거래" },
        { key: "ability", label: "능력" },
        { key: "result", label: "능력/투표결과" },
        { key: "vote", label: "투표" },
        { key: "log", label: "로그" },
      ].filter((t) => availableTabs.includes(t.key)),
    [availableTabs]
  );

  // 현재 페이즈에 없는 탭(예: 끝난 경매 탭)을 보고 있었다면 첫 탭으로 — effect 의 setState 대신 렌더에서 유도한다.
  const effectiveTab: TabKey = tabsDef.some((t) => t.key === activeTab) ? activeTab : tabsDef[0].key;

  if (!player) return <LoadingScreen />;

  // 강퇴/방 삭제: 입장은 통과했으므로 폴링 403 = GM이 명단에서 지운 것 → 즉시 안내. 404 = 방 없음.
  if (poll.status === 403) return <KickedScreen onLeave={clearNickname} />;
  if (poll.status === 404 && poll.reason === "room_not_found") {
    return <RoomGoneScreen onLeave={clearNickname} />;
  }

  if (!data) {
    // 첫 응답 전: 로딩. 서버 오류(5xx)면 문구 + 재연결 배지(폴링은 계속).
    if (poll.error && poll.status !== null && poll.status >= 500) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-zinc-50">
          <ErrorMessage message={poll.error} />
          <ConnectionBadge failures={poll.failures} />
        </div>
      );
    }
    if (poll.failures > 0) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-200">
          <p className="text-sm text-zinc-400">불러오는 중입니다...</p>
          <ConnectionBadge failures={poll.failures} />
        </div>
      );
    }
    return <LoadingScreen />;
  }

  const totalSeconds = timerState?.remainingSeconds ?? null;
  const minutes =
    totalSeconds != null ? Math.floor(totalSeconds / 60) % 60 : null;
  const seconds = totalSeconds != null ? totalSeconds % 60 : null;

  const roundLabel =
    typeof phase?.round_number === "number"
      ? phase.round_number === 0
        ? "튜토리얼"
        : `${phase.round_number}라운드`
      : "-";
  const phaseLabel = getMafiaPhaseLabel(phase?.phase ?? null);
  const roomForTabs = roomCode ?? player.room_code;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <MafiaHeader
        minutes={minutes}
        seconds={seconds}
        roundLabel={roundLabel}
        phaseLabel={phaseLabel}
      />

      <ConnectionBadge failures={poll.failures} className="mt-2 w-full max-w-md" />
      {roomEnded && (
        <div className="mt-2 w-full max-w-md">
          <RoomEndedBanner />
        </div>
      )}

      <p className="mt-2 text-sm text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={effectiveTab} onChange={setActiveTab}>
          {effectiveTab === "" && (
            <MafiaInfoTab
              mafiaPlayer={mafiaPlayer}
              stocks={stocks}
              logs={logs}
            />
          )}
          {effectiveTab === "" && <MafiaRulesTab />}
          {effectiveTab === "" && (
            <MafiaStocksTab stocks={stocks} stockHistory={stockHistory} />
          )}
          {effectiveTab === "" && (
            <MafiaAuctionTab
              player={player}
              roomCode={roomForTabs}
              myAuctionBet={myAuctionBet}
              playerCash={mafiaPlayer?.cash ?? null}
              roomEnded={roomEnded}
              onSubmitted={reload}
            />
          )}
          {effectiveTab === "" && (
            <MafiaTradeTab
              player={player}
              roomCode={roomForTabs}
              stocks={stocks}
              playerCash={mafiaPlayer?.cash ?? null}
              holdings={(mafiaPlayer?.stocks as MafiaStocksHolding | null) ?? null}
              myTradesThisRound={myTradesThisRound}
              roomEnded={roomEnded}
              onSubmitted={reload}
            />
          )}
          {effectiveTab === "" && (
            <MafiaAbilityTab
              player={player}
              roomCode={roomForTabs}
              job={mafiaPlayer?.job ?? null}
              stocks={stocks}
              players={players}
              hasUsedAbilityThisPhase={hasUsedAbilityThisPhase}
              myAbilityActionThisPhase={myAbilityActionThisPhase}
              roomEnded={roomEnded}
              onSubmitted={reload}
            />
          )}
          {effectiveTab === "" && (
            <MafiaResultTab abilityResults={abilityResults} />
          )}
          {effectiveTab === "" && (
            <MafiaVoteTab
              player={player}
              roomCode={roomForTabs}
              ticketPrice={ticketPrice}
              playerCash={mafiaPlayer?.cash ?? null}
              players={players}
              myVoteSummary={myVoteSummary}
              roomEnded={roomEnded}
              onSubmitted={reload}
            />
          )}
          {effectiveTab === "" && <MafiaLogTab log={myLog} />}
        </TabLayout>
      </main>
    </div>
  );
}
