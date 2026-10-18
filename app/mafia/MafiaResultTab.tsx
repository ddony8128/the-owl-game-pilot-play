"use client";

import Image from "next/image";
import type { MafiaAbilityResult } from "@/lib/types";
import { JOB_META } from "./MafiaInfoTab";

type Props = { abilityResults: MafiaAbilityResult[] };

// 결과 탭 — 서버(/api/mafia/state)가 "내게 전달된" 결과만 내려준다(남의 능력·원인은 없음).
// 전원 공지(경제사범 결과, "마피아에게 주식 보상이 지급되었습니다")도 같은 통로로 오므로 숨기지 않는다.
function resultTone(category: string | null) {
  if (category?.includes("fine")) return "border-red-500/25 bg-red-950/15 text-red-300";
  if (category?.includes("reward") || category?.includes("salary") || category?.includes("bonus")) {
    return "border-emerald-500/25 bg-emerald-950/15 text-emerald-300";
  }
  return "border-zinc-800 bg-zinc-900 text-amber-300";
}

function phaseLabel(phase: string | null) {
  if (phase === "apply") return "능력 적용";
  if (phase === "vote") return "투표 결과";
  return "결과";
}

export function MafiaResultTab({ abilityResults }: Props) {
  const results = [...abilityResults].sort((a, b) => {
    const roundDiff = (b.round_number ?? -1) - (a.round_number ?? -1);
    return roundDiff || b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="space-y-3 text-sm text-zinc-200">
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="text-[11px] font-black tracking-[0.18em] text-amber-400">MY RESULTS</p>
          <h2 className="mt-1 text-xl font-black text-white">능력 · 투표 결과</h2>
        </div>
        <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-500">
          {results.length}개
        </span>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-500">
            ✓
          </div>
          <p className="mt-3 font-bold text-zinc-300">아직 기록된 능력 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const job = result.job ? JOB_META[result.job] : null;
            const roundLabel =
              result.round_number === 0
                ? "튜토리얼"
                : typeof result.round_number === "number"
                  ? `${result.round_number}라운드`
                  : "";
            return (
              <article
                key={result.id}
                className={`overflow-hidden rounded-2xl border p-4 ${resultTone(result.category)}`}
              >
                <div className="flex items-center gap-3">
                  {job?.icon ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-800">
                      <Image src={job.icon} alt="" fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-lg">
                      ✦
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-black text-zinc-100">{phaseLabel(result.phase)}</p>
                      {roundLabel && (
                        <span className="shrink-0 rounded-full bg-black/20 px-2 py-1 text-[11px] font-bold text-zinc-400">
                          {roundLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words border-t border-white/5 pt-3 text-base leading-relaxed text-zinc-200">
                  {result.message}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
