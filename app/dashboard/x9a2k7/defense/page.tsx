"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useDefenseAdminState } from "./useDefenseAdminState";
import { DefenseCountdownSection } from "./DefenseCountdownSection";
import { DefenseRoundSection } from "./DefenseRoundSection";
import { DefenseScoreSection } from "./DefenseScoreSection";
import { DefenseRoundSummarySection } from "./DefenseRoundSummarySection";

export default function DashboardDefensePage() {
  const { round, players, loading, error, reload } = useDefenseAdminState();

  const advanceRound = async (nextRound: number) => {
    try {
      const res = await fetch("/api/gm/defense/round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ round: nextRound }),
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
    try {
      const res = await fetch("/api/gm/defense/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId, delta }),
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
      <DefenseCountdownSection />
      <DefenseRoundSection round={round} onAdvanceRound={advanceRound} />
      <DefenseScoreSection players={players} onChangeScore={changeScore} />
      <DefenseRoundSummarySection />
    </div>
  );
}
