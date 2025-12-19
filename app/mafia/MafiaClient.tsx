"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MafiaAbilityResult,
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
  Player,
} from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
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

export default function MafiaClient() {
  return (
    <PageGuard requireLogin allowGames={["mafia", "mafia_tutorial"]}>
      <MafiaInner />
    </PageGuard>
  );
}

function MafiaInner() {
  const { player } = usePlayerAuth();
  const [mafiaPlayer, setMafiaPlayer] = useState<MafiaPlayerState | null>(null);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [phase, setPhase] = useState<MafiaPhaseState | null>(null);
  const [logs, setLogs] = useState<MafiaLog[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stockHistory, setStockHistory] = useState<Record<
    string,
    {
      round_number: number;
      price_before: number | null;
      price_after: number | null;
    }[]
  > | null>(null);
  const [abilityResults, setAbilityResults] = useState<MafiaAbilityResult[]>(
    []
  );
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);
  const [myVoteSummary, setMyVoteSummary] = useState<
    { target: string; vote_count: number; total_spent: number }[]
  >([]);
  const [myAuctionBet, setMyAuctionBet] = useState<{
    job: string | null;
    amount: number | null;
    give_up: boolean;
  } | null>(null);
  const [hasUsedAbilityThisPhase, setHasUsedAbilityThisPhase] =
    useState<boolean>(false);
  const [myAbilityActionThisPhase, setMyAbilityActionThisPhase] = useState<{
    job: string | null;
    payload: Record<string, unknown> | null;
  } | null>(null);
  const [myTradesThisRound, setMyTradesThisRound] = useState<Record<
    string,
    { bought: boolean; sold: boolean }
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  // 초기 로딩 + 에러 처리는 한 번만 수행
  useEffect(() => {
    if (!player?.nickname) return;
    let cancelled = false;

    const load = async (nickname: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ nickname });
        const res = await fetch(`/api/mafia/state?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | {
              phase: MafiaPhaseState | null;
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
              myTradesThisRound?: Record<
                string,
                { bought: boolean; sold: boolean }
              > | null;
              error?: undefined;
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "마피아 게임 정보를 불러오지 못했습니다."
          );
        }

        if (cancelled) return;

        setMafiaPlayer(json.playerState ?? null);
        setStocks(json.stocks ?? []);
        setPhase(json.phase ?? null);
        setLogs(json.logs ?? []);
        setPlayers(json.players ?? []);
        setStockHistory(json.stockHistory ?? null);
        setAbilityResults(json.abilityResults ?? []);
        setTicketPrice(
          typeof json.ticketPrice === "number" ? json.ticketPrice : null
        );
        setMyVoteSummary(json.myVoteSummary ?? []);
        setMyAuctionBet(json.myAuctionBet ?? null);
        setHasUsedAbilityThisPhase(!!json.hasUsedAbilityThisPhase);
        setMyAbilityActionThisPhase(json.myAbilityActionThisPhase ?? null);
        setMyTradesThisRound(json.myTradesThisRound ?? null);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "마피아 게임 정보를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load(player.nickname);

    return () => {
      cancelled = true;
    };
  }, [player?.nickname]);

  // 페이즈/현금/능력결과 등을 주기적으로 갱신하기 위한 폴링
  useEffect(() => {
    if (!player?.nickname) return;
    let cancelled = false;

    const poll = async (nickname: string) => {
      try {
        const params = new URLSearchParams({ nickname });
        const res = await fetch(`/api/mafia/state?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | {
              phase: MafiaPhaseState | null;
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
              myTradesThisRound?: Record<
                string,
                { bought: boolean; sold: boolean }
              > | null;
              error?: undefined;
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json || cancelled) {
          return;
        }

        setMafiaPlayer(json.playerState ?? null);
        setStocks(json.stocks ?? []);
        setPhase(json.phase ?? null);
        setLogs(json.logs ?? []);
        setPlayers(json.players ?? []);
        setStockHistory(json.stockHistory ?? null);
        setAbilityResults(json.abilityResults ?? []);
        setTicketPrice(
          typeof json.ticketPrice === "number" ? json.ticketPrice : null
        );
        setMyVoteSummary(json.myVoteSummary ?? []);
        setMyAuctionBet(json.myAuctionBet ?? null);
        setHasUsedAbilityThisPhase(!!json.hasUsedAbilityThisPhase);
        setMyAbilityActionThisPhase(json.myAbilityActionThisPhase ?? null);
        setMyTradesThisRound(json.myTradesThisRound ?? null);
      } catch {
        // 폴링 에러는 조용히 무시 (초기 로딩 에러는 위 effect에서 처리)
      }
    };

    const intervalId = setInterval(() => {
      void poll(player.nickname);
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [player?.nickname]);

  const [timerState, setTimerState] = useState<{
    remainingSeconds: number;
    isRunning: boolean;
  } | null>(null);

  type MafiaTimerApi = {
    phase: string | null;
    timerStart: boolean;
    timerStartAt: string | null;
    pauseAt: string | null;
    totalSeconds: number;
  };

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

  // 서버 타이머 폴링 + 로컬 1초 틱 (GM 카운트다운과 동일 패턴)
  useEffect(() => {
    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch("/api/gm/timers/mafia");
        const json = (await res
          .json()
          .catch(() => null)) as MafiaTimerApi | null;
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

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "rules", "stocks", "result"];
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
      ].filter((t) => availableTabs.includes(t.key)),
    [availableTabs]
  );

  useEffect(() => {
    if (!tabsDef.find((t) => t.key === activeTab) && tabsDef.length > 0) {
      setActiveTab(tabsDef[0].key);
    }
  }, [activeTab, tabsDef]);

  if (loading || !player) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={error} />
      </div>
    );
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

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <MafiaHeader
        minutes={minutes}
        seconds={seconds}
        roundLabel={roundLabel}
        phaseLabel={phaseLabel}
      />

      <p className="mt-2 text-sm text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "info" && (
            <MafiaInfoTab
              mafiaPlayer={mafiaPlayer}
              stocks={stocks}
              logs={logs}
            />
          )}
          {activeTab === "rules" && <MafiaRulesTab />}
          {activeTab === "stocks" && (
            <MafiaStocksTab stocks={stocks} stockHistory={stockHistory} />
          )}
          {activeTab === "auction" && (
            <MafiaAuctionTab
              myAuctionBet={myAuctionBet}
              playerCash={mafiaPlayer?.cash ?? null}
            />
          )}
          {activeTab === "trade" && (
            <MafiaTradeTab
              stocks={stocks}
              playerCash={mafiaPlayer?.cash ?? null}
              holdings={
                (mafiaPlayer?.stocks as
                  | import("@/lib/types").MafiaStocksHolding
                  | null) ?? null
              }
              myTradesThisRound={myTradesThisRound}
            />
          )}
          {activeTab === "ability" && (
            <MafiaAbilityTab
              job={mafiaPlayer?.job ?? null}
              stocks={stocks}
              players={players}
              hasUsedAbilityThisPhase={hasUsedAbilityThisPhase}
              myAbilityActionThisPhase={myAbilityActionThisPhase}
            />
          )}
          {activeTab === "result" && (
            <MafiaResultTab abilityResults={abilityResults} />
          )}
          {activeTab === "vote" && (
            <MafiaVoteTab
              ticketPrice={ticketPrice}
              playerCash={mafiaPlayer?.cash ?? null}
              players={players}
              myVoteSummary={myVoteSummary}
            />
          )}
        </TabLayout>
      </main>
    </div>
  );
}
