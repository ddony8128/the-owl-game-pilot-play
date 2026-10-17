import { useEffect, useRef, useState } from "react";
import type { MafiaPhaseState } from "@/lib/types";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { broadcastBoardChange } from "@/lib/boardBroadcast";

type Props = {
  phase: MafiaPhaseState | null;
  room: string;
  onTimerExpired: () => Promise<void>;
};

type ApiTimer = {
  phase: string | null;
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
  remainingSeconds?: number;
  isRunning?: boolean;
};

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
};

type TimerCacheEntry = {
  data?: ApiTimer;
  fetchedAt?: number;
  request?: Promise<ApiTimer>;
};

const timerCache = new Map<string, TimerCacheEntry>();

async function fetchTimer(room: string): Promise<ApiTimer> {
  const cached = timerCache.get(room);
  if (cached?.request) return cached.request;
  if (cached?.data && cached.fetchedAt && Date.now() - cached.fetchedAt < 1500) {
    return cached.data;
  }

  const request = (async () => {
    const res = await fetch(`/api/gm/timers/mafia?room=${encodeURIComponent(room)}`);
    const json = (await res.json().catch(() => null)) as (ApiTimer & { error?: string }) | null;
    if (!res.ok || !json) throw new Error(json?.error ?? "타이머를 불러오지 못했습니다.");
    timerCache.set(room, { data: json, fetchedAt: Date.now() });
    return json;
  })();

  timerCache.set(room, { ...cached, request });
  try {
    return await request;
  } finally {
    const latest = timerCache.get(room);
    if (latest?.request === request) {
      timerCache.set(room, { data: latest.data, fetchedAt: latest.fetchedAt });
    }
  }
}

