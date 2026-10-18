"use client";

import { useMemo, useState } from "react";
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
import { DefenseFinalResult } from "./DefenseFinalResult";

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
  endedEarlyFrom?: number | null;
  monsters: DefenseMonsterClient[];
  cards: DefenseCardClient[];
  score: number;
  action: DefenseActionClient;
  dex: DefenseDexEntry[];
  logs: DefenseLogEntry[];
  /** ITER6 C5 — GM 토글(없으면 켜짐) */
  phoneLogs?: boolean;
  phoneRemainingCount?: boolean;
};

export default function DefenseClient() {
  return (
    <PageGuard requireLogin allowGames={["defense"]}>
      <DefenseInner />
    </PageGuard>
  );
}

// 참가자 폰 — 상태는 공용 폴링 훅으로 따라간다(GM 이 단계를 넘기면 다음 tick 에 화면이 바뀐다).
// 폰에는 남은 시간을 표시하지 않는다(2026-10-18 또니 결정) — 타이머 폴링도 두지 않는다.
function DefenseInner() {
  const router = useRouter();
  const { player, roomCode, nickname, clearNickname } = usePlayerAuth();
  // 강퇴/방 삭제 안내에서 [입장 화면으로]: 저장된 방·닉네임을 지우고 입장 화면으로 보낸다(같은 닉네임 재입장 가능).
  const leaveToEntrance = () => {
    clearNickname();
    router.replace("/");
  };
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  // 플레이어 전용 상태 폴링(공용 훅): in-flight 가드·8초 타임아웃·실패해도 마지막 화면 유지.
  const stateUrl =
    roomCode && nickname
      ? `/api/defense/state?${new URLSearchParams({ room: roomCode, nickname }).toString()}`
      : null;
  const poll = usePolling<DefenseState>(stateUrl, 5000);
  const defenseState = poll.data;
  const loadState = poll.reload;

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

  const showLogs = defenseState?.phoneLogs !== false;
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

    // ITER6 C5 — GM이 로그 탭을 끄면 숨긴다(보고 있었으면 아래 effectiveTab 이 첫 탭=정보로 돌린다)
    return showLogs ? base : base.filter((t) => t.key !== "logs");
  }, [hideInfoAndAction, showLogs]);

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
      <DefenseHeader roundLabel={roundLabel} />

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
          {effectiveTab === "info" && roundNumber === 16 && (
            <DefenseFinalResult
              room={player.room_code}
              playerId={player.id}
              endedEarlyFrom={defenseState?.endedEarlyFrom ?? null}
            />
          )}
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
              notice={lateNotice}
            />
          )}
          {effectiveTab === "rules" && <DefenseRulesTab />}
          {effectiveTab === "dex" && defenseState && (
            <DefenseDexTab dex={defenseState.dex} showRemaining={defenseState.phoneRemainingCount !== false} />
          )}
          {effectiveTab === "logs" && defenseState && (
            <DefenseLogsTab logs={defenseState.logs} />
          )}
        </TabLayout>
      </main>
    </div>
  );
}
