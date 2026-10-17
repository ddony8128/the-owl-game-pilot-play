"use client";

import { useCallback, useEffect, useState } from "react";
import { getDefenseRoundLabel, isDefenseBoardView, type DefenseBoardControl, type DefenseBoardView } from "@/lib/defense/board";
import { broadcastBoardChange } from "@/lib/boardBroadcast";

type Props = { room: string; currentRound: number | null };

export function DefenseBoardControlSection({ room, currentRound }: Props) {
  const [control, setControl] = useState<DefenseBoardControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/defense/board-control?room=${encodeURIComponent(room)}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { view?: unknown; round?: unknown; updatedAt?: unknown; error?: string; migrationRequired?: boolean } | null;
      if (!res.ok || !json || json.error || !isDefenseBoardView(json.view)) throw new Error(json?.error ?? "공용 화면 상태를 불러오지 못했습니다.");
      setControl({ view: json.view, round: typeof json.round === "number" ? json.round : 0, updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : null });
      setError(json.migrationRequired ? "공용 화면 제어용 DB 업데이트가 필요합니다." : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "공용 화면 상태를 불러오지 못했습니다.");
    }
  }, [room]);

  useEffect(() => { void load(); }, [load]);

  const show = async (view: DefenseBoardView, round: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/defense/board-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, view, round }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; updatedAt?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "공용 화면을 변경하지 못했습니다.");
      setControl({ view, round, updatedAt: json.updatedAt ?? null });
      broadcastBoardChange({ room, kind: "defense-control" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "공용 화면을 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const round = typeof currentRound === "number" ? currentRound : 0;
  const canShowMonsters = round === 1 || round === 2 || (round >= 4 && round <= 15);
  const resultRound = round === 2 ? 1 : round === 3 ? 2 : round >= 5 && round <= 16 ? round - 1 : null;
  const viewLabel = control
    ? control.view === "ready" ? "대기 화면" : control.view === "monsters" ? "몬스터 현황" : control.view === "result" ? "전투 결과" : "전체 점수"
    : "확인 중";

  const button = "min-h-12 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">전광판 화면 선택</h2>
          <p className="mt-1 text-sm text-zinc-400">현재 송출: <b className="text-amber-300">{viewLabel}</b>{control && control.view !== "ready" ? ` · ${getDefenseRoundLabel(control.round)}` : ""}</p>
        </div>
        <a href={`/defense-board?room=${encodeURIComponent(room)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-amber-300 hover:bg-zinc-700">공용 화면 열기 ↗</a>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" disabled={busy} onClick={() => void show("ready", 0)} className={`${button} bg-zinc-800 text-white hover:bg-zinc-700`}>대기 화면</button>
        <button type="button" disabled={busy || !canShowMonsters} onClick={() => void show("monsters", round)} className={`${button} bg-emerald-600 text-white hover:bg-emerald-500`}>현재 몬스터 공개</button>
        <button type="button" disabled={busy || resultRound == null} onClick={() => resultRound != null && void show("result", resultRound)} className={`${button} bg-sky-600 text-white hover:bg-sky-500`}>직전 전투 결과 공개</button>
        <button type="button" disabled={busy || round < 16} onClick={() => void show("score", 16)} className={`${button} bg-amber-400 text-zinc-950 hover:bg-amber-300`}>최종 순위 공개</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
        <span className="mr-1 text-sm text-zinc-400">중간 점수:</span>
        <button type="button" disabled={busy || round < 7} onClick={() => void show("score", 7)} className={`${button} bg-violet-700 text-white hover:bg-violet-600`}>본 게임 4라운드 점수</button>
        <button type="button" disabled={busy || round < 11} onClick={() => void show("score", 11)} className={`${button} bg-violet-700 text-white hover:bg-violet-600`}>본 게임 8라운드 점수</button>
      </div>
      {error && <p className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
      <p className="text-xs text-zinc-500">라운드 진행 시 자동으로 바뀝니다. 화면이 맞지 않을 때만 직접 선택하세요.</p>
    </section>
  );
}

