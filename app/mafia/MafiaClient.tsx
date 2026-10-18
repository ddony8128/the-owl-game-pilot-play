"use client";

import { useEffect, useMemo, useState } from "react";
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
  const { player, roomCode, nickname } = usePlayerAuth();
  const [mafiaPlayer, setMafiaPlayer] = useState<MafiaPlayerState | null>(null);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [phase, setPhase] = useState<MafiaPhaseState | null>(null);
  const [logs, setLogs] = useState<MafiaLog[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
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
  const [reloadToken, setReloadToken] = useState(0);
  const [roomEnded, setRoomEnded] = useState(false);

  // 초기 로딩 + 에러 처리는 한 번만 수행
  useEffect(() => {
    if (!roomCode || !nickname) return;
    let cancelled = false;

    const load = async (room: string, nick: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ room, nickname: nick });
        const res = await fetch(`/api/mafia/state?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | {
              phase: MafiaPhaseState | null;
              roomEnded?: boolean;
              stocks: MafiaStockState[];
              playerState: MafiaPlayerState | null;
              players?: Player[];
              logs: MafiaLog[];
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
        setRoomEnded(json.roomEnded === true);
        setLogs(json.logs ?? []);
        setPlayers(json.players ?? []);
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

    void load(roomCode, nickname);

    return () => {
      cancelled = true;
    };
  }, [roomCode, nickname, reloadToken]);

  useEffect(() => {
    if (!roomCode) return;
    const events = new EventSource(
      `/api/mafia/phase-events?room=${encodeURIComponent(roomCode)}`
    );
    events.onmessage = () => setReloadToken((value) => value + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setReloadToken((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      events.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomCode]);

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "rules", "result"];
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
        { key: "auction", label: "경매" },
        { key: "trade", label: "거래" },
        { key: "ability", label: "능력" },
        { key: "result", label: "능력 결과" },
        { key: "vote", label: "투표" },
        { key: "rules", label: "규칙" },
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

  if (roomEnded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50">
        <p className="text-2xl font-black">게임이 종료되었습니다.</p>
      </div>
    );
  }

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
        roundLabel={roundLabel}
        phaseLabel={phaseLabel}
      />

      <p className="mt-2 text-sm text-red-300">
        이 화면은 다른 플레이어에게 보여주면 안 됩니다.
      </p>

      <p className="mt-2 text-xs text-zinc-600">관리자가 다음 단계로 넘기면 자동으로 갱신됩니다.</p>

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
          {activeTab === "auction" && (
            <MafiaAuctionTab
              player={player}
              roomCode={roomCode ?? player.room_code}
              myAuctionBet={myAuctionBet}
              playerCash={mafiaPlayer?.cash ?? null}
            />
          )}
          {activeTab === "trade" && (
            <MafiaTradeTab
              player={player}
              roomCode={roomCode ?? player.room_code}
              stocks={stocks}
              playerCash={mafiaPlayer?.cash ?? null}
              holdings={
                (mafiaPlayer?.stocks as
                  | import("@/lib/types").MafiaStocksHolding
                  | null) ?? null
              }
              myTradesThisRound={myTradesThisRound}
              onAssetsChange={({ cash, stocks: nextStocks }) => {
                setMafiaPlayer((current) =>
                  current
                    ? { ...current, cash, stocks: nextStocks }
                    : current
                );
              }}
            />
          )}
          {activeTab === "ability" && (
            <MafiaAbilityTab
              player={player}
              roomCode={roomCode ?? player.room_code}
              job={mafiaPlayer?.job ?? null}
              stocks={stocks}
              players={players}
              hasUsedAbilityThisPhase={hasUsedAbilityThisPhase}
              myAbilityActionThisPhase={myAbilityActionThisPhase}
              onAbilitySubmitted={(action) => {
                setHasUsedAbilityThisPhase(true);
                setMyAbilityActionThisPhase(action);
              }}
            />
          )}
          {activeTab === "result" && (
            <MafiaResultTab abilityResults={abilityResults} />
          )}
          {activeTab === "vote" && (
            <MafiaVoteTab
              player={player}
              roomCode={roomCode ?? player.room_code}
              ticketPrice={ticketPrice}
              playerCash={mafiaPlayer?.cash ?? null}
              players={players}
              myVoteSummary={myVoteSummary}
              onVoteSubmitted={({ target, vote_count, total_spent, cash }) => {
                setMafiaPlayer((current) =>
                  current ? { ...current, cash } : current
                );
                setMyVoteSummary((current) => {
                  const existing = current.find((item) => item.target === target);
                  if (!existing) {
                    return [...current, { target, vote_count, total_spent }];
                  }
                  return current.map((item) =>
                    item.target === target
                      ? {
                          ...item,
                          vote_count: item.vote_count + vote_count,
                          total_spent: item.total_spent + total_spent,
                        }
                      : item
                  );
                });
              }}
            />
          )}
        </TabLayout>
      </main>
    </div>
  );
}
