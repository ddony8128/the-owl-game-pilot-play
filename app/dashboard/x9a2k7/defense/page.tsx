"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoomEndedNotice } from "../RoomEndedNotice";
import { RuleVideoPanel } from "../RuleVideoPanel";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useDefenseAdminState } from "./useDefenseAdminState";
import { DefenseCountdownSection } from "./DefenseCountdownSection";
import { DefenseRoundSection } from "./DefenseRoundSection";
import { DefenseScoreSection } from "./DefenseScoreSection";
import { DefenseRoundSummarySection } from "./DefenseRoundSummarySection";
import { MonsterConfigSection } from "./MonsterConfigSection";
import { LazyDetails } from "../LazyDetails";

export default function DashboardDefensePage() {
  // 하이드레이션 안전: room(URL)·mounted 는 서버에서 알 수 없으므로 마운트 후에만 읽는다.
  // (서버·클라 첫 렌더가 동일한 로딩 화면이 되도록 하여 SSR/CSR 불일치를 방지)
  const [room, setRoom] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [endingGame, setEndingGame] = useState(false);
  const [gameEndError, setGameEndError] = useState<string | null>(null);
  useEffect(() => {
    setRoom(new URLSearchParams(window.location.search).get("room"));
    setMounted(true);
  }, []);

  const { round, resultPending, scorePending, players, loading, error, reload } = useDefenseAdminState(room);

  const endGame = async () => {
    if (!room || endingGame) return;
    const confirmed = window.confirm(
      "게임을 종료하시겠습니까? 종료 후 이 방은 종료된 방 목록으로 이동합니다."
    );
    if (!confirmed) return;

    setEndingGame(true);
    setGameEndError(null);
    try {
      const res = await fetch("/api/gm/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: room,
          status: "ended",
          ended_normally: true,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: true; error?: string }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "게임을 종료하지 못했습니다.");
      }
      window.location.href = "/dashboard/x9a2k7";
    } catch (e: unknown) {
      setGameEndError(
        e instanceof Error ? e.message : "게임을 종료하지 못했습니다."
      );
      setEndingGame(false);
    }
  };

  const advanceRound = async (nextRound: number) => {
    if (!room) return;
    try {
      const res = await fetch("/api/gm/defense/round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ round: nextRound, room }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
        board?: unknown;
      } | null;

      if (!res.ok || !json?.ok) {
        console.error(
          json?.error ?? "디펜스 라운드 변경 중 오류가 발생했습니다."
        );
      } else {
        reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const changeScore = async (playerId: string, delta: -1 | 1) => {
    if (!room) return;
    try {
      const res = await fetch("/api/gm/defense/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId, delta, room }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
        points?: number;
      } | null;

      if (!res.ok || !json?.ok) {
        console.error(
          json?.error ?? "디펜스 점수 변경 중 오류가 발생했습니다."
        );
      } else {
        reload();
      }
    } catch (e) {
      console.error(e);
    }
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

  const panelClass = "rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 pb-12 text-base">
      <div className="sticky top-16 z-30 -mx-3 flex flex-wrap items-center gap-3 border-b border-zinc-700 bg-zinc-950/95 px-3 py-3 shadow-xl shadow-black/20 backdrop-blur xl:top-0">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-emerald-400">DEFENSE DILEMMA</p>
          <p className="mt-0.5 text-xl font-black text-white">게임 진행실 <b className="ml-2 rounded-md bg-zinc-800 px-2 py-1 font-mono text-base text-amber-300">{room}</b></p>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300">● 참가자 {players.length}명</span>
        <button
          type="button"
          onClick={reload}
          className="ml-auto min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-200 hover:bg-zinc-800"
        >
          ↻ 현황 새로고침
        </button>
        <button
          type="button"
          onClick={() => void endGame()}
          disabled={endingGame}
          className="min-h-11 rounded-xl border border-red-500/60 bg-red-950/40 px-4 text-sm font-black text-red-200 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {endingGame ? "종료 처리 중..." : "■ 게임 종료"}
        </button>
        <a
          href={`/defense-board?room=${room}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-amber-300"
        >
          전광판 열기 ↗
        </a>
      </div>
      <RoomEndedNotice room={room} />
      {gameEndError ? <ErrorMessage message={gameEndError} /> : null}
      <section className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/25 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-4 flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"/><h2 className="text-sm font-black tracking-[0.16em] text-zinc-300">현재 게임 진행</h2></div>
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:divide-x lg:divide-zinc-700">
          <div className="lg:pr-5"><DefenseCountdownSection room={room} resultPending={resultPending} /></div>
          <div className="lg:pl-5"><DefenseRoundSection round={round} resultPending={resultPending} scorePending={scorePending} onAdvanceRound={advanceRound} /></div>
        </div>
      </section>
      <LazyDetails className={panelClass} summary={<span className="text-lg font-black text-white">현재 라운드 제출·몬스터 현황 <span className="ml-2 text-sm font-normal text-zinc-500">필요할 때 펼치기</span></span>}>
        <div className="mt-4"><DefenseRoundSummarySection room={room} currentRound={round} /></div>
      </LazyDetails>
      <details className={panelClass}>
        <summary className="cursor-pointer text-lg font-black text-white">점수 보정 <span className="ml-2 text-sm font-normal text-zinc-500">필요할 때만</span></summary>
        <div className="mt-4"><DefenseScoreSection players={players} onChangeScore={changeScore} /></div>
      </details>
      <LazyDetails className={panelClass} summary={<span className="text-lg font-bold text-white">설정 및 수동 관리 <span className="ml-2 text-sm font-normal text-zinc-500">몬스터 · 전광판 · 영상</span></span>}>
        <div className="mt-4 divide-y divide-zinc-800">
          <section className="pb-6">
            <h3 className="mb-3 text-base font-black text-white">몬스터 구성</h3>
            <MonsterConfigSection room={room} playerCount={players.length} />
          </section>
          <section className="py-6">
          </section>
          <section className="pt-6">
            <h3 className="mb-3 text-base font-black text-white">룰 영상</h3>
            <RuleVideoPanel room={room} video="defense" />
          </section>
        </div>
      </LazyDetails>
    </div>
  );
}
