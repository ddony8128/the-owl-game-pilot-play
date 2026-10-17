"use client";

import { useState } from "react";
import {
  TIMER_MAX_MINUTES,
  TIMER_MIN_MINUTES,
  TIMER_PRESET_MINUTES,
  TIMER_STEP_SECONDS,
  formatSeconds,
  type TimerApplyWhen,
} from "@/lib/admin/timerConfig";

export type TimerSetBody = {
  action: "set";
  applyTo: TimerApplyWhen;
  minutes?: number;
  delta?: number;
  phase?: string;
};

// 타이머 시간 조정 UI(수산시장 DealerTimer 참고) — Iteration 5 WS-A 6.
//  분(1~30 정수) 직접 입력 · 프리셋 3/5/8/10분 · ±30초 · "현재 라운드 즉시 / 다음 라운드부터".
export function TimerAdjustPanel({
  totalSeconds,
  pendingTotalSeconds,
  configurable,
  disabled,
  targetLabel,
  onSet,
}: {
  totalSeconds: number;
  pendingTotalSeconds: number | null;
  configurable: boolean;
  disabled?: boolean;
  /** 조정 대상 설명(예: "주식 거래 단계") */
  targetLabel?: string;
  onSet: (body: Omit<TimerSetBody, "action" | "phase">) => void | Promise<void>;
}) {
  const [when, setWhen] = useState<TimerApplyWhen>("now");
  const [minutesText, setMinutesText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const off = disabled || !configurable;

  const applyMinutes = () => {
    const m = Number(minutesText);
    if (!Number.isInteger(m) || m < TIMER_MIN_MINUTES || m > TIMER_MAX_MINUTES) {
      setLocalError(`분은 ${TIMER_MIN_MINUTES}~${TIMER_MAX_MINUTES} 사이의 정수로 입력하세요.`);
      return;
    }
    setLocalError(null);
    void onSet({ minutes: m, applyTo: when });
  };

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm" data-testid="timer-adjust">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-zinc-200">시간 조정{targetLabel ? ` · ${targetLabel}` : ""}</span>
        <span className="text-xs text-zinc-400">
          현재 전체 <b className="font-mono text-amber-300" data-testid="timer-total">{formatSeconds(totalSeconds)}</b>
        </span>
        {pendingTotalSeconds != null && (
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-amber-200" data-testid="timer-pending">
            다음 라운드부터 {formatSeconds(pendingTotalSeconds)} 예약
          </span>
        )}
      </div>
      {!configurable && (
        <p className="text-xs text-amber-300" data-testid="timer-config-missing">
          DB에 timer_config 컬럼이 없어 시간 조정을 쓸 수 없습니다(supabase/migrations/2026-10-17-iter5-gm.sql).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="적용 시점">
        <label className="flex items-center gap-1 text-xs text-zinc-300">
          <input type="radio" name="timer-when" checked={when === "now"} onChange={() => setWhen("now")} disabled={off} />
          현재 라운드 즉시 적용
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-300">
          <input type="radio" name="timer-when" checked={when === "next"} onChange={() => setWhen("next")} disabled={off} />
          다음 라운드부터
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {TIMER_PRESET_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={off}
            data-testid={`timer-preset-${m}`}
            className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
            onClick={() => void onSet({ minutes: m, applyTo: when })}
          >
            {m}분
          </button>
        ))}
        <span className="mx-1 text-zinc-600">|</span>
        <button
          type="button"
          disabled={off}
          data-testid="timer-minus-30"
          className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
          onClick={() => void onSet({ delta: -TIMER_STEP_SECONDS, applyTo: when })}
        >
          −30초
        </button>
        <button
          type="button"
          disabled={off}
          data-testid="timer-plus-30"
          className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
          onClick={() => void onSet({ delta: TIMER_STEP_SECONDS, applyTo: when })}
        >
          +30초
        </button>
        <span className="mx-1 text-zinc-600">|</span>
        <input
          type="number"
          min={TIMER_MIN_MINUTES}
          max={TIMER_MAX_MINUTES}
          step={1}
          value={minutesText}
          onChange={(e) => setMinutesText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyMinutes()}
          placeholder="분"
          aria-label="분 입력(1~30)"
          data-testid="timer-minutes-input"
          disabled={off}
          className="h-7 w-16 rounded border border-zinc-700 bg-zinc-950 px-2 text-center text-xs text-zinc-100"
        />
        <button
          type="button"
          disabled={off || minutesText.trim() === ""}
          data-testid="timer-minutes-apply"
          className="rounded bg-amber-500 px-2.5 py-1 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          onClick={applyMinutes}
        >
          분 적용
        </button>
      </div>
      {localError && <p className="text-xs text-red-300">{localError}</p>}
    </div>
  );
}
