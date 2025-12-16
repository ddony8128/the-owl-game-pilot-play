import { useEffect, useState } from "react";

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
};

export function SubwayCountdownSection() {
  const [state, setState] = useState<TimerState>({
    remainingSeconds: 50 * 60,
    isRunning: false,
  });

  const reload = async () => {
    const res = await fetch("/api/gm/timers/subway");
    const json = (await res.json().catch(() => null)) as {
      remainingSeconds: number;
      isRunning: boolean;
    } | null;
    if (!json) return;
    setState({
      remainingSeconds: json.remainingSeconds,
      isRunning: json.isRunning,
    });
  };

  useEffect(() => {
    void reload();
    const id = setInterval(() => {
      setState((prev) => ({
        ...prev,
        remainingSeconds: Math.max(
          0,
          prev.isRunning ? prev.remainingSeconds - 1 : prev.remainingSeconds
        ),
      }));
    }, 1000);
    return () => clearInterval(id);
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
