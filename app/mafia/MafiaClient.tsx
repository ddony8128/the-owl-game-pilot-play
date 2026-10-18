"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { mafiaPhaseKey, mafiaTabForPhase } from "@/lib/mafia/phoneTabs";
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
  /** ITER6 B5 — GM 토글 '폰 로그 탭'(없으면 켜짐) */
  phoneLogs?: boolean;
};

export default function MafiaClient() {
  return (
    <PageGuard requireLogin allowGames={["mafia", "mafia_tutorial"]}>
      <MafiaInner />
    </PageGuard>
  );
}

function MafiaInner() {
  const router = useRouter();
  const { player, roomCode, nickname, clearNickname } = usePlayerAuth();
  // 강퇴/방 삭제 안내에서 [입장 화면으로]: 저장된 방·닉네임을 지우고 입장 화면으로 보낸다(같은 닉네임 재입장 가능).
  const leaveToEntrance = () => {
    clearNickname();
    router.replace("/");
  };
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
  const showLogs = data?.phoneLogs !== false;

  // ITER6 B3 — 단계가 바뀐 순간에만 그 단계의 탭으로 이동(폴링마다 끌어오지 않음). 렌더 중 파생 상태 갱신 패턴.
  const phaseKey = mafiaPhaseKey(phase?.round_number, phase?.phase);
  const [seenPhaseKey, setSeenPhaseKey] = useState<string | null>(null);
  if (phaseKey !== null && phaseKey !== seenPhaseKey) {
    setSeenPhaseKey(phaseKey);
    const target = mafiaTabForPhase(phase?.phase);
    if (target) setActiveTab(target);
  }

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "result", "stocks", "rules"];
    if (showLogs) base.push("log"); // ITER6 B5 — GM이 끄면 숨김(보고 있었으면 effectiveTab 이 정보로 돌린다)
    const current = phase?.phase;
    if (current === "auction") base.push("auction");
    if (current === "trade") {
      base.push("trade", "ability");
    }
    if (current === "vote") base.push("vote");
    return base;
  }, [phase?.phase, showLogs]);

  const tabsDef = useMemo(
    () =>
      [
        { key: "info", label: "정보" },
        { key: "auction", label: "경매" },
        { key: "trade", label: "거래" },
        { key: "ability", label: "능력" },
        { key: "result", label: "능력/투표결과" },
        { key: "vote", label: "투표" },
        { key: "stocks", label: "주가" },
        { key: "log", label: "로그" },
        { key: "rules", label: "규칙" },
      ].filter((t) => availableTabs.includes(t.key)),
    [availableTabs]
  );

  // 현재 페이즈에 없는 탭(예: 끝난 경매 탭)을 보고 있었다면 첫 탭으로 — effect 의 setState 대신 렌더에서 유도한다.
  const effectiveTab: TabKey = tabsDef.some((t) => t.key === activeTab) ? activeTab : tabsDef[0].key;

  if (!player) return <LoadingScreen />;

  // 강퇴/방 삭제: 입장은 통과했으므로 폴링 403 = GM이 명단에서 지운 것 → 즉시 안내. 404 = 방 없음.
  if (poll.status === 403) return <KickedScreen onLeave={leaveToEntrance} />;
  if (poll.status === 404 && poll.reason === "room_not_found") {
    return <RoomGoneScreen onLeave={leaveToEntrance} />;
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
      <MafiaHeader roundLabel={roundLabel} phaseLabel={phaseLabel} />

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
          {effectiveTab === "info" && (
            <MafiaInfoTab
              mafiaPlayer={mafiaPlayer}
              stocks={stocks}
              logs={logs}
            />
          )}
          {effectiveTab === "rules" && <MafiaRulesTab />}
          {effectiveTab === "stocks" && (
            <MafiaStocksTab stocks={stocks} stockHistory={stockHistory} />
          )}
          {effectiveTab === "auction" && (
            <MafiaAuctionTab
              player={player}
              roomCode={roomForTabs}
              myAuctionBet={myAuctionBet}
              playerCash={mafiaPlayer?.cash ?? null}
              roomEnded={roomEnded}
              onSubmitted={reload}
            />
          )}
          {effectiveTab === "trade" && (
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
          {effectiveTab === "ability" && (
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
          {effectiveTab === "result" && (
            <MafiaResultTab abilityResults={abilityResults} />
          )}
          {effectiveTab === "vote" && (
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
          {effectiveTab === "log" && <MafiaLogTab log={myLog} />}
        </TabLayout>
      </main>
    </div>
  );
}
