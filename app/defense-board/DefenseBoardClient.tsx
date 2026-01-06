"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardMonster, BoardApiResponse } from "./types";
import { DefenseBoardControls } from "./DefenseBoardControls";
import { DefenseBoardGrid } from "./DefenseBoardGrid";
import { DefenseBoardScores } from "./DefenseBoardScores";

type StepState = {
  step: number; // 0 = 준비, 1 = round1 스냅샷, 2 = round1 결과, 3 = round2 스냅샷, ...
};

const MAX_ROUND = 14;

function getRoundLabel(round: number | null): string {
  if (round == null) return "-";
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 13) {
    const gameRound = round - 3; // 4~13 -> 1~10라운드
    return `${gameRound}라운드`;
  }
  if (round === 14) return "게임 종료";
  return `알 수 없음 (DB round ${round})`;
}

export function DefenseBoardClient() {
  const [stepState, setStepState] = useState<StepState>({ step: 0 });
  const [dataByRound, setDataByRound] = useState<Map<number, BoardApiResponse>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoresByRound, setScoresByRound] = useState<
    Map<
      number,
      {
        playerId: string;
        nickname: string | null;
        points: number;
      }[]
    >
  >(() => new Map());
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresError, setScoresError] = useState<string | null>(null);

  const currentRound =
    stepState.step <= 0
      ? 0
      : Math.min(MAX_ROUND, Math.ceil(stepState.step / 2));
  const isResultView = stepState.step > 0 && stepState.step % 2 === 0;
  const isScoreRound = currentRound === 3 || currentRound === 14;

  const currentData = useMemo(() => {
    if (currentRound <= 0) return null;
    return dataByRound.get(currentRound) ?? null;
  }, [currentRound, dataByRound]);

  useEffect(() => {
    if (currentRound <= 0 || currentRound > 13) return;
    if (dataByRound.has(currentRound)) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ round: String(currentRound) });
        const res = await fetch(
          `/api/defense/board-state?${params.toString()}`
        );
        const json = (await res.json().catch(() => null)) as
          | BoardApiResponse
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "디펜스 중계 데이터를 불러오지 못했습니다."
          );
        }

        if (!cancelled) {
          setDataByRound((prev) => {
            const next = new Map(prev);
            next.set(currentRound, json as BoardApiResponse);
            return next;
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "디펜스 중계 데이터를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentRound, dataByRound]);

  // 튜토리얼 결과(3), 게임 종료(14)에서는 점수판을 보여주기 위해 별도 스코어 데이터 로드
  useEffect(() => {
    if (!isScoreRound || currentRound <= 0) return;
    if (scoresByRound.has(currentRound)) return;

    let cancelled = false;
    const loadScores = async () => {
      setScoresLoading(true);
      setScoresError(null);
      try {
        const params = new URLSearchParams({ round: String(currentRound) });
        const res = await fetch(
          `/api/defense/board-scores?${params.toString()}`
        );
        const json = (await res.json().catch(() => null)) as
          | {
              round: number;
              scores: {
                playerId: string;
                nickname: string | null;
                points: number;
              }[];
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "디펜스 점수 데이터를 불러오지 못했습니다."
          );
        }

        if (!cancelled) {
          const data = json as {
            round: number;
            scores: {
              playerId: string;
              nickname: string | null;
              points: number;
            }[];
          };
          setScoresByRound((prev) => {
            const next = new Map(prev);
            next.set(currentRound, data.scores);
            return next;
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "디펜스 점수 데이터를 불러오지 못했습니다.";
          setScoresError(message);
        }
      } finally {
        if (!cancelled) setScoresLoading(false);
      }
    };

    void loadScores();

    return () => {
      cancelled = true;
    };
  }, [currentRound, isScoreRound, scoresByRound]);

  const canPrev = stepState.step > 0;
  const canNext = stepState.step < MAX_ROUND * 2; // 라운드당 스냅샷/결과 두 단계

  const handlePrev = () => {
    if (!canPrev) return;
    setStepState((prev) => ({ step: Math.max(0, prev.step - 1) }));
  };

  const handleNext = () => {
    if (!canNext) return;
    setStepState((prev) => ({ step: prev.step + 1 }));
  };

  const roundLabel = getRoundLabel(currentRound === 0 ? 0 : currentRound);

  const title = (() => {
    if (currentRound === 0) return "준비";
    if (isScoreRound) return `${roundLabel}`;
    if (isResultView) return `${roundLabel} 전투 결과`;
    return `${roundLabel}`;
  })();

  const monstersForView: BoardMonster[] = useMemo(() => {
    if (!currentData) return [];
    return currentData.monsters;
  }, [currentData]);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <DefenseBoardControls
          title={title}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={handlePrev}
          onNext={handleNext}
        />

        {error && !isScoreRound && (
          <p className="text-base text-red-400">
            {roundLabel} 정보를 불러오지 못했습니다: {error}
          </p>
        )}
        {scoresError && isScoreRound && (
          <p className="text-base text-red-400">
            {roundLabel} 점수 정보를 불러오지 못했습니다: {scoresError}
          </p>
        )}

        {currentRound === 0 ? (
          <section className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-3xl text-zinc-300">
            곧 디펜스 딜레마가 시작됩니다!
          </section>
        ) : isScoreRound ? (
          scoresLoading && !scoresByRound.get(currentRound) ? (
            <p className="text-base text-zinc-400">
              {roundLabel} 점수 정보를 불러오는 중입니다...
            </p>
          ) : (
            <DefenseBoardScores
              scores={scoresByRound.get(currentRound) ?? []}
            />
          )
        ) : loading && !currentData ? (
          <p className="text-base text-zinc-400">
            {roundLabel} 정보를 불러오는 중입니다...
          </p>
        ) : (
          <DefenseBoardGrid
            monsters={monstersForView}
            isResultView={isResultView}
          />
        )}
      </div>
    </div>
  );
}
