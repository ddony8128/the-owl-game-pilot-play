"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardApiResponse, BoardMonster } from "./types";
import { DefenseBoardGrid } from "./DefenseBoardGrid";
import { DefenseBoardScores } from "./DefenseBoardScores";
import { getDefenseRoundLabel, isDefenseBoardView, type DefenseBoardControl } from "@/lib/defense/board";
import { BOARD_BROADCAST_CHANNEL, type BoardBroadcastMessage } from "@/lib/boardBroadcast";

type Score = { playerId: string; nickname: string | null; points: number; damage: number };
export function DefenseBoardClient() {
  const [room, setRoom] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [control, setControl] = useState<DefenseBoardControl>({ view: "ready", round: 0, updatedAt: null });
  const [monsters, setMonsters] = useState<BoardMonster[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const signatureRef = useRef("");
  const oneMinuteSyncDoneRef = useRef(false);

  useEffect(() => {
    setRoom(new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || null);
    setMounted(true);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // 브라우저가 전체 화면을 허용하지 않으면 기존 화면을 유지한다.
    }
  };

  const loadTimer = useCallback(async () => {
    if (!room) return;
    const res = await fetch(`/api/gm/timers/defense?room=${encodeURIComponent(room)}`, { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { remainingSeconds?: number; isRunning?: boolean } | null;
    if (res.ok && json && typeof json.remainingSeconds === "number") {
      setRemainingSeconds(json.remainingSeconds);
      setTimerRunning(!!json.isRunning);
    }
  }, [room]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((value) => {
        if (value <= 1) {
          window.setTimeout(() => setTimerRunning(false), 0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (remainingSeconds > 60) {
      oneMinuteSyncDoneRef.current = false;
      return;
    }
    if (
      !timerRunning ||
      remainingSeconds <= 0 ||
      oneMinuteSyncDoneRef.current
    ) {
      return;
    }
    oneMinuteSyncDoneRef.current = true;
    void loadTimer().catch(() => {
      // 다음 타이머 또는 라운드 이벤트에서 다시 서버 상태를 받는다.
    });
  }, [loadTimer, remainingSeconds, timerRunning]);

  const loadPayload = useCallback(async (next: DefenseBoardControl) => {
    if (!room || next.view === "ready") return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ room, round: String(next.round) });
      if (next.view === "score") {
        const res = await fetch(`/api/defense/board-scores?${params}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { scores: Score[]; error?: undefined } | { error: string } | null;
        if (!res.ok || !json || "error" in json) throw new Error(json?.error ?? "점수 정보를 불러오지 못했습니다.");
        setScores(json.scores);
      } else {
        const res = await fetch(`/api/defense/board-state?${params}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as BoardApiResponse | { error: string } | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error((json as { error?: string } | null)?.error ?? "몬스터 정보를 불러오지 못했습니다.");
        }
        setMonsters(json.monsters);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "공용 화면 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const loadControl = async () => {
      try {
        const res = await fetch(`/api/defense/board-control?room=${encodeURIComponent(room)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { view?: unknown; round?: unknown; updatedAt?: unknown; error?: string } | null;
        if (!res.ok || !json || json.error || !isDefenseBoardView(json.view)) throw new Error(json?.error ?? "공용 화면 상태를 불러오지 못했습니다.");
        if (cancelled) return;
        const next: DefenseBoardControl = {
          view: json.view,
          round: typeof json.round === "number" ? json.round : 0,
          updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : null,
        };
        const signature = `${next.view}:${next.round}:${next.updatedAt ?? "legacy"}`;
        setControl(next);
        setError(null);
        if (signature !== signatureRef.current) {
          signatureRef.current = signature;
          await loadPayload(next);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "공용 화면 상태를 불러오지 못했습니다.");
      }
    };
    void loadControl();
    void loadTimer();
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(BOARD_BROADCAST_CHANNEL) : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<BoardBroadcastMessage>) => {
        if (event.data?.room !== room) return;
        if (event.data.kind === "defense-control") void loadControl();
        if (event.data.kind === "defense-timer") void loadTimer();
      };
    }
    const events = new EventSource(
      `/api/defense/phase-events?room=${encodeURIComponent(room)}`
    );
    events.onmessage = () => {
      void loadControl();
      void loadTimer();
    };
    return () => {
      cancelled = true;
      channel?.close();
      events.close();
    };
  }, [loadPayload, loadTimer, room]);

  const title = useMemo(() => {
    if (control.view === "ready") return "디펜스 딜레마";
    const label = getDefenseRoundLabel(control.round);
    if (control.view === "result") return `${label} 전투 결과`;
    if (control.view === "score") return control.round === 16 ? "최종 순위" : `${label} 전체 점수`;
    return label;
  }, [control]);
  const timerText = `${Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`;

  if (!mounted) return <div className="min-h-screen bg-zinc-950" />;
  if (!room) {
    const goToRoom = () => {
      const code = roomInput.trim().toUpperCase();
      if (code) window.location.search = `?room=${encodeURIComponent(code)}`;
    };
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-zinc-50">
        <p className="text-xl">공용 화면을 연결할 방 코드를 입력하세요.</p>
        <div className="flex items-center gap-2">
          <input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && goToRoom()} placeholder="방 코드" className="rounded-xl bg-zinc-800 px-4 py-3 text-lg uppercase" />
          <button type="button" onClick={goToRoom} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-zinc-950">연결</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-zinc-950 px-4 py-4 text-zinc-50">
      <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col gap-3">
        <header className="flex shrink-0 items-end justify-between rounded-2xl border border-zinc-800 bg-zinc-900/90 px-5 py-3">
          <div>
            <p className="text-sm font-bold tracking-[0.25em] text-amber-300">DEFENSE DILEMMA</p>
            <h1 className="mt-0.5 text-3xl font-black">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {control.view === "monsters" ? (
              <p className={`font-mono text-4xl font-black tabular-nums ${remainingSeconds <= 30 && timerRunning ? "text-red-300" : "text-white"}`}>{timerText}</p>
            ) : (
              <p className="rounded-full bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-300">
                {control.view === "result" ? "결과 확인" : control.view === "score" ? "점수 공개" : "대기 중"}
              </p>
            )}
            <p className="rounded-full bg-zinc-800 px-4 py-2 font-mono text-sm text-zinc-400">ROOM {room}</p>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
              aria-label={isFullscreen ? "전체 화면 나가기" : "전체 화면으로 보기"}
            >
              {isFullscreen ? "⊠ 나가기" : "⛶ 전체 화면"}
            </button>
          </div>
        </header>
        {error && <p className="rounded-xl border border-red-900 bg-red-950/60 p-4 text-red-200">{error}</p>}
        {control.view === "ready" ? (
          <section className="flex min-h-[65vh] flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/50 text-center">
            <p className="text-6xl">🦉</p>
            <h2 className="mt-6 text-5xl font-black">곧 게임이 시작됩니다</h2>
            <p className="mt-4 text-xl text-zinc-400">진행자의 안내를 기다려주세요.</p>
          </section>
        ) : loading ? (
          <p className="py-20 text-center text-2xl text-zinc-400">화면을 준비하고 있습니다...</p>
        ) : control.view === "score" ? (
          <DefenseBoardScores scores={scores} showDamage={control.round === 16} />
        ) : (
          <div className="min-h-0 flex-1"><DefenseBoardGrid monsters={monsters} isResultView={control.view === "result"} /></div>
        )}
      </div>
    </div>
  );
}
