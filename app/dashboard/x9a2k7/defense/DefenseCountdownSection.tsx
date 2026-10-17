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
export function DefenseCountdownSection({
  room,
  action,
  disabled = false,
}: {
  room: string;
  action: GmActionApi;
  disabled?: boolean;
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

  const send = async (body: Record<string, unknown>) => {
    await action.run("/api/gm/timers/defense", { body: { ...body, room } });
    void reload();
  };

  const minutes = Math.floor(state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <section className="flex flex-col gap-3 text-base" data-testid="defense-countdown">
      <h2 className="text-lg font-semibold">카운트다운</h2>
      <p className="text-sm text-zinc-400">디펜스 딜레마 라운드 타이머(행동 시간)</p>
      <div className="flex items-center gap-3 text-base">
        <span className="rounded bg-zinc-900 px-3 py-1 text-lg font-mono" data-testid="countdown-remaining">
          {minutes}:{seconds}
        </span>
        <button
          className="h-8 rounded bg-amber-400 px-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "start" })}
        >
          시작
        </button>
        <button
          className="h-8 rounded bg-zinc-700 px-3 text-sm text-zinc-100 hover:bg-zinc-600 disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "pause" })}
        >
          일시정지
        </button>
        <button
          className="h-8 rounded bg-zinc-800 px-3 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "reset" })}
        >
          리셋
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
