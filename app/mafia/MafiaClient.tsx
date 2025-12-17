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
import { useCountdown } from "@/lib/hooks/useCountdown";
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

  const targetTime = null;
  const { minutes, seconds } = useCountdown(targetTime);

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "rules", "stocks"];
    const phaseKey = phase?.phase;
    if (phaseKey === "auction") base.push("auction");
    if (phaseKey === "trade" || phaseKey === "apply") {
      base.push("trade", "ability");
    }
    if (phaseKey === "vote") {
      base.push("result", "vote");
    }
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

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <MafiaHeader phase={phase} minutes={minutes} seconds={seconds} />

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "info" && <MafiaInfoTab mafiaPlayer={mafiaPlayer} />}
          {activeTab === "rules" && <MafiaRulesTab />}
          {activeTab === "stocks" && <MafiaStocksTab stocks={stocks} />}
          {activeTab === "auction" && <MafiaAuctionTab />}
          {activeTab === "trade" && <MafiaTradeTab />}
          {activeTab === "ability" && <MafiaAbilityTab />}
          {activeTab === "result" && <MafiaResultTab logs={logs} />}
          {activeTab === "vote" && <MafiaVoteTab />}
        </TabLayout>
      </main>
    </div>
  );
}
