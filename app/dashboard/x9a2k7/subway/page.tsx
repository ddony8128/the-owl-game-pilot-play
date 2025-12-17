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
      <SubwayCountdownSection />

      <SubwayInteractionSection players={players} onReload={reload} />

      <SubwayStatusSection players={players} onReload={reload} />
    </div>
  );
}
