"use client";

import { useEffect, useState } from "react";
import type { QuizPlayer, QuizQuestion, QuizSubmission } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function DashboardShowPage() {
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [, setQuestions] = useState<QuizQuestion[]>([]);
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
      <section>
        <h2 className="mb-2 text-base font-semibold">점수판</h2>
        <div className="space-y-1 text-xs">
          {players.map((p) => (
            <div
              key={p.player_id}
              className="flex items-center justify-between rounded bg-zinc-900 px-3 py-1"
            >
              <span>{playerNames[p.player_id] ?? p.player_id}</span>
              <span className="flex items-center gap-2">
                <button
                  className="h-6 w-6 rounded-full bg-zinc-800 text-xs"
                  onClick={() => updateScore(p.player_id, -1)}
                >
                  -
                </button>
                <span className="w-6 text-center text-amber-300">
                  {p.score ?? 0}
                </span>
                <button
                  className="h-6 w-6 rounded-full bg-zinc-800 text-xs"
                  onClick={() => updateScore(p.player_id, 1)}
                >
                  +
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-1 flex-col gap-2 text-xs">
        <h2 className="text-base font-semibold">제출 현황 / 채점</h2>
        <div className="flex-1 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-2">
          {subs.map((s) => (
            <div key={s.id} className="rounded bg-zinc-950 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span>
                  {playerNames[s.player_id ?? ""] ?? s.player_id} / Q
                  {s.question_id}
                </span>
                <span className="text-[10px] text-zinc-500">
                  result: {s.result ?? "-"}
                </span>
              </div>
              <p className="text-xs text-zinc-200">{s.answer}</p>
              <div className="mt-1 flex gap-1 text-[10px]">
                {[
                  ["correct", "정답"],
                  ["wrong", "오답"],
                  ["skip", "스킵"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`rounded px-2 py-0.5 ${
                      s.result === value
                        ? "bg-amber-400 text-zinc-950"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                    onClick={() => updateResult(s.id, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {subs.length === 0 && (
            <p className="text-zinc-400">아직 제출된 답안이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
