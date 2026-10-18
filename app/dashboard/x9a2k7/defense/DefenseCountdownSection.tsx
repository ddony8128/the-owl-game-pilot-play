"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { broadcastBoardChange } from "@/lib/boardBroadcast";

const ROUND_SECONDS = 5 * 60;
type TimerResponse = { remainingSeconds?: number; isRunning?: boolean; error?: string };

export function DefenseCountdownSection({
  room,
  resultPending,
}: {
  room: string;
  resultPending: boolean;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(ROUND_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oneMinuteSyncDoneRef = useRef(false);

  const apply = useCallback((json: TimerResponse) => {
    if (typeof json.remainingSeconds === "number") setRemainingSeconds(json.remainingSeconds);
    setIsRunning(!!json.isRunning);
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch(
      `/api/gm/timers/defense?room=${encodeURIComponent(room)}`,
      { cache: "no-store" }
    );
    const json = (await res.json().catch(() => null)) as TimerResponse | null;
    if (res.ok && json) apply(json);
  }, [apply, room]);

  useEffect(() => {
    void reload()
      .catch(() => undefined);
  }, [reload, resultPending]);

  useEffect(() => {
    if (!isRunning) return;
    const tickId = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous <= 1) {
          window.setTimeout(() => setIsRunning(false), 0);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(tickId);
  }, [isRunning]);

  useEffect(() => {
    if (remainingSeconds > 60) {
      oneMinuteSyncDoneRef.current = false;
      return;
    }
    if (!isRunning || remainingSeconds <= 0 || oneMinuteSyncDoneRef.current) {
      return;
    }
    oneMinuteSyncDoneRef.current = true;
    void reload().catch(() => {
      // 조작 버튼 또는 다음 라운드 갱신 때 다시 서버 상태를 받는다.
    });
  }, [isRunning, reload, remainingSeconds]);

  const command = async (action: "start" | "pause" | "reset") => {
    setBusy(true);
    setError(null);
    // 버튼 반응과 카운트다운은 네트워크 응답을 기다리지 않고 즉시 시작한다.
    if (action === "start") {
      if (remainingSeconds <= 0) setRemainingSeconds(ROUND_SECONDS);
      setIsRunning(true);
    } else if (action === "pause") {
      setIsRunning(false);
    } else {
      setIsRunning(false);
      setRemainingSeconds(ROUND_SECONDS);
    }
    try {
      const res = await fetch("/api/gm/timers/defense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, action }),
      });
      const json = (await res.json().catch(() => null)) as TimerResponse | null;
      if (res.ok && json) {
        apply(json);
        broadcastBoardChange({ room, kind: "defense-timer" });
      } else {
        throw new Error(json?.error ?? "타이머 상태를 변경하지 못했습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "타이머 상태를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  if (resultPending) {
    return (
      <section className="flex h-full flex-col justify-center gap-3 text-base">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">진행 타이머</h2>
          <span className="rounded-full bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-300">결과 확인</span>
        </div>
        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/30 px-4 py-6 text-center">
          <p className="text-xl font-black text-white">전투 결과 확인 중</p>
          <p className="mt-2 text-sm text-zinc-400">결과 설명 후 다음 라운드로 진행하세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 text-base">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">진행 타이머</h2>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isRunning ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{isRunning ? "진행 중" : "정지"}</span>
      </div>
      <p className="text-sm text-zinc-400">전광판과 같은 시간을 표시합니다.</p>
      <div className={`rounded-2xl border px-4 py-5 text-center ${remainingSeconds <= 30 && isRunning ? "border-red-500 bg-red-500/10" : "border-zinc-700 bg-zinc-950"}`}>
        <span className={`font-mono text-6xl font-black tabular-nums ${remainingSeconds <= 30 && isRunning ? "text-red-300" : "text-white"}`}>{minutes}:{seconds}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={busy || isRunning} onClick={() => void command("start")} className="min-h-12 rounded-xl bg-emerald-500 px-3 text-sm font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-40">▶ 시작</button>
        <button type="button" disabled={busy || !isRunning} onClick={() => void command("pause")} className="min-h-12 rounded-xl bg-zinc-700 px-3 text-sm font-bold text-white hover:bg-zinc-600 disabled:opacity-40">Ⅱ 정지</button>
        <button type="button" disabled={busy} onClick={() => void command("reset")} className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">↺ 초기화</button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
