"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { GameStateSection } from "./GameStateSection";
import { RulesSection } from "./RulesSection";
import { PlayerAdminSection } from "./PlayerAdminSection";
import { useDashboardMainState } from "./useDashboardMainState";

export default function DashboardMainPage() {
  const { gameState, rules, loading, error, changeGame, toggleRule } =
    useDashboardMainState();

  if (loading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 text-sm">
      <GameStateSection
        activeGame={gameState?.active_game ?? "ready"}
        onChangeGame={changeGame}
      />

      <RulesSection rules={rules} onToggleRule={toggleRule} />

      <PlayerAdminSection />
    </div>
  );
}
