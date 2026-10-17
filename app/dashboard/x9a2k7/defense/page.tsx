"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoomEndedNotice } from "../RoomEndedNotice";
import { RuleVideoPanel } from "../RuleVideoPanel";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { GmLogSection } from "@/components/GmLogSection";
import { useGmAction } from "@/lib/hooks/useGmAction";
import { getDefenseRoundLabel } from "@/lib/admin/defenseLabels";
import { useDefenseAdminState } from "./useDefenseAdminState";
import { DefenseCountdownSection } from "./DefenseCountdownSection";
import { DefenseRoundSection } from "./DefenseRoundSection";
import { DefenseScoreSection } from "./DefenseScoreSection";
import { DefenseRoundSummarySection } from "./DefenseRoundSummarySection";
import { MonsterConfigSection } from "./MonsterConfigSection";

export default function DashboardDefensePage() {
  // 하이드레이션 안전: room(URL)·mounted 는 서버에서 알 수 없으므로 마운트 후에만 읽는다.
  // (서버·클라 첫 렌더가 동일한 로딩 화면이 되도록 하여 SSR/CSR 불일치를 방지)
  const [room, setRoom] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 은 마운트 후에만 읽을 수 있다
    setRoom(new URLSearchParams(window.location.search).get("room"));
    setMounted(true);
  }, []);

  const { round, players, pending, roomStatus, gmLogs, gmLogsWarning, loading, error, failures, reload } =
    useDefenseAdminState(room);
  // 모든 GM 조작은 이 하나를 거친다: 잠금·12초 제한·실패 배너·성공 후 즉시 갱신.
  const action = useGmAction(reload);
  const ended = roomStatus === "ended";

  const advanceRound = async (nextRound: number, from: number) => {
    if (!room) return;
    await action.run<{ idempotent?: boolean; earlyEnd?: boolean }>(
      "/api/gm/defense/round",
      { body: { round: nextRound, from, room } },
      {
        notice: (json) =>
          json.idempotent
            ? "이미 그 라운드입니다(다른 창에서 진행됨)."
            : json.earlyEnd
              ? "모든 몬스터가 처치·도망해 최종 결과로 넘어갔습니다(조기 종료)."
              : `${getDefenseRoundLabel(nextRound)} 시작`,
      },
    );
  };

  const rewind = async (from: number) => {
    if (!room) return;
    await action.run<{ phase?: { round: number } }>(
      "/api/gm/defense/rewind",
      { body: { room, from } },
      { notice: (json) => `${getDefenseRoundLabel(json.phase?.round ?? from - 1)}로 되돌렸습니다.` },
    );
  };

  const changeScore = async (playerId: string, delta: -1 | 1) => {
    if (!room) return;
    await action.run("/api/gm/defense/score", { body: { playerId, delta, room } });
  };

  if (!mounted) return <LoadingScreen />;

  if (!room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-base text-zinc-300">
        <p>방이 선택되지 않았습니다.</p>
        <Link
          href="/dashboard/x9a2k7"
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 text-base">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-400">
          방 <b className="font-mono text-amber-300">{room}</b>
        </span>
        <ConnectionBadge failures={failures} className="ml-2" />
        <button
          onClick={() => window.open(`/join?code=${room}`, "owl-join", "width=720,height=900")}
          title="참가 QR과 방 코드를 새 창에 크게 띄웁니다 (입장·중간 합류·재접속용)"
          data-testid="join-qr-open"
          className="ml-auto rounded bg-zinc-800 px-3 py-1.5 text-amber-300 hover:bg-zinc-700"
        >
          📲 참가 QR
        </button>
        <a
          href={`/defense-board?room=${room}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-zinc-800 px-3 py-1.5 text-amber-300 hover:bg-zinc-700"
        >
          결과 페이지 ↗
        </a>
      </div>
      <div className="sticky top-0 z-40 space-y-2 bg-zinc-950/95 py-1 empty:hidden">
        <GmErrorBanner message={action.error} onClose={action.clearError} />
        <GmNoticeBanner message={action.notice} />
      </div>
      <RoomEndedNotice room={room} />
      <RuleVideoPanel room={room} video="defense" />
      <DefenseCountdownSection room={room} action={action} disabled={ended} />
      <DefenseRoundSection
        round={round}
        playerCount={players.length}
        pending={pending}
        disabled={ended}
        busy={action.busy}
        onAdvanceRound={advanceRound}
        onRewind={rewind}
      />
      <MonsterConfigSection room={room} playerCount={players.length} action={action} disabled={ended} />
      <DefenseScoreSection players={players} onChangeScore={changeScore} disabled={ended || action.busy} />
      <GmLogSection logs={gmLogs} warning={gmLogsWarning} />
      <DefenseRoundSummarySection room={room} currentRound={round} />
    </div>
  );
}
