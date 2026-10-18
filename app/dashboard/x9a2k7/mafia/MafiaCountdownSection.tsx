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
// 남은 시간은 서버 시각 기준으로 계산하고 5초마다 다시 맞춘다. 큰 숫자판·3분할 버튼은 bluecode674 포크 구성.
// 타이머가 0이 되어도 단계는 자동으로 넘어가지 않는다(GM이 확인창을 거쳐 넘긴다 — 포크의 자동 전환은 들이지 않음).
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
  const urgent = state.remainingSeconds <= 30 && state.isRunning;

  return (
    <section className="flex h-full flex-col gap-3 text-sm" data-testid="mafia-countdown">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">카운트다운</h2>
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            state.isRunning ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {!currentTimed ? "타이머 없는 단계" : state.isRunning ? "진행 중" : "대기"}
        </span>
      </div>
      <p className="text-sm text-zinc-400">
        {roundLabel} / {phaseLabel}
      </p>
      <div
        className={`rounded-2xl border px-4 py-5 text-center ${
          urgent ? "border-red-500 bg-red-500/10" : "border-zinc-700 bg-zinc-950"
        }`}
      >
        <span
          className={`font-mono text-6xl font-black tabular-nums sm:text-7xl ${urgent ? "text-red-300" : "text-white"}`}
          data-testid="countdown-remaining"
        >
          {currentTimed ? `${minutes}:${seconds}` : "--:--"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <button
          type="button"
          className="min-h-12 rounded-xl bg-emerald-500 px-3 text-sm font-black text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "start" })}
        >
          ▶ 시작
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl bg-zinc-700 px-3 text-sm font-bold text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "pause" })}
        >
          Ⅱ 일시정지
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || action.busy}
          onClick={() => void send({ action: "reset" })}
        >
          ↺ 리셋
        </button>
      </div>
      {!currentTimed && <p className="text-center text-xs text-zinc-500">경매·주식 거래·투표 단계에서만 타이머가 돕니다.</p>}
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
