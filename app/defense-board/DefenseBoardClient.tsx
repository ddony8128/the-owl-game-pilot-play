"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardMonster, BoardApiResponse } from "./types";
import { DefenseBoardControls } from "./DefenseBoardControls";
import { DefenseBoardGrid } from "./DefenseBoardGrid";
import { DefenseBoardScores } from "./DefenseBoardScores";

type ViewKind = "ready" | "snapshot" | "result" | "score";

type StepState = {
  step: number; // TIMELINE 인덱스
};

// 중계 타임라인 정의:
// - 0: 준비
// - 각 전투 라운드: 스냅샷 -> 전투 결과
// - 지정된 라운드 후: 점수 발표(score)
const TIMELINE: { round: number | null; kind: ViewKind }[] = [
  { round: null, kind: "ready" }, // 0
  // 튜토리얼 1, 2라운드
  { round: 1, kind: "snapshot" }, // 1
  { round: 1, kind: "result" }, // 2
  { round: 2, kind: "snapshot" }, // 3
  { round: 2, kind: "result" }, // 4
  // 튜토리얼 결과: 점수 발표
  { round: 3, kind: "score" }, // 5
  // 본게임 1~3라운드
  { round: 4, kind: "snapshot" }, // 6
  { round: 4, kind: "result" }, // 7
  { round: 5, kind: "snapshot" }, // 8
  { round: 5, kind: "result" }, // 9
  { round: 6, kind: "snapshot" }, // 10
  { round: 6, kind: "result" }, // 11
  // 본게임 4라운드 결과 후 점수 발표
  { round: 7, kind: "snapshot" }, // 12
  { round: 7, kind: "result" }, // 13
  { round: 7, kind: "score" }, // 14
  // 본게임 5~7라운드
  { round: 8, kind: "snapshot" }, // 15
  { round: 8, kind: "result" }, // 16
  { round: 9, kind: "snapshot" }, // 17
  { round: 9, kind: "result" }, // 18
  { round: 10, kind: "snapshot" }, // 19
  { round: 10, kind: "result" }, // 20
  // 본게임 8라운드 결과 후 점수 발표
  { round: 11, kind: "snapshot" }, // 21
  { round: 11, kind: "result" }, // 22
  { round: 11, kind: "score" }, // 23
  // 본게임 9~12라운드
  { round: 12, kind: "snapshot" }, // 24
  { round: 12, kind: "result" }, // 25
  { round: 13, kind: "snapshot" }, // 26
  { round: 13, kind: "result" }, // 27
  { round: 14, kind: "snapshot" }, // 28
  { round: 14, kind: "result" }, // 29
  { round: 15, kind: "snapshot" }, // 30
  { round: 15, kind: "result" }, // 31
  // 게임 종료: 최종 점수 발표
  { round: 16, kind: "score" }, // 32
];

function getRoundLabel(round: number | null): string {
  if (round == null) return "-";
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 15) {
    const gameRound = round - 3; // 4~15 -> 1~12라운드
    return `${gameRound}라운드`;
  }
  if (round === 16) return "게임 종료";
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

  const currentStep = Math.max(
    0,
    Math.min(stepState.step, TIMELINE.length - 1)
  );
  const currentEntry = TIMELINE[currentStep];
  const currentRound = currentEntry.round ?? 0;
  const viewKind = currentEntry.kind;
  const isResultView = viewKind === "result";
  const isScoreRound = viewKind === "score";

  const currentData = useMemo(() => {
    if (currentRound <= 0) return null;
    return dataByRound.get(currentRound) ?? null;
  }, [currentRound, dataByRound]);

  useEffect(() => {
    if (currentRound <= 0 || currentRound > 15) return;
    if (viewKind === "score" || viewKind === "ready") return;

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
  }, [currentRound, viewKind]);

  // 튜토리얼 결과(3), 게임 종료(14)에서는 점수판을 보여주기 위해 별도 스코어 데이터 로드
  useEffect(() => {
    if (!isScoreRound || currentRound <= 0) return;

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
  }, [currentRound, isScoreRound]);

  const canPrev = currentStep > 0;
  const canNext = currentStep < TIMELINE.length - 1;

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
