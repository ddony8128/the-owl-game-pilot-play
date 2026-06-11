"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubwayPlayerState } from "@/lib/types";
import { SUBWAY_RULES } from "@/app/api/subway/rules";

const WRONG_LIMIT = 15;

// 중계 타임라인:
// - step 0: 최종 결과(등수)
// - step 1..N: 규칙 해설 (규칙 0~8을 한 개씩, 좌측에 전체 리스트)
const RULE_STEP_OFFSET = 1;
const TOTAL_STEPS = RULE_STEP_OFFSET + SUBWAY_RULES.length;

type RankedRow = {
  playerId: string;
  nickname: string | null;
  resetCount: number;
  finishedRank: number;
  clearSeconds: number | null;
  rank: number;
  overLimit: boolean;
};

function formatClearTime(sec: number | null | undefined): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s.toString().padStart(2, "0")}초`;
}

function rankBadgeClass(rank: number, overLimit: boolean): string {
  if (overLimit) return "bg-zinc-700 text-zinc-100";
  if (rank === 1) return "bg-amber-400 text-zinc-950";
  if (rank === 2) return "bg-zinc-300 text-zinc-950";
  if (rank === 3) return "bg-amber-700 text-amber-50";
  return "bg-zinc-700 text-zinc-100";
}

export function SubwayBoardClient() {
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<SubwayPlayerState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/subway/state?all=1");
        const json = (await res.json().catch(() => null)) as
          | { state: SubwayPlayerState[] }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "이상교통 결과 데이터를 불러오지 못했습니다."
          );
        }
        if (!cancelled) setRows(json.state ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "이상교통 결과 데이터를 불러오지 못했습니다."
          );
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

  // 등수 산정: (1) 15회 이하 틀린 탈출자 → 탈출 순서 우선
  //            (2) 15회 초과 탈출자 → 그 뒤에, 적게 틀린 순서 우선
  const { ranked, failed } = useMemo(() => {
    const escaped = rows.filter((r) => r.is_finished && r.finished_rank != null);
    const tier1 = escaped
      .filter((r) => r.reset_count <= WRONG_LIMIT)
      .sort((a, b) => (a.finished_rank ?? 0) - (b.finished_rank ?? 0));
    const tier2 = escaped
      .filter((r) => r.reset_count > WRONG_LIMIT)
      .sort(
        (a, b) =>
          a.reset_count - b.reset_count ||
          (a.finished_rank ?? 0) - (b.finished_rank ?? 0)
      );

    const rankedRows: RankedRow[] = [...tier1, ...tier2].map((r, i) => ({
      playerId: r.player_id,
      nickname: r.nickname ?? null,
      resetCount: r.reset_count,
      finishedRank: r.finished_rank ?? 0,
      clearSeconds: r.clear_seconds ?? null,
      rank: i + 1,
      overLimit: r.reset_count > WRONG_LIMIT,
    }));

    const failedRows = rows.filter(
      (r) => !(r.is_finished && r.finished_rank != null)
    );

    return { ranked: rankedRows, failed: failedRows };
  }, [rows]);

  const firstOverLimitRank = ranked.find((r) => r.overLimit)?.rank ?? null;

  const isResult = step < RULE_STEP_OFFSET;
  const ruleIndex = step - RULE_STEP_OFFSET;
  const currentRule = isResult ? null : SUBWAY_RULES[ruleIndex];

  const canPrev = step > 0;
  const canNext = step < TOTAL_STEPS - 1;
  const title = isResult ? "이상교통 8번출구 — 최종 결과" : "규칙 해설";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-6 py-6 text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
        {/* 컨트롤 */}
        <section className="flex items-center justify-between rounded-2xl bg-zinc-900 px-6 py-4 ring-1 ring-zinc-800">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-11 rounded-full bg-zinc-800 px-5 text-lg font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
              disabled={!canPrev}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              이전
            </button>
            <button
              type="button"
              className="h-11 rounded-full bg-amber-400 px-5 text-lg font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
            >
              다음
            </button>
          </div>
        </section>

        {error && <p className="text-lg text-red-400">{error}</p>}

        {isResult ? (
          <div className="flex flex-1 items-center justify-center">
            {loading && rows.length === 0 ? (
              <p className="text-lg text-zinc-400">결과를 불러오는 중입니다...</p>
            ) : (
              <section className="w-full max-w-4xl space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                {ranked.length === 0 ? (
                  <p className="py-16 text-center text-xl text-zinc-400">
                    아직 탈출한 플레이어가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {ranked.map((r) => (
                      <div key={r.playerId}>
                        {firstOverLimitRank != null &&
                          r.rank === firstOverLimitRank && (
                            <div className="flex items-center gap-3 px-1 pb-1.5 pt-3 text-base font-semibold text-red-400">
                              <span className="h-px flex-1 bg-red-500/40" />
                              15회 초과
                              <span className="h-px flex-1 bg-red-500/40" />
                            </div>
                          )}
                        <div
                          className={`flex items-center justify-between rounded-xl px-5 py-4 ${
                            r.rank <= 3 && !r.overLimit
                              ? "bg-zinc-950 ring-1 ring-amber-400/30"
                              : "bg-zinc-950"
                          }`}
                        >
                          <div className="flex items-center gap-5">
                            <span
                              className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${rankBadgeClass(
                                r.rank,
                                r.overLimit
                              )}`}
                            >
                              {r.rank}
                            </span>
                            <span className="text-3xl font-semibold">
                              {r.nickname ?? r.playerId}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-5 text-right">
                            <span
                              className={`text-2xl font-bold ${
                                r.overLimit ? "text-red-400" : "text-zinc-100"
                              }`}
                            >
                              {r.resetCount}회 틀림
                            </span>
                            <span className="w-28 text-xl font-semibold text-amber-300">
                              {formatClearTime(r.clearSeconds) || "-"}
                            </span>
                            <span className="w-28 text-base text-zinc-500">
                              {r.finishedRank}번째 탈출
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {failed.length > 0 && (
                  <div className="space-y-1.5 pt-3">
                    <div className="flex items-center gap-3 px-1 pb-1 text-base font-semibold text-zinc-500">
                      <span className="h-px flex-1 bg-zinc-700" />
                      미탈출
                      <span className="h-px flex-1 bg-zinc-700" />
                    </div>
                    {failed.map((r) => (
                      <div
                        key={r.player_id}
                        className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-5 py-2.5 text-zinc-400"
                      >
                        <span className="text-xl">
                          {r.nickname ?? r.player_id}
                        </span>
                        <span className="text-base">
                          {r.reset_count}회 틀림 · {r.exit_number}번 출구
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-1 gap-5">
            {/* 좌측: 규칙 리스트 */}
            <aside className="hidden w-64 shrink-0 flex-col gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 md:flex">
              {SUBWAY_RULES.map((rule, i) => {
                const active = i === ruleIndex;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setStep(RULE_STEP_OFFSET + i)}
                    className={`rounded-lg px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-amber-400 text-zinc-950"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="text-lg font-bold">{rule.title}</div>
                    <div
                      className={`truncate text-xs ${
                        active ? "text-zinc-800" : "text-zinc-500"
                      }`}
                    >
                      {rule.conditionDescription || "처음부터 공개"}
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* 우측: 현재 규칙 상세 */}
            <section className="flex flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
              {currentRule && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-5xl font-bold text-amber-300">
                      {currentRule.title}
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-lg font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                      공개 조건:{" "}
                      {currentRule.conditionDescription || "처음부터 공개"}
                    </span>
                  </div>
                  <p className="mt-8 whitespace-pre-line text-3xl leading-relaxed text-zinc-100">
                    {currentRule.body}
                  </p>
                  <div className="mt-auto pt-6 text-right text-base text-zinc-500">
                    {ruleIndex + 1} / {SUBWAY_RULES.length}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
