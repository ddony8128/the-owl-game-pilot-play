"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { GameStateSection } from "./GameStateSection";
import { PlayerAdminSection } from "./PlayerAdminSection";
import { RulesSection } from "./RulesSection";
import { FeatherSection } from "./FeatherSection";
import { useDashboardMainState } from "./useDashboardMainState";

export default function DashboardMainPage() {
  const [voteSummaryError, setVoteSummaryError] = useState<string | null>(null);
  const [voteSummaries, setVoteSummaries] = useState<
    {
      topic: string;
      target_id: string | null;
      target_nickname: string | null;
      votes: number;
      reasons: string[];
    }[]
  >([]);

  const {
    gameState,
    rules,
    players,
    loading,
    error,
    changeGame,
    toggleRule,
    updateFeather,
  } = useDashboardMainState();

  useEffect(() => {
    const loadVotes = async () => {
      try {
        const res = await fetch("/api/gm/votes/summary");
        const json = (await res.json().catch(() => null)) as
          | {
              summaries: {
                topic: string;
                target_id: string | null;
                target_nickname: string | null;
                votes: number;
                reasons: string[];
              }[];
              error?: undefined;
            }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "투표 결과를 불러오지 못했습니다."
          );
        }
        setVoteSummaries(json.summaries ?? []);
        setVoteSummaryError(null);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "투표 결과를 불러오지 못했습니다.";
        setVoteSummaryError(message);
      }
    };

    void loadVotes();
  }, []);

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

      <PlayerAdminSection />

      <RulesSection rules={rules} onToggleRule={toggleRule} />

      <FeatherSection players={players} onChangeFeather={updateFeather} />

      <section className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">투표 결과</h2>
          <button
            className="h-7 rounded bg-zinc-800 px-2 text-[11px] text-zinc-100 hover:bg-zinc-700"
            onClick={async () => {
              try {
                const res = await fetch("/api/gm/votes/summary");
                const json = (await res.json().catch(() => null)) as
                  | {
                      summaries: {
                        topic: string;
                        target_id: string | null;
                        target_nickname: string | null;
                        votes: number;
                        reasons: string[];
                      }[];
                      error?: undefined;
                    }
                  | { error: string }
                  | null;
                if (!res.ok || !json || "error" in json) {
                  throw new Error(
                    (json as { error?: string })?.error ??
                      "투표 결과를 불러오지 못했습니다."
                  );
                }
                setVoteSummaries(json.summaries ?? []);
                setVoteSummaryError(null);
              } catch (e: unknown) {
                const message =
                  e instanceof Error
                    ? e.message
                    : "투표 결과를 불러오지 못했습니다.";
                setVoteSummaryError(message);
              }
            }}
          >
            새로고침
          </button>
        </div>
        {voteSummaryError && (
          <p className="text-[11px] text-red-400">{voteSummaryError}</p>
        )}
        <div className="space-y-2 rounded-lg bg-zinc-900 p-2">
          {voteSummaries.length === 0 && (
            <p className="text-zinc-400">아직 집계된 투표 데이터가 없습니다.</p>
          )}
          {voteSummaries.map((s, idx) => (
            <details key={`${s.topic}-${s.target_id}-${idx}`} className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded bg-zinc-950 px-2 py-1 text-[11px]">
                <span>
                  {s.topic} / {s.target_nickname ?? s.target_id ?? "unknown"} —{" "}
                  {s.votes}표
                </span>
                <span className="text-[10px] text-zinc-500">
                  사유 {s.reasons.length}개
                </span>
              </summary>
              <ul className="mt-1 space-y-1 border-l border-zinc-700 pl-3 text-[11px] text-zinc-200">
                {s.reasons.map((r, i) => (
                  <li key={i} className="whitespace-pre-wrap">
                    - {r}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
