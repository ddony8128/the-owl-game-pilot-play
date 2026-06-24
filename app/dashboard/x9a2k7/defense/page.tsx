"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useDefenseAdminState } from "./useDefenseAdminState";
import { DefenseCountdownSection } from "./DefenseCountdownSection";
import { DefenseRoundSection } from "./DefenseRoundSection";
import { DefenseScoreSection } from "./DefenseScoreSection";
import { DefenseRoundSummarySection } from "./DefenseRoundSummarySection";
import { MonsterConfigSection } from "./MonsterConfigSection";

export default function DashboardDefensePage() {
  const [room] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("room")
      : null
  );

  const { round, players, loading, error, reload } = useDefenseAdminState(room);

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
      } | null;

      if (!res.ok || !json?.ok) {
        // eslint-disable-next-line no-console
        console.error(
          json?.error ?? "디펜스 라운드 변경 중 오류가 발생했습니다."
        );
      } else {
        reload();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
        console.error(
          json?.error ?? "디펜스 점수 변경 중 오류가 발생했습니다."
        );
      } else {
        reload();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

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
        <a
          href={`/defense-board?room=${room}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded bg-zinc-800 px-3 py-1.5 text-amber-300 hover:bg-zinc-700"
        >
          결과 페이지 ↗
        </a>
      </div>
      <DefenseCountdownSection room={room} />
      <DefenseRoundSection round={round} onAdvanceRound={advanceRound} />
      <MonsterConfigSection room={room} />
      <DefenseScoreSection players={players} onChangeScore={changeScore} />
      <DefenseRoundSummarySection room={room} />
    </div>
  );
}
