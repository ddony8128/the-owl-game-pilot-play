"use client";

import { useCallback, useEffect, useState } from "react";
import { TimerAdjustPanel } from "@/components/TimerAdjustPanel";
import type { GmActionApi } from "@/lib/hooks/useGmAction";

type ApiTimer = {
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
  pendingTotalSeconds?: number | null;
  configurable?: boolean;
  serverNow?: string;
};

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
};

export function computeRemaining(api: ApiTimer | null, nowMs: number): TimerState {
  if (!api) {
    return { remainingSeconds: 0, isRunning: false };
  }

  const total = api.totalSeconds || 0;
  if (total <= 0) {
    return { remainingSeconds: 0, isRunning: false };
  }

  if (!api.timerStart && !api.pauseAt) {
    return { remainingSeconds: total, isRunning: false };
  }

  if (api.timerStart && api.timerStartAt) {
    const startMs = new Date(api.timerStartAt).getTime();
    if (Number.isNaN(startMs)) {
      return { remainingSeconds: total, isRunning: false };
    }
    const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const remaining = Math.max(0, total - elapsed);
    return { remainingSeconds: remaining, isRunning: remaining > 0 };
  }

  if (!api.timerStart && api.timerStartAt && api.pauseAt) {
    const startMs = new Date(api.timerStartAt).getTime();
    const pauseMs = new Date(api.pauseAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(pauseMs)) {
      return { remainingSeconds: total, isRunning: false };
    }
    const elapsed = Math.max(0, Math.floor((pauseMs - startMs) / 1000));
    const remaining = Math.max(0, total - elapsed);
    return { remainingSeconds: remaining, isRunning: false };
  }

  return { remainingSeconds: total, isRunning: false };
}

// 디펜스 카운트다운 — 시작/일시정지/리셋 + 시간 조정(1~30분·±30초·프리셋·즉시/다음 라운드). 실패는 페이지 배너(action)로.
// 남은 시간은 서버 시각(serverNow) 기준으로 계산하고 5초마다 다시 맞춘다(보드·폰과 같은 숫자).
// 큰 숫자판·3분할 버튼 구성은 bluecode674 포크의 대시보드를 따른다.
export function DefenseCountdownSection({
  room,
  action,
  disabled = false,
  stage = null,
}: {
  room: string;
  action: GmActionApi;
  disabled?: boolean;
  /** 현재 진행 단계. 행동(action) 단계가 아니면 타이머가 쓰이지 않는다는 표시만 한다. */
  stage?: string | null;
}) {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: 0,
    isRunning: false,
  });
  const [api, setApi] = useState<ApiTimer | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/gm/timers/defense?room=${encodeURIComponent(room)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Failed to load defense timer: ${res.status}`);
      const json = (await res.json().catch(() => null)) as ApiTimer | null;
      if (!json) throw new Error("Invalid defense timer payload");
      // 서버 시각 기준으로 남은 시간을 계산해 노트북 시계 오차를 피한다.
      const now = json.serverNow ? new Date(json.serverNow).getTime() : Date.now();
      setApi(json);
      setState(computeRemaining(json, Number.isNaN(now) ? Date.now() : now));
    } catch {
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  }, [room]);

  useEffect(() => {
    const initialId = setTimeout(() => {
      void reload();
    }, 0);

    const tickId = setInterval(() => {
      setState((prev) => ({
        ...prev,
        remainingSeconds: Math.max(
          0,
          prev.isRunning ? prev.remainingSeconds - 1 : prev.remainingSeconds
        ),
      }));
    }, 1000);

    const syncId = setInterval(() => {
      void reload();
    }, 5000);

    return () => {
      clearTimeout(initialId);
      clearInterval(tickId);
      clearInterval(syncId);
    };
  }, [reload]);

  // 단계가 바뀌면(서버가 타이머를 리셋·시작) 즉시 서버 기준으로 다시 맞춘다.
  useEffect(() => {
    void reload();
  }, [stage, reload]);

  const send = async (body: Record<string, unknown>) => {
    await action.run("/api/gm/timers/defense", { body: { ...body, room } });
    void reload();
  };

  const minutes = Math.floor(state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.remainingSeconds % 60).toString().padStart(2, "0");
  const inAction = stage == null || stage === "action";
  const urgent = state.remainingSeconds <= 30 && state.isRunning;

  return (
    <section className="flex h-full flex-col gap-3 text-base" data-testid="defense-countdown">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">카운트다운</h2>
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            state.isRunning ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {state.isRunning ? "진행 중" : inAction ? "정지" : "행동 단계 아님"}
        </span>
      </div>
      <div
        className={`rounded-2xl border px-4 py-5 text-center ${
          urgent ? "border-red-500 bg-red-500/10" : "border-zinc-700 bg-zinc-950"
        }`}
      >
        <span
          className={`font-mono text-6xl font-black tabular-nums ${urgent ? "text-red-300" : "text-white"}`}
          data-testid="countdown-remaining"
        >
          {minutes}:{seconds}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className="min-h-12 rounded-xl bg-emerald-500 px-3 text-sm font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "start" })}
        >
          ▶ 시작
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl bg-zinc-700 px-3 text-sm font-bold text-white hover:bg-zinc-600 disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "pause" })}
        >
          Ⅱ 일시정지
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "reset" })}
        >
          ↺ 리셋
        </button>
      </div>
      <TimerAdjustPanel
        totalSeconds={api?.totalSeconds ?? 0}
        pendingTotalSeconds={api?.pendingTotalSeconds ?? null}
        configurable={api?.configurable ?? true}
        disabled={disabled || action.busy}
        onSet={(body) => send({ action: "set", ...body })}
      />
    </section>
  );
}
