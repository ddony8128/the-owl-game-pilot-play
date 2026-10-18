"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoomEndedNotice } from "../RoomEndedNotice";
import { RuleVideoPanel } from "../RuleVideoPanel";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { GmLogSection } from "@/components/GmLogSection";
import { useGmAction } from "@/lib/hooks/useGmAction";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { useMafiaAdminState } from "./useMafiaAdminState";
import { MafiaCountdownSection } from "./MafiaCountdownSection";
import { MafiaPhaseSection } from "./MafiaPhaseSection";
import { MafiaAssetsSection } from "./MafiaAssetsSection";
import { MafiaStocksSection } from "./MafiaStocksSection";
import { MafiaLogsSection } from "./MafiaLogsSection";
import { MafiaRoundSummarySection } from "./MafiaRoundSummarySection";
import { MafiaRevealSection } from "./MafiaRevealSection";
import type { MafiaLog, MafiaPhase } from "@/lib/types";

export default function DashboardMafiaPage() {
  // 하이드레이션 안전: room(URL)·mounted 는 서버에서 알 수 없으므로 마운트 후에만 읽는다.
  // (서버·클라 첫 렌더가 동일한 로딩 화면이 되도록 하여 SSR/CSR 불일치를 방지)
  const [room, setRoom] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 은 마운트 후에만 읽을 수 있다
    setRoom(new URLSearchParams(window.location.search).get("room"));
    setMounted(true);
  }, []);

  const {
    phase,
    stocks,
    players,
    playerNames,
    playerCount,
    logs,
    pending,
    roomStatus,
    revealResult,
    gmLogs,
    gmLogsWarning,
    loading,
    error,
    failures,
    reload,
  } = useMafiaAdminState(room);
  const action = useGmAction(reload);
  const ended = roomStatus === "ended";
  const finished = (phase?.round_number ?? 0) >= 5 && phase?.phase === "end";

  const changePhase = async (to: MafiaPhase, from: MafiaPhase) => {
    if (!room) return;
    await action.run<{ idempotent?: boolean }>(
      "/api/gm/mafia/advance-phase",
      { body: { to, from, room } },
      {
        notice: (json) =>
          json.idempotent ? "이미 그 단계입니다(다른 창에서 진행됨)." : `${getMafiaPhaseLabel(to)} 단계로 전환했습니다.`,
      },
    );
  };

  const changeRound = async (round: number, from: number) => {
    if (!room) return;
    await action.run<{ idempotent?: boolean }>(
      "/api/gm/mafia/phase",
      { body: { round, from, room } },
      { notice: round === 0 ? "튜토리얼 준비 단계" : `${round}라운드 준비 단계` },
    );
  };

  const rewind = async (from: MafiaPhase) => {
    if (!room) return;
    await action.run<{ phase?: { phase: MafiaPhase } }>(
      "/api/gm/mafia/rewind",
      { body: { room, from } },
      { notice: (json) => `${getMafiaPhaseLabel(json.phase?.phase ?? null)} 단계로 되돌렸습니다.` },
    );
  };

  const adjust = async (playerId: string, kind: "cash" | "stock", delta: 1 | -1, stockKey?: string) => {
    if (!room) return;
    await action.run("/api/gm/mafia/adjust", { body: { room, playerId, kind, delta, stock_key: stockKey } });
  };

  const toggleReveal = async (next: boolean) => {
    if (!room) return;
    await action.run(
      "/api/gm/rooms",
      { method: "PATCH", body: { code: room, reveal_result: next } },
      { notice: next ? "결과 공개를 켰습니다." : "결과 공개를 껐습니다." },
    );
  };

  const [localLogs, setLocalLogs] = useState<MafiaLog[]>([]);
  const handleLogAdded = (log: MafiaLog) => {
    // 폴링이 따라오기 전까지 화면에 바로 보이게 한다(다음 폴링에서 서버 목록으로 대체).
    setLocalLogs((prev) => [log, ...prev]);
    void reload();
  };
  const mergedLogs = [...localLogs.filter((l) => !logs.some((s) => s.id === l.id)), ...logs];

  if (!mounted) return <LoadingScreen />;

  if (!room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm">
        <p className="text-zinc-300">방이 선택되지 않았습니다.</p>
        <Link
          href="/dashboard/x9a2k7"
          className="rounded bg-amber-400 px-3 py-1 font-semibold text-zinc-950 hover:bg-amber-300"
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
    <div className="flex flex-1 flex-col gap-4 text-sm">
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
          href={`/mafia-board?room=${room}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-zinc-800 px-3 py-1.5 text-amber-300 hover:bg-zinc-700"
        >
          보드 ↗
        </a>
      </div>
      <div className="sticky top-0 z-40 space-y-2 bg-zinc-950/95 py-1 empty:hidden">
        <GmErrorBanner message={action.error} onClose={action.clearError} />
        <GmNoticeBanner message={action.notice} />
      </div>

      <RoomEndedNotice room={room} />
      <RuleVideoPanel room={room} video="mafia" />
      <MafiaCountdownSection phase={phase} room={room} action={action} disabled={ended} />

      <MafiaPhaseSection
        phase={phase}
        playerCount={playerCount}
        pending={pending}
        disabled={ended}
        busy={action.busy}
        onChangePhase={changePhase}
        onChangeRound={changeRound}
        onRewind={rewind}
      />

      <MafiaRevealSection
        reveal={revealResult}
        finished={finished}
        disabled={false}
        busy={action.busy}
        onToggle={toggleReveal}
      />

      <MafiaAssetsSection
        players={players}
        playerNames={playerNames}
        stocks={stocks}
        onAdjust={adjust}
        disabled={ended || action.busy}
      />

      <MafiaStocksSection stocks={stocks} />

      <GmLogSection logs={gmLogs} warning={gmLogsWarning} />

      <MafiaRoundSummarySection currentRound={phase?.round_number} room={room} />

      <MafiaLogsSection logs={mergedLogs} onLogAdded={handleLogAdded} room={room} />
    </div>
  );
}
