"use client";

import { useCallback, useEffect, useState } from "react";
import type { MafiaPhaseState } from "@/lib/types";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { TimerAdjustPanel } from "@/components/TimerAdjustPanel";
import { MAFIA_TIMED_PHASES } from "@/lib/admin/timerDefaults";
import type { GmActionApi } from "@/lib/hooks/useGmAction";

type Props = {
  phase: MafiaPhaseState | null;
  room: string;
  action: GmActionApi;
  disabled?: boolean;
};

type ApiTimer = {
  phase: string | null;
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
  pendingTotalSeconds?: number | null;
  durations?: Record<string, { totalSeconds: number; defaultSeconds: number; pendingTotalSeconds: number | null }>;
  configurable?: boolean;
  serverNow?: string;
};

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
};

function computeRemaining(api: ApiTimer | null, nowMs: number): TimerState {
  if (!api || !api.phase) {
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

// 마피아 카운트다운 — 시작/일시정지/리셋 + 단계별 시간 조정(경매·거래·투표, 즉시/다음 라운드).
export function MafiaCountdownSection({ phase, room, action, disabled = false }: Props) {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: 0,
    isRunning: false,
  });
  const [api, setApi] = useState<ApiTimer | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/gm/timers/mafia?room=${encodeURIComponent(room)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json().catch(() => null)) as ApiTimer | null;
      if (!res.ok || !json) return;
      const now = json.serverNow ? new Date(json.serverNow).getTime() : Date.now();
      setApi(json);
      setState(computeRemaining(json, Number.isNaN(now) ? Date.now() : now));
    } catch {
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  }, [room]);

  useEffect(() => {
    const initialId = setTimeout(() => void reload(), 0);
    const tickId = setInterval(() => {
      setState((prev) => ({
        ...prev,
        remainingSeconds: Math.max(
          0,
          prev.isRunning ? prev.remainingSeconds - 1 : prev.remainingSeconds
        ),
      }));
    }, 1000);
    // 주기적으로 서버 상태를 다시 불러와 드리프트를 보정한다.
    const syncId = setInterval(() => {
      void reload();
    }, 5000);

    return () => {
      clearTimeout(initialId);
      clearInterval(tickId);
      clearInterval(syncId);
    };
    // 페이즈가 바뀔 때마다 서버 기준으로 다시 초기화
  }, [phase?.phase, room, reload]);

  const send = async (body: Record<string, unknown>) => {
    await action.run("/api/gm/timers/mafia", { body: { ...body, room } });
    void reload();
  };

  const minutes = Math.floor(state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.remainingSeconds % 60).toString().padStart(2, "0");

  const phaseLabel = getMafiaPhaseLabel(phase?.phase ?? null);
  const roundLabel =
    typeof phase?.round_number === "number"
      ? phase.round_number === 0
        ? "튜토리얼"
        : `${phase.round_number}라운드`
      : "-";

  // 조정 대상 단계: 현재 단계에 타이머가 있으면 그것, 아니면 GM이 고른 단계(기본 거래)
  const currentTimed = (MAFIA_TIMED_PHASES as readonly string[]).includes(phase?.phase ?? "");
  const adjustTarget = target ?? (currentTimed ? (phase?.phase as string) : "trade");
  const targetInfo = api?.durations?.[adjustTarget];

  return (
    <section className="flex flex-col gap-2 text-sm" data-testid="mafia-countdown">
      <h2 className="text-base font-semibold">카운트다운</h2>
      <p className="text-sm text-zinc-400">
        {roundLabel} / {phaseLabel}
      </p>
      <div className="flex items-center gap-3 text-sm">
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
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-500">조정할 단계:</span>
        {MAFIA_TIMED_PHASES.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`timer-target-${p}`}
            disabled={disabled}
            className={`rounded px-2 py-0.5 ${
              adjustTarget === p ? "bg-amber-500 font-semibold text-zinc-950" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            } disabled:opacity-40`}
            onClick={() => setTarget(p)}
          >
            {getMafiaPhaseLabel(p)} {api?.durations?.[p] ? `${Math.round(api.durations[p].totalSeconds / 60)}분` : ""}
          </button>
        ))}
      </div>
      <TimerAdjustPanel
        totalSeconds={targetInfo?.totalSeconds ?? api?.totalSeconds ?? 0}
        pendingTotalSeconds={targetInfo?.pendingTotalSeconds ?? null}
        configurable={api?.configurable ?? true}
        disabled={disabled || action.busy}
        targetLabel={`${getMafiaPhaseLabel(adjustTarget as MafiaPhaseState["phase"])} 단계`}
        onSet={(body) => send({ action: "set", phase: adjustTarget, ...body })}
      />
    </section>
  );
}
