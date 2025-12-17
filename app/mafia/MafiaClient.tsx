"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

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
              logs: MafiaLog[];
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

  const [timerState, setTimerState] = useState<{
    remainingSeconds: number;
    isRunning: boolean;
  } | null>(null);

  // 서버 타이머 폴링 + 로컬 1초 틱 (Subway와 유사 패턴)
  useEffect(() => {
    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch("/api/gm/timers/mafia");
        const json = (await res.json().catch(() => null)) as {
          remainingSeconds: number;
          isRunning: boolean;
        } | null;
        if (!res.ok || !json || cancelled) return;

        setTimerState({
          remainingSeconds: json.remainingSeconds,
          isRunning: json.isRunning,
        });
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
  }, []);

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "rules", "stocks"];
    const phaseKey = phase?.phase;
    if (phaseKey === "auction") base.push("auction");
    if (phaseKey === "trade" || phaseKey === "apply") {
      base.push("trade", "ability");
    }
    if (phaseKey === "apply" || phaseKey === "vote") {
      base.push("result");
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
        { key: "ability", label: "능력사용" },
        { key: "result", label: "능력결과" },
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
        phase={phase}
        minutes={minutes}
        seconds={seconds}
        roundLabel={roundLabel}
        phaseLabel={phaseLabel}
      />

      <p className="mt-2 text-xs text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "info" && <MafiaInfoTab mafiaPlayer={mafiaPlayer} />}
          {activeTab === "rules" && <MafiaRulesTab />}
          {activeTab === "stocks" && <MafiaStocksTab stocks={stocks} />}
          {activeTab === "auction" && <MafiaAuctionTab />}
          {activeTab === "trade" && <MafiaTradeTab stocks={stocks} />}
          {activeTab === "ability" && (
            <MafiaAbilityTab job={mafiaPlayer?.job ?? null} />
          )}
          {activeTab === "result" && <MafiaResultTab logs={logs} />}
          {activeTab === "vote" && <MafiaVoteTab />}
        </TabLayout>
      </main>
    </div>
  );
}
