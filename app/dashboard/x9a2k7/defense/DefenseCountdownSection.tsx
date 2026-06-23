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

export function DefenseCountdownSection({ room }: { room: string }) {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: 0,
    isRunning: false,
  });

  const reload = async () => {
    try {
      const res = await fetch(
        `/api/gm/timers/defense?room=${encodeURIComponent(room)}`
      );
      if (!res.ok) {
        throw new Error(
          `Failed to load defense timer: ${res.status} ${res.statusText}`
        );
      }

      const json = (await res.json().catch(() => null)) as ApiTimer | null;
      if (!json) {
        throw new Error("Invalid defense timer payload");
      }

      const now = Date.now();
      setState(computeRemaining(json, now));
    } catch {
      setState((prev) => ({
        ...prev,
        isRunning: false,
      }));
    }
  };

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
  }, []);

  const sendAction = async (action: "start" | "pause" | "reset") => {
    try {
      const res = await fetch("/api/gm/timers/defense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, room }),
      });
      if (!res.ok) {
        throw new Error(
          `Failed to update defense timer: ${res.status} ${res.statusText}`
        );
      }
    } catch {
      // 무시 – GM이 다시 조작하면 됨
    } finally {
      void reload();
    }
  };

  const minutes = Math.floor(state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <section className="flex flex-col gap-3 text-base">
      <h2 className="text-lg font-semibold">카운트다운</h2>
      <p className="text-sm text-zinc-400">디펜스 딜레마 전역 타이머</p>
      <div className="flex items-center gap-3 text-base">
        <span className="rounded bg-zinc-900 px-3 py-1 text-lg font-mono">
          {minutes}:{seconds}
        </span>
        <button
          className="h-8 rounded bg-amber-400 px-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
          onClick={() => sendAction("start")}
        >
          시작
        </button>
        <button
          className="h-8 rounded bg-zinc-700 px-3 text-sm text-zinc-100 hover:bg-zinc-600"
          onClick={() => sendAction("pause")}
        >
          일시정지
        </button>
        <button
          className="h-8 rounded bg-zinc-800 px-3 text-sm text-zinc-100 hover:bg-zinc-700"
          onClick={() => sendAction("reset")}
        >
          리셋
        </button>
      </div>
    </section>
  );
}


