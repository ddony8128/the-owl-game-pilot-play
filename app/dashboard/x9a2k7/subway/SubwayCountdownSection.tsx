import { useEffect, useState } from "react";

type ApiTimer = {
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
};

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
};

function computeRemaining(api: ApiTimer | null, nowMs: number): TimerState {
  if (!api) {
    return { remainingSeconds: 50 * 60, isRunning: false };
  }

  const total = api.totalSeconds || 50 * 60;

  if (!api.timerStart && !api.pauseAt) {
    // 아직 시작 전/리셋 상태
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

export function SubwayCountdownSection() {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: 50 * 60,
    isRunning: false,
  });

  const reload = async () => {
    const res = await fetch("/api/gm/timers/subway");
    const json = (await res.json().catch(() => null)) as ApiTimer | null;
    if (!json) return;
    const now = Date.now();
    setState(computeRemaining(json, now));
  };

  useEffect(() => {
    // 초기 로딩은 마이크로태스크/타이머 큐로 미루어
    // effect 본문에서의 동기 setState 호출을 피한다.
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
    // 주기적으로 서버 상태를 다시 불러와 드리프트를 보정한다.
    const syncId = setInterval(() => {
      void reload();
    }, 5000);

    return () => {
      clearTimeout(initialId);
      clearInterval(tickId);
      clearInterval(syncId);
    };
  }, []);

  const sendAction = async (action: "start" | "pause" | "reset") => {
    await fetch("/api/gm/timers/subway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => undefined);
    void reload();
  };

  const minutes = Math.floor(state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-base font-semibold">카운트다운</h2>
      <div className="flex items-center gap-3 text-xs">
        <span className="rounded bg-zinc-900 px-3 py-1 text-lg font-mono">
          {minutes}:{seconds}
        </span>
        <button
          className="h-8 rounded bg-amber-400 px-3 text-[11px] font-semibold text-zinc-950 hover:bg-amber-300"
          onClick={() => sendAction("start")}
        >
          시작
        </button>
        <button
          className="h-8 rounded bg-zinc-700 px-3 text-[11px] text-zinc-100 hover:bg-zinc-600"
          onClick={() => sendAction("pause")}
        >
          일시정지
        </button>
        <button
          className="h-8 rounded bg-zinc-800 px-3 text-[11px] text-zinc-100 hover:bg-zinc-700"
          onClick={() => sendAction("reset")}
        >
          리셋
        </button>
      </div>
    </section>
  );
}
