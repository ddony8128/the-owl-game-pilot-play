"use client";

import { useEffect, useState } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import { clockSkewMs, computeBoardTimer, formatClock, type BoardTimerApi } from "@/lib/boardTimer";

/**
 * 보드 헤더 카운트다운 — 기존 타이머 API(/api/gm/timers/defense|mafia)를 폴링해 남은 시간을 크게 보여 준다.
 * 마운트 뒤에만 그려지는 보드 안에서 쓰므로 하이드레이션과 무관하다.
 */
export function useBoardTimer(url: string | null) {
  const poll = usePolling<BoardTimerApi>(url, 4000);
  // 보드 시계는 0.5초마다 state 로 갱신(렌더는 순수하게 — Date.now() 를 렌더 중에 부르지 않는다)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  // 서버 시차: 응답이 바뀐 렌더에서 "지금(now)"을 받은 시각으로 보고 계산(±0.5초 — 렌더 중 파생 패턴)
  const [skew, setSkew] = useState<{ data: BoardTimerApi | null; ms: number }>({ data: null, ms: 0 });
  if (skew.data !== poll.data) setSkew({ data: poll.data, ms: clockSkewMs(poll.data, now) });
  const state = computeBoardTimer(poll.data, now, skew.ms);
  return { state, failures: poll.failures, api: poll.data };
}

export function BoardCountdown({
  state,
  label,
}: {
  state: ReturnType<typeof computeBoardTimer>;
  /** 타이머 옆 작은 설명(예: "거래 시간") */
  label?: string;
}) {
  if (!state.hasTimer) {
    return (
      <div className="flex flex-col items-end" data-testid="board-countdown" data-running="false" data-has-timer="false">
        <span className="font-mono text-[clamp(1.6rem,4.2vh,3rem)] font-black leading-none text-zinc-500">--:--</span>
      </div>
    );
  }
  const expired = !state.notStarted && state.remainingSeconds <= 0;
  const urgent = state.isRunning && state.remainingSeconds <= 30;
  const color = expired ? "text-red-400" : urgent ? "text-amber-300" : state.isPaused ? "text-zinc-400" : "text-zinc-50";
  return (
    <div
      className="flex flex-col items-end"
      data-testid="board-countdown"
      data-running={state.isRunning ? "true" : "false"}
      data-has-timer="true"
      data-remaining={state.remainingSeconds}
    >
      <span className={`font-mono text-[clamp(1.6rem,4.2vh,3rem)] font-black leading-none tabular-nums ${color} ${urgent ? "animate-pulse" : ""}`}>
        {formatClock(state.remainingSeconds)}
      </span>
      <span className="text-[clamp(0.7rem,1.5vh,1rem)] text-zinc-400">
        {expired ? "시간 종료" : state.isPaused ? "일시정지" : state.notStarted ? (label ?? "대기") : (label ?? "남은 시간")}
      </span>
    </div>
  );
}
