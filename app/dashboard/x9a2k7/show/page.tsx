"use client";

import { useEffect, useState } from "react";
import type { QuizPlayer, QuizQuestion, QuizSubmission } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ShowScoreSection } from "./ShowScoreSection";
import { ShowSubmissionSection } from "./ShowSubmissionSection";

export default function DashboardShowPage() {
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [subs, setSubs] = useState<QuizSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gm/quiz/show-state");
        const json = (await res.json().catch(() => null)) as
          | {
              players: QuizPlayer[];
              questions: QuizQuestion[];
              subs: QuizSubmission[];
              playerNames: Record<string, string>;
              error?: undefined;
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "쇼 정보를 불러오지 못했습니다."
          );
        }

        if (cancelled) return;

        setPlayers(json.players ?? []);
        setQuestions(json.questions ?? []);
        setSubs(json.subs ?? []);
        setPlayerNames(json.playerNames ?? {});
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "쇼 정보를 불러오지 못했습니다.";
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
  }, []);

  const updateScore = async (playerId: string, delta: number) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/quiz/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ player_id: playerId, delta }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        score?: number;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok || typeof json.score !== "number") {
        throw new Error(json?.error ?? "점수를 업데이트하지 못했습니다.");
      }
      const next = json.score;
      setPlayers((prev) =>
        prev.map((p) => (p.player_id === playerId ? { ...p, score: next } : p))
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "점수를 업데이트하지 못했습니다.";
      setError(message);
    }
  };

  const updateResult = async (id: number, result: string) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/quiz/submission-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, result }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "채점 결과를 반영하지 못했습니다.");
      }
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, result } : s)));
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "채점 결과를 반영하지 못했습니다.";
      setError(message);
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
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <ShowScoreSection
        players={players}
        playerNames={playerNames}
        onChangeScore={updateScore}
        onHiddenBonus={async (playerId) => {
          setError(null);
          try {
            const res = await fetch("/api/gm/quiz/hidden-bonus", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ player_id: playerId }),
            });
            const json = (await res.json().catch(() => null)) as {
              ok?: true;
              error?: string;
            } | null;
            if (!res.ok || !json?.ok) {
              throw new Error(
                json?.error ?? "히든 피스 보너스를 적용하지 못했습니다."
              );
            }
          } catch (e: unknown) {
            const message =
              e instanceof Error
                ? e.message
                : "히든 피스 보너스를 적용하지 못했습니다.";
            setError(message);
          }
        }}
      />

      <ShowSubmissionSection
        subs={subs}
        playerNames={playerNames}
        questions={questions}
        onUpdateResult={updateResult}
      />
    </div>
  );
}
