"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoomEndedNotice } from "../RoomEndedNotice";
import { RuleVideoPanel } from "../RuleVideoPanel";
import { ErrorMessage } from "@/components/ErrorMessage";
import { GmErrorBanner, GmNoticeBanner } from "@/components/GmBanners";
import { GmLogSection } from "@/components/GmLogSection";
import { PhoneTogglesSection } from "@/components/PhoneTogglesSection";
import { GmRoomHeader } from "@/components/GmRoomHeader";
import { useGmAction } from "@/lib/hooks/useGmAction";
import { getDefenseRoundLabel } from "@/lib/admin/defenseLabels";
import { useDefenseAdminState } from "./useDefenseAdminState";
import { DefenseCountdownSection } from "./DefenseCountdownSection";
import { DefenseRoundSection } from "./DefenseRoundSection";
import { DefenseScoreSection } from "./DefenseScoreSection";
import { DefenseRoundSummarySection } from "./DefenseRoundSummarySection";
import { MonsterConfigSection } from "./MonsterConfigSection";

const panelClass = "rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm";

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

  const { round, stage, prevRound, players, pending, roomStatus, phoneToggles, gmLogs, gmLogsWarning, loading, error, failures, reload } =
    useDefenseAdminState(room);
  // 모든 GM 조작은 이 하나를 거친다: 잠금·12초 제한·실패 배너·성공 후 즉시 갱신.
  const action = useGmAction(reload);
  const ended = roomStatus === "ended";

  // [다음] — 단계 하나를 넘긴다(라운드 전환·정산·타이머·보드 화면은 서버가 단계에 맞춰 처리)
  const togglePhone = async (key: "phone_logs" | "phone_remaining_count", next: boolean) => {
    if (!room) return;
    const what = key === "phone_logs" ? "참가자 폰 로그 탭" : "참가자 폰 도감 남은 수";
    await action.run("/api/gm/rooms", { method: "PATCH", body: { code: room, [key]: next } }, {
      notice: `${what}${next ? "을 보이게 했습니다." : "을 숨겼습니다."}`,
    });
  };

  const next = async (from: { round: number; stage: string }) => {
    if (!room) return;
    await action.run<{ idempotent?: boolean; earlyEnd?: boolean; label?: string }>(
      "/api/gm/defense/step",
      { body: { room, from } },
      {
        notice: (json) =>
          json.idempotent
            ? "이미 넘어간 단계입니다(다른 창에서 진행됨)."
            : json.earlyEnd
              ? "모든 몬스터가 처치·도망해 최종 결과로 넘어갑니다(조기 종료)."
              : `${json.label ?? "다음 단계"} — 진행했습니다.`,
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
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 pb-12 text-base">
      <GmRoomHeader
        eyebrow="DEFENSE DILEMMA"
        eyebrowClass="text-emerald-400"
        room={room}
        playerCount={players.length}
        failures={failures}
        boardHref={`/defense-board?room=${room}`}
        ended={ended}
        action={action}
        onReload={reload}
      />
      <div className="sticky top-[7.5rem] z-20 space-y-2 bg-zinc-950/95 py-1 empty:hidden xl:top-[4.5rem]">
        <GmErrorBanner message={action.error} onClose={action.clearError} />
        <GmNoticeBanner message={action.notice} />
      </div>
      <RoomEndedNotice room={room} />

      <section className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/25 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
          <h2 className="text-sm font-black tracking-[0.16em] text-zinc-300">현재 게임 진행</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:divide-x lg:divide-zinc-700">
          <div className="lg:pr-5">
            <DefenseCountdownSection room={room} action={action} disabled={ended} stage={stage} />
          </div>
          <div className="lg:pl-5">
            <DefenseRoundSection
              round={round}
              stage={stage}
              prevRound={prevRound}
              playerCount={players.length}
              pending={pending}
              disabled={ended}
              busy={action.busy}
              onNext={next}
              onRewind={rewind}
            />
          </div>
        </div>
      </section>

      {/* ITER6 A — 저쪽 UI 배치: 진행 아래 패널은 접어 두고 필요할 때 펼친다(제출 현황 → 점수 보정 → 설정 및 수동 관리) */}
      <details className={panelClass} data-testid="panel-round-summary">
        <summary className="cursor-pointer text-lg font-black text-white">
          현재 라운드 제출·몬스터 현황 <span className="ml-2 text-sm font-normal text-zinc-500">필요할 때 펼치기</span>
        </summary>
        <div className="mt-4">
          <DefenseRoundSummarySection room={room} currentRound={round} />
        </div>
      </details>

      <details className={panelClass}>
        <summary className="cursor-pointer text-lg font-black text-white">
          점수 보정 <span className="ml-2 text-sm font-normal text-zinc-500">필요할 때만</span>
        </summary>
        <div className="mt-4">
          <DefenseScoreSection players={players} onChangeScore={changeScore} disabled={ended || action.busy} />
        </div>
      </details>

      <details className={panelClass} data-testid="panel-settings">
        <summary className="cursor-pointer text-lg font-bold text-white">
          설정 및 수동 관리 <span className="ml-2 text-sm font-normal text-zinc-500">몬스터 · 참가자 폰 · 영상</span>
        </summary>
        <div className="mt-4 divide-y divide-zinc-800">
          <div className="pb-6">
            <h3 className="mb-1 text-base font-black text-white">몬스터 구성</h3>
            <p className="mb-3 text-xs text-zinc-500">튜토리얼 시작 때 인원에 맞춰 자동 세팅 · 직접 바꿀 때만</p>
            <MonsterConfigSection room={room} playerCount={players.length} action={action} disabled={ended} />
          </div>
          <div className="py-6">
            <PhoneTogglesSection game="defense" toggles={phoneToggles} disabled={ended} busy={action.busy} onToggle={togglePhone} />
          </div>
          <div className="pt-6">
            <h3 className="mb-3 text-base font-black text-white">룰 영상</h3>
            <RuleVideoPanel room={room} video="defense" />
          </div>
        </div>
      </details>

      <div className={panelClass}>
        <GmLogSection logs={gmLogs} warning={gmLogsWarning} />
      </div>
    </div>
  );
}
