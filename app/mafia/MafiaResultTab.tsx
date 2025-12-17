"use client";

import type { MafiaAbilityResult, MafiaLog } from "@/lib/types";

type Props = {
  logs: MafiaLog[];
  abilityResults: MafiaAbilityResult[];
};

export function MafiaResultTab({ logs, abilityResults }: Props) {
  const latestRound =
    abilityResults.length > 0
      ? Math.max(
          ...abilityResults.map((r) =>
            typeof r.round_number === "number" ? r.round_number : 0
          )
        )
      : null;

  const latestResults =
    latestRound != null
      ? abilityResults.filter((r) => r.round_number === latestRound)
      : abilityResults;

  return (
    <div className="space-y-4 text-xs text-zinc-200">
      <section className="space-y-1">
        <p className="text-xs text-zinc-400">이번 라운드 나에게 일어난 일</p>
        {latestResults.length === 0 && (
          <p className="text-xs text-zinc-500">
            아직 기록된 능력 결과가 없습니다.
          </p>
        )}
        <div className="space-y-2">
          {latestResults.map((r) => (
            <div
              key={r.id}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {r.phase === "apply"
                    ? "능력 적용"
                    : r.phase === "vote"
                    ? "투표 결과"
                    : "결과"}
                </span>
                {typeof r.round_number === "number" && (
                  <span className="text-[10px] text-zinc-400">
                    {r.round_number === 0
                      ? "튜토리얼"
                      : `${r.round_number}라운드`}
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs">{r.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-1">
        <p className="text-xs text-zinc-400">GM 공개 로그</p>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
            >
              {log.content}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-xs text-zinc-400">
              아직 공개된 로그가 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
