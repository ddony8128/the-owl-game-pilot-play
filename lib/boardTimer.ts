/**
 * 보드(빔) 카운트다운 계산 — 기존 타이머 API(/api/gm/timers/defense|mafia GET)의 응답으로 남은 시간을 구한다.
 * 서버 시각(serverNow)과 보드 PC 시각의 차이를 보정해, PC 시계가 틀려도 GM 대시보드와 같은 숫자를 보인다.
 * 순수 함수 — 단위 테스트 대상.
 */
export type BoardTimerApi = {
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
  serverNow?: string;
  /** 마피아 타이머만: 페이즈 키 */
  phase?: string;
};

export type BoardTimerState = {
  /** 이 단계에 타이머가 있는가(totalSeconds > 0) */
  hasTimer: boolean;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  /** 시작된 적이 없음(= 총 시간 그대로) */
  notStarted: boolean;
};

/** 응답을 받은 시점의 보드 시계 기준으로 서버와의 시차(ms)를 구한다. 응답에 serverNow 가 없으면 0. */
export function clockSkewMs(api: BoardTimerApi | null, receivedAtMs: number): number {
  if (!api?.serverNow) return 0;
  const server = new Date(api.serverNow).getTime();
  if (Number.isNaN(server)) return 0;
  return server - receivedAtMs;
}

export function computeBoardTimer(
  api: BoardTimerApi | null,
  nowMs: number,
  skewMs = 0,
): BoardTimerState {
  const total = api && Number.isFinite(api.totalSeconds) ? Math.max(0, api.totalSeconds) : 0;
  const idle: BoardTimerState = {
    hasTimer: total > 0,
    remainingSeconds: total,
    isRunning: false,
    isPaused: false,
    notStarted: true,
  };
  if (!api || total <= 0) return { ...idle, hasTimer: false, remainingSeconds: 0 };

  const serverNow = nowMs + skewMs;

  if (api.timerStart && api.timerStartAt) {
    const startedAt = new Date(api.timerStartAt).getTime();
    if (Number.isNaN(startedAt)) return idle;
    const elapsed = Math.max(0, Math.floor((serverNow - startedAt) / 1000));
    const remaining = Math.max(0, total - elapsed);
    return {
      hasTimer: true,
      remainingSeconds: remaining,
      isRunning: remaining > 0,
      isPaused: false,
      notStarted: false,
    };
  }

  if (!api.timerStart && api.timerStartAt && api.pauseAt) {
    const startedAt = new Date(api.timerStartAt).getTime();
    const pausedAt = new Date(api.pauseAt).getTime();
    if (Number.isNaN(startedAt) || Number.isNaN(pausedAt)) return idle;
    const elapsed = Math.max(0, Math.floor((pausedAt - startedAt) / 1000));
    return {
      hasTimer: true,
      remainingSeconds: Math.max(0, total - elapsed),
      isRunning: false,
      isPaused: true,
      notStarted: false,
    };
  }

  return idle;
}

/** 남은 초 → "MM:SS" (한 시간 넘으면 "H:MM:SS") */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
