"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useMafiaAdminState } from "./useMafiaAdminState";
import { MafiaCountdownSection } from "./MafiaCountdownSection";
import { MafiaPhaseSection } from "./MafiaPhaseSection";
import { MafiaAssetsSection } from "./MafiaAssetsSection";
import { MafiaStocksSection } from "./MafiaStocksSection";
import { MafiaLogsSection } from "./MafiaLogsSection";
import { MafiaRoundSummarySection } from "./MafiaRoundSummarySection";
import type { MafiaLog } from "@/lib/types";

export default function DashboardMafiaPage() {
  const { phase, stocks, players, playerNames, logs, loading, error, reload } =
    useMafiaAdminState();

  const changePhase = async (to: string) => {
    try {
      const res = await fetch("/api/gm/mafia/advance-phase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        // eslint-disable-next-line no-console
        console.error(json?.error ?? "페이즈 전환 중 오류가 발생했습니다.");
      } else {
        // 성공 시 즉시 상태를 다시 로딩해 반영
        reload();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleLogAdded = (log: MafiaLog) => {
    // useMafiaAdminState가 가진 logs는 변경 불가이므로,
    // 최신 로그는 MafiaLogsSection 내부에서만 관리하거나
    // 향후 훅에 onLogAdded를 통합하는 방향으로 개선 가능.
    // 현재는 별도 리프레시 없이 화면상 목록에만 추가.
    logs.unshift(log);
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
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <MafiaCountdownSection phase={phase} />

      <MafiaPhaseSection
        phase={phase}
        onChangePhase={changePhase}
        onChangeRound={async (round) => {
          try {
            const res = await fetch("/api/gm/mafia/phase", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ round }),
            });
            const json = (await res.json().catch(() => null)) as {
              ok?: true;
              error?: string;
            } | null;
            if (!res.ok || !json?.ok) {
              // eslint-disable-next-line no-console
              console.error(
                json?.error ?? "라운드 변경 중 오류가 발생했습니다."
              );
            } else {
              reload();
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
          }
        }}
      />

      <MafiaAssetsSection
        players={players}
        playerNames={playerNames}
        stocks={stocks}
      />

      <MafiaStocksSection stocks={stocks} />

      <MafiaRoundSummarySection currentRound={phase?.round_number} />

      <MafiaLogsSection logs={logs} onLogAdded={handleLogAdded} />
    </div>
  );
}