function computeRemaining(api: ApiTimer | null, nowMs: number): TimerState {
  if (!api || !api.phase) {
    return { remainingSeconds: 0, isRunning: false };
  }

  const total = api.totalSeconds || 0;
  if (total <= 0) {
    return { remainingSeconds: 0, isRunning: false };
  }

  if (typeof api.remainingSeconds === "number") {
    return {
      remainingSeconds: Math.max(0, api.remainingSeconds),
      isRunning: api.isRunning === true && api.remainingSeconds > 0,
    };
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

export function MafiaCountdownSection({ phase, room, onTimerExpired }: Props) {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: 0,
    isRunning: false,
  });
  const [busy, setBusy] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAdvanceArmedRef = useRef(false);
  const autoAdvanceKeyRef = useRef<string | null>(null);
  const oneMinuteSyncDoneRef = useRef(false);

  const reload = async () => {
    try {
      const json = await fetchTimer(room);
      autoAdvanceArmedRef.current = json.timerStart;
      setState(computeRemaining(json, Date.now()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "타이머를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    autoAdvanceArmedRef.current = false;
    autoAdvanceKeyRef.current = null;
    oneMinuteSyncDoneRef.current = false;
    setAutoAdvancing(false);
    void reload();
    const tickId = setInterval(() => {
      setState((prev) => {
        const remainingSeconds = Math.max(
          0,
          prev.isRunning ? prev.remainingSeconds - 1 : prev.remainingSeconds
        );
        return {
          remainingSeconds,
          isRunning: prev.isRunning && remainingSeconds > 0,
        };
      });
    }, 1000);
    return () => {
      clearInterval(tickId);
    };
    // 페이즈가 바뀔 때마다 서버 기준으로 다시 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase?.phase, room]);

  useEffect(() => {
    if (state.remainingSeconds > 60) {
      oneMinuteSyncDoneRef.current = false;
      return;
    }
    if (
      !state.isRunning ||
      state.remainingSeconds <= 0 ||
      oneMinuteSyncDoneRef.current
    ) {
      return;
    }
    oneMinuteSyncDoneRef.current = true;
    void reload();
    // 01:00 이하에 처음 진입했을 때 서버 기준으로 한 번만 동기화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRunning, state.remainingSeconds]);

  useEffect(() => {
    const phaseKey = phase?.phase;
    if (
      !phaseKey ||
      !["auction", "trade", "vote"].includes(phaseKey) ||
      state.remainingSeconds > 0 ||
      !autoAdvanceArmedRef.current
    ) {
      return;
    }

    const transitionKey = `${phase?.round_number ?? 0}:${phaseKey}`;
    if (autoAdvanceKeyRef.current === transitionKey) return;
    autoAdvanceKeyRef.current = transitionKey;
    autoAdvanceArmedRef.current = false;
    setAutoAdvancing(true);
    void onTimerExpired().finally(() => setAutoAdvancing(false));
  }, [onTimerExpired, phase?.phase, phase?.round_number, state.remainingSeconds]);

  const sendAction = async (action: "start" | "pause" | "reset") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gm/timers/mafia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, room }),
      });
      const json = (await res.json().catch(() => null)) as (ApiTimer & { error?: string }) | null;
      if (!res.ok || !json) throw new Error(json?.error ?? "타이머 조작에 실패했습니다.");
      timerCache.set(room, { data: json, fetchedAt: Date.now() });
      if (action === "reset") oneMinuteSyncDoneRef.current = false;
      autoAdvanceArmedRef.current = json.timerStart;
      setState(computeRemaining(json, Date.now()));
      broadcastBoardChange({ room, kind: "mafia-timer" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "타이머 조작에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const minutes = Math.floor(state.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.remainingSeconds % 60).toString().padStart(2, "0");

  const phaseLabel = getMafiaPhaseLabel(phase?.phase ?? null);
  const timerAvailable =
    phase?.phase === "auction" ||
    phase?.phase === "trade" ||
    phase?.phase === "vote";
  const roundLabel =
    typeof phase?.round_number === "number"
      ? phase.round_number === 0
        ? "튜토리얼"
        : `${phase.round_number}라운드`
      : "-";

  return (
    <section className="flex h-full flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">진행 타이머</h2>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${state.isRunning ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
          {!timerAvailable
            ? "타이머 없음"
            : autoAdvancing
              ? "단계 전환 중"
              : state.isRunning
                ? "진행 중"
                : "대기"}
        </span>
      </div>
      <p className="text-sm text-zinc-400">
        {roundLabel} / {phaseLabel}
      </p>
      <div className={`rounded-2xl border px-4 py-5 text-center ${state.remainingSeconds <= 30 && state.isRunning ? "border-red-500 bg-red-500/10" : "border-zinc-700 bg-zinc-950"}`}>
        <span className={`font-mono text-6xl font-black tabular-nums sm:text-7xl ${state.remainingSeconds <= 30 && state.isRunning ? "text-red-300" : "text-white"}`}>
          {timerAvailable ? `${minutes}:${seconds}` : "--:--"}
        </span>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 text-sm">
        <button
          className="min-h-12 rounded-xl bg-emerald-500 px-3 text-sm font-black text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => sendAction("start")}
          disabled={busy || autoAdvancing || !timerAvailable || state.isRunning}
        >
          ▶ 시작
        </button>
        <button
          className="min-h-12 rounded-xl bg-zinc-700 px-3 text-sm font-bold text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => sendAction("pause")}
          disabled={busy || autoAdvancing || !timerAvailable || !state.isRunning}
        >
          Ⅱ 정지
        </button>
        <button
          className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => sendAction("reset")}
          disabled={busy || autoAdvancing || !timerAvailable}
        >
          ↺ 초기화
        </button>
      </div>
      {!timerAvailable && <p className="text-center text-xs text-zinc-500">경매·주식 거래·투표 단계에서만 타이머를 사용합니다.</p>}
      {error && <p className="rounded-lg bg-red-950/60 p-2 text-xs text-red-200">{error}</p>}
    </section>
  );
}
