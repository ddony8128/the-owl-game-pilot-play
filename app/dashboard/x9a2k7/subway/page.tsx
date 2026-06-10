"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useSubwayAdminState } from "./useSubwayAdminState";
import { SubwayCountdownSection } from "./SubwayCountdownSection";
import { SubwayInteractionSection } from "./SubwayInteractionSection";
import { SubwayStatusSection } from "./SubwayStatusSection";

export default function DashboardSubwayPage() {
  const { players, loading, error, reload } = useSubwayAdminState();

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
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="text-xs text-zinc-400">
          보존된 플레이 기록 (reset 해도 유지)
        </span>
        <a
          href="/api/gm/subway/records?format=csv"
          className="h-7 rounded bg-zinc-800 px-3 text-[11px] leading-7 text-zinc-100 hover:bg-zinc-700"
        >
          플레이 기록 CSV 내려받기
        </a>
      </div>

      <SubwayCountdownSection />

      <SubwayInteractionSection players={players} onReload={reload} />

      <SubwayStatusSection players={players} onReload={reload} />
    </div>
  );
}
