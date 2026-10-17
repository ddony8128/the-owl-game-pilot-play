"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_BROADCAST_CHANNEL,
  type BoardBroadcastMessage,
} from "@/lib/boardBroadcast";

type PlayerAsset = {
  player_id: string;
  nickname: string | null;
  job: string | null;
  is_mafia: boolean;
  cash: number;
  holdings_value: number;
  total_assets: number;
};

type Summary = {
  finished: boolean;
  roomEnded: boolean;
  currentRound: number;
  currentPhase: string | null;
  stocks: { stock_key: string; price: number }[];
  voteResult: {
    round: number;
    totalVotes: number;
    tied: boolean;
    selectedTarget: {
      player_id: string;
      nickname: string | null;
      votes: number;
      is_mafia: boolean;
    } | null;
    ranking: {
      player_id: string;
      nickname: string | null;
      votes: number;
    }[];
  } | null;
  rounds: { round: number; players: PlayerAsset[] }[];
  final: PlayerAsset[];
};

type BoardTimer = {
  remainingSeconds: number;
  isRunning: boolean;
  totalSeconds: number;
};

const summaryRequests = new Map<string, Promise<Summary>>();
const timerRequests = new Map<string, Promise<BoardTimer>>();

async function fetchSummary(room: string): Promise<Summary> {
  const pending = summaryRequests.get(room);
  if (pending) return pending;

  const request = (async () => {
    const res = await fetch(
      `/api/mafia/board-summary?room=${encodeURIComponent(room)}`
    );
    const json = (await res.json().catch(() => null)) as
      | Summary
      | { error: string }
      | null;
    if (!res.ok || !json || "error" in json) {
      throw new Error(
        (json as { error?: string })?.error ?? "결과를 불러오지 못했습니다."
      );
    }
    return json;
  })();
  summaryRequests.set(room, request);
  try {
    return await request;
  } finally {
    summaryRequests.delete(room);
  }
}

async function fetchBoardTimer(room: string): Promise<BoardTimer> {
  const pending = timerRequests.get(room);
  if (pending) return pending;
  const request = (async () => {
    const res = await fetch(`/api/gm/timers/mafia?room=${encodeURIComponent(room)}`);
    const json = (await res.json().catch(() => null)) as
      | (BoardTimer & { error?: string })
      | null;
    if (!res.ok || !json) {
      throw new Error(json?.error ?? "타이머를 불러오지 못했습니다.");
    }
    return json;
  })();
  timerRequests.set(room, request);
  try {
    return await request;
  } finally {
    timerRequests.delete(room);
  }
}

const JOB_LABEL: Record<string, string> = {
  up_manipulator: "상승 조작범",
  down_manipulator: "하락 조작범",
  robber: "강도",
  police: "경찰",
  tax_auditor: "세무조사원",
  mayor: "시장",
  broker: "증권사 직원",
  ceo: "CEO",
  salaryman: "월급쟁이",
};

function jobLabel(job: string | null): string {
  if (!job) return "월급쟁이";
  return JOB_LABEL[job] ?? job;
}

const RANK_ACCENT = ["text-amber-300", "text-zinc-200", "text-orange-400"];

const STOCK_LOGO: Record<string, string> = {
  부엉교육: "/mafia/company/edu.png",
  번쩍전기: "/mafia/company/electricity.png",
  국채: "/mafia/company/owl_flag.png",
  이상교통: "/mafia/company/vehicle.png",
};

const AUCTION_JOBS = [
  { label: "상승 주가조작범", icon: "/mafia/job/up_manip.png" },
  { label: "하락 주가조작범", icon: "/mafia/job/down_manip.png" },
  { label: "강도", icon: "/mafia/job/robber.png" },
  { label: "경찰", icon: "/mafia/job/police.png" },
  { label: "세무조사원", icon: "/mafia/job/investor.png" },
  { label: "증권사 직원", icon: "/mafia/job/financial.png" },
  { label: "시장", icon: "/mafia/job/mayor.png" },
  { label: "CEO", icon: "/mafia/job/ceo.png" },
];

const PHASE_LABEL: Record<string, string> = {
  prepare: "준비",
  auction: "직업 경매",
  trade: "주식 거래",
  apply: "시장 반영",
  vote: "투표",
  end: "라운드 종료",
};

export function MafiaBoardClient() {
  // 하이드레이션 안전: URL(room)은 서버에서 알 수 없으므로 마운트 후에만 읽는다.
  const [room, setRoom] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL은 브라우저 마운트 후 읽는다.
    setRoom(new URLSearchParams(window.location.search).get("room"));
    setMounted(true);
  }, []);
  const [roomInput, setRoomInput] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [finalView, setFinalView] = useState<"vote" | "ranking" | "history">("vote");
  const [timer, setTimer] = useState<BoardTimer>({
    remainingSeconds: 0,
    isRunning: false,
    totalSeconds: 0,
  });
  const oneMinuteSyncDoneRef = useRef(false);

  useEffect(() => {
    const syncFullscreen = () =>
      setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!timer.isRunning) return;
    const id = window.setInterval(() => {
      setTimer((current) => {
        const remainingSeconds = Math.max(0, current.remainingSeconds - 1);
        return {
          ...current,
          remainingSeconds,
          isRunning: remainingSeconds > 0,
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer.isRunning]);

  useEffect(() => {
    if (timer.remainingSeconds > 60) {
      oneMinuteSyncDoneRef.current = false;
      return;
    }
    if (
      !room ||
      !timer.isRunning ||
      timer.remainingSeconds <= 0 ||
      oneMinuteSyncDoneRef.current
    ) {
      return;
    }
    oneMinuteSyncDoneRef.current = true;
    let cancelled = false;
    void fetchBoardTimer(room)
      .then((nextTimer) => {
        if (!cancelled) setTimer(nextTimer);
      })
      .catch(() => {
        // 다음 관리자 알림 때 다시 시도한다.
      });
    return () => {
      cancelled = true;
    };
  }, [room, timer.isRunning, timer.remainingSeconds]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // 브라우저가 전체 화면을 허용하지 않으면 현재 화면을 유지한다.
    }
  };

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const load = async () => {
      try {
        const json = await fetchSummary(room);
        if (cancelled) return;
        setData(json);
        if (json.roomEnded) {
          setFinalView("ranking");
        } else if (!json.finished) {
          setFinalView("vote");
        }
        setError(null);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "결과를 불러오지 못했습니다.");
      }
    };
    const loadTimer = async () => {
      try {
        const nextTimer = await fetchBoardTimer(room);
        if (!cancelled) setTimer(nextTimer);
      } catch {
        // 주가 화면은 유지하고 타이머만 다음 관리자 알림 때 다시 시도한다.
      }
    };
    void Promise.all([load(), loadTimer()]);
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel(BOARD_BROADCAST_CHANNEL)
        : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<BoardBroadcastMessage>) => {
        if (event.data.room === room && event.data.kind === "mafia-summary") {
          void load();
          void loadTimer();
        } else if (
          event.data.room === room &&
          event.data.kind === "mafia-timer"
        ) {
          void loadTimer();
        }
      };
    }
    return () => {
      cancelled = true;
      channel?.close();
    };
  }, [room]);

  const timerMinutes = Math.floor(timer.remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const timerSeconds = (timer.remainingSeconds % 60).toString().padStart(2, "0");
  const timerText = timer.totalSeconds > 0 ? `${timerMinutes}:${timerSeconds}` : "--:--";

  // 라운드별 추이 테이블용: player_id → (round → asset)
  const { byPlayerRound, roundList } = useMemo(() => {
    const map = new Map<string, Map<number, PlayerAsset>>();
    const rounds: number[] = [];
    for (const rd of data?.rounds ?? []) {
      rounds.push(rd.round);
      for (const p of rd.players) {
        if (!map.has(p.player_id)) map.set(p.player_id, new Map());
        map.get(p.player_id)!.set(rd.round, p);
      }
    }
    return { byPlayerRound: map, roundList: rounds };
  }, [data]);

  // 마운트 전에는 서버 렌더와 동일한 빈 화면을 그려 하이드레이션 불일치를 피한다.
  if (!mounted) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  if (!room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-8 text-zinc-50">
        <p className="text-2xl">결과 페이지 — 방 코드가 필요합니다.</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const code = roomInput.trim().toUpperCase();
            if (code) window.location.search = `?room=${encodeURIComponent(code)}`;
          }}
        >
          <input
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base outline-none focus:border-zinc-400"
            placeholder="방 코드"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-amber-400 px-4 text-base font-semibold text-zinc-950 hover:bg-amber-300"
          >
            이동
          </button>
        </form>
      </div>
    );
  }

  // 게임 종료 전: 결과 비공개
  if (!data?.finished) {
    return (
      <div className="flex h-dvh overflow-hidden flex-col bg-zinc-950 px-5 py-4 text-zinc-50 sm:px-8 sm:py-5">
        <header className="flex shrink-0 items-end justify-between gap-5 border-b border-zinc-800 pb-3">
          <div>
            <p className="text-sm font-black tracking-[0.3em] text-amber-400">CAPITALISM MAFIA</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">
              {data?.currentPhase === "end"
                ? "투표 결과"
                : data?.currentPhase === "auction"
                  ? "직업 경매"
                  : "현재 주가 현황"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold tracking-[0.18em] text-zinc-600">남은 시간</p>
              <p
                className={`font-mono text-4xl font-black tabular-nums ${
                  timer.isRunning && timer.remainingSeconds <= 30
                    ? "text-red-300"
                    : "text-white"
                }`}
              >
                {timerText}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-bold tracking-widest text-zinc-500">ROOM {room}</p>
              <p className="mt-1 text-lg font-bold text-zinc-300">
                {data?.currentRound === 0 ? "튜토리얼" : `${data?.currentRound ?? 0}라운드`}
                {data?.currentPhase ? ` · ${PHASE_LABEL[data.currentPhase] ?? data.currentPhase}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              {isFullscreen ? "⊠ 나가기" : "⛶ 전체 화면"}
            </button>
          </div>
        </header>

        {data?.currentPhase === "end" && data.voteResult ? (
          <main className="grid min-h-0 flex-1 gap-5 py-4 lg:grid-cols-[1.05fr_1fr]">
            <section className="flex min-h-0 flex-col items-center justify-center rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-zinc-900 to-zinc-950 p-6 text-center">
              <p className="text-sm font-black tracking-[0.25em] text-amber-300">
                {data.voteResult.round}라운드 경제사범 지목
              </p>
              {data.voteResult.selectedTarget ? (
                <>
                  <p className="mt-4 text-[clamp(2.6rem,7vw,6rem)] font-black leading-none text-white">
                    {data.voteResult.selectedTarget.nickname ?? "이름 없음"}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-amber-300">
                    {data.voteResult.selectedTarget.votes}표로 지목
                  </p>
                  <div
                    className={`mt-6 rounded-2xl px-7 py-4 text-[clamp(1.4rem,3vw,2.4rem)] font-black ${
                      data.voteResult.selectedTarget.is_mafia
                        ? "bg-red-500/20 text-red-300"
                        : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {data.voteResult.selectedTarget.is_mafia
                      ? "마피아였습니다"
                      : "마피아가 아니었습니다"}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-5 text-[clamp(2.3rem,6vw,5rem)] font-black text-zinc-100">
                    지목 없음
                  </p>
                  <p className="mt-4 text-xl font-bold text-zinc-400">
                    {data.voteResult.tied
                      ? "동률로 경제사범이 정해지지 않았습니다"
                      : "유효한 투표가 없습니다"}
                  </p>
                </>
              )}
              <p className="mt-6 text-sm font-bold text-zinc-500">
                총 {data.voteResult.totalVotes}표
              </p>
            </section>

            <section className="flex min-h-0 flex-col rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
              <h2 className="shrink-0 text-xl font-black text-zinc-200">득표 현황</h2>
              <div className="mt-4 grid min-h-0 flex-1 content-center gap-3 overflow-hidden">
                {data.voteResult.ranking.map((row, index) => {
                  const maxVotes = data.voteResult?.ranking[0]?.votes ?? 1;
                  return (
                    <div key={row.player_id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                      <span className="text-center text-lg font-black text-zinc-500">{index + 1}</span>
                      <div className="min-w-0">
                        <div className="mb-1 flex justify-between gap-3 text-base font-bold">
                          <span className="truncate text-zinc-100">{row.nickname ?? "이름 없음"}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${Math.max(8, (row.votes / maxVotes) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-14 text-right font-mono text-2xl font-black text-amber-300">
                        {row.votes}표
                      </span>
                    </div>
                  );
                })}
                {data.voteResult.ranking.length === 0 ? (
                  <p className="text-center text-xl text-zinc-500">집계된 투표가 없습니다.</p>
                ) : null}
              </div>
            </section>
          </main>
        ) : data?.currentPhase === "auction" ? (
          <main className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-3 py-4 sm:gap-4">
            {AUCTION_JOBS.map((job) => (
              <article
                key={job.label}
                className="flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-b from-amber-400/10 to-zinc-900 px-3 py-3 text-center shadow-xl shadow-black/20"
              >
                <div className="relative aspect-square h-[min(20vh,9rem)] max-w-full shrink-0 overflow-hidden rounded-full border-2 border-amber-300/30 bg-zinc-800">
                  <Image src={job.icon} alt={job.label} fill className="object-cover" />
                </div>
                <p className="mt-3 text-[clamp(0.8rem,1.6vw,1.35rem)] font-black leading-tight text-zinc-100">
                  {job.label}
                </p>
              </article>
            ))}
          </main>
        ) : (
          <main className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-4 py-4 sm:gap-5">
            {(data?.stocks ?? []).map((stock) => (
              <article
                key={stock.stock_key}
                className="flex min-h-0 items-center gap-5 overflow-hidden rounded-3xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-950 px-5 py-4 shadow-2xl shadow-black/30 sm:px-8"
              >
                <div className="relative aspect-square h-[min(15vh,7rem)] shrink-0 overflow-hidden rounded-2xl bg-zinc-800">
                  {STOCK_LOGO[stock.stock_key] ? (
                    <Image src={STOCK_LOGO[stock.stock_key]} alt="" fill className="object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[clamp(1.1rem,2.2vw,2rem)] font-black text-zinc-200">{stock.stock_key}</p>
                  <p className="mt-1 font-mono text-[clamp(2.5rem,6vw,5rem)] font-black leading-none tabular-nums text-emerald-300">
                    {stock.price}
                    <span className="ml-2 text-lg text-zinc-500 sm:text-2xl">원</span>
                  </p>
                </div>
              </article>
            ))}
            {data && data.stocks.length === 0 ? (
              <p className="col-span-full text-center text-xl text-zinc-500">표시할 주가 정보가 없습니다.</p>
            ) : null}
          </main>
        )}

        <footer className="flex shrink-0 items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500 sm:text-sm">
          <span>
            {data?.currentPhase === "end"
              ? "다음 라운드가 시작되면 주가 화면으로 돌아갑니다."
              : data?.currentPhase === "auction"
                ? "개인 화면에서 원하는 직업 하나에 입찰해 주세요."
              : "주가는 게임 단계가 변경될 때 갱신됩니다."}
          </span>
          <span>게임 종료 후 최종 순위가 공개됩니다.</span>
        </footer>
        {error && <p className="mt-4 text-base text-red-400">{error}</p>}
      </div>
    );
  }

  const historyPlayers = [...data.final].sort((a, b) =>
    (a.nickname ?? "").localeCompare(b.nickname ?? "", "ko")
  );
  const historySlots = Array.from(
    { length: 9 },
    (_, index) => historyPlayers[index] ?? null
  );

  return (
    <div className="flex h-dvh overflow-hidden flex-col bg-zinc-950 px-5 py-4 text-zinc-50 sm:px-8 sm:py-5">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 pb-3">
        <div>
          <p className="text-xs font-black tracking-[0.25em] text-amber-400">CAPITALISM MAFIA · FINAL</p>
          <h1 className="mt-1 text-2xl font-black sm:text-4xl">
            {finalView === "vote"
              ? "5라운드 투표 결과"
              : finalView === "history"
                ? "라운드별 재산 추이 · 직업"
                : "최종 순위"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {finalView === "history" ? (
            <button type="button" onClick={() => setFinalView("ranking")} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">
              ← 최종 순위
            </button>
          ) : finalView === "ranking" && !data.roomEnded ? (
            <button type="button" onClick={() => setFinalView("vote")} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">
              ← 투표 결과
            </button>
          ) : null}
          <button type="button" onClick={() => void toggleFullscreen()} className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-amber-400 hover:text-amber-300">
            {isFullscreen ? "⊠ 나가기" : "⛶ 전체 화면"}
          </button>
        </div>
      </header>

      {finalView === "vote" ? (
        <main className="relative min-h-0 flex-1 py-4">
          <div className="grid h-full min-h-0 gap-5 pb-14 lg:grid-cols-[1.05fr_1fr]">
            <section className="flex min-h-0 flex-col items-center justify-center rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-zinc-900 to-zinc-950 p-6 text-center">
              <p className="text-sm font-black tracking-[0.25em] text-amber-300">FINAL VOTE</p>
              {data.voteResult?.selectedTarget ? (
                <>
                  <p className="mt-4 text-[clamp(2.6rem,7vw,6rem)] font-black leading-none text-white">{data.voteResult.selectedTarget.nickname ?? "이름 없음"}</p>
                  <p className="mt-3 text-2xl font-bold text-amber-300">{data.voteResult.selectedTarget.votes}표로 지목</p>
                  <div className={`mt-6 rounded-2xl px-7 py-4 text-[clamp(1.4rem,3vw,2.4rem)] font-black ${data.voteResult.selectedTarget.is_mafia ? "bg-red-500/20 text-red-300" : "bg-sky-500/20 text-sky-300"}`}>
                    {data.voteResult.selectedTarget.is_mafia ? "마피아였습니다" : "마피아가 아니었습니다"}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-5 text-[clamp(2.3rem,6vw,5rem)] font-black text-zinc-100">지목 없음</p>
                  <p className="mt-4 text-xl font-bold text-zinc-400">{data.voteResult?.tied ? "동률로 경제사범이 정해지지 않았습니다" : "유효한 투표가 없습니다"}</p>
                </>
              )}
              <p className="mt-6 text-sm font-bold text-zinc-500">총 {data.voteResult?.totalVotes ?? 0}표</p>
            </section>
            <section className="flex min-h-0 flex-col rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
              <h2 className="shrink-0 text-xl font-black text-zinc-200">득표 현황</h2>
              <div className="mt-4 grid min-h-0 flex-1 content-center gap-3 overflow-hidden">
                {(data.voteResult?.ranking ?? []).map((row, index) => {
                  const maxVotes = data.voteResult?.ranking[0]?.votes ?? 1;
                  return (
                    <div key={row.player_id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                      <span className="text-center text-lg font-black text-zinc-500">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="mb-1 truncate text-base font-bold text-zinc-100">{row.nickname ?? "이름 없음"}</p>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(8, (row.votes / maxVotes) * 100)}%` }} /></div>
                      </div>
                      <span className="w-14 text-right font-mono text-2xl font-black text-amber-300">{row.votes}표</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <button type="button" onClick={() => setFinalView("ranking")} className="absolute bottom-0 right-0 rounded-xl bg-amber-400 px-6 py-3 text-base font-black text-zinc-950 shadow-lg shadow-amber-950/40 hover:bg-amber-300">
            다음 · 최종 순위 →
          </button>
        </main>
      ) : finalView === "history" ? (
        <main className="flex min-h-0 flex-1 flex-col py-3">
          <div className="shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
            <table className="w-full table-fixed border-collapse text-[clamp(0.62rem,1vw,0.95rem)]">
              <thead className="bg-zinc-900">
                <tr className="h-10 border-b border-zinc-700">
                  <th className="w-[13%] px-2 text-left text-zinc-400">플레이어</th>
                  {roundList.map((round) => <th key={round} className="px-1 text-center text-zinc-400">{round}R</th>)}
                  <th className="px-1 text-center text-amber-300">최종 자산</th>
                </tr>
              </thead>
              <tbody>
                {historySlots.map((finalPlayer, slotIndex) => {
                  const playerId = finalPlayer?.player_id ?? null;
                  const perRound = playerId ? byPlayerRound.get(playerId) : null;
                  return (
                    <tr key={playerId ?? `empty-${slotIndex}`} className="h-12 border-t border-zinc-800 first:border-t-0">
                      <td className={`truncate px-2 font-black ${finalPlayer ? "text-white" : "text-zinc-700"}`}>{finalPlayer?.nickname ?? `빈자리 ${slotIndex + 1}`}</td>
                      {roundList.map((round) => {
                        const cell = perRound?.get(round) ?? null;
                        return (
                          <td key={round} className={`px-1 text-center ${cell?.is_mafia ? "bg-red-950/50" : ""}`}>
                            {cell ? (
                              <p className={`truncate whitespace-nowrap font-bold ${cell.is_mafia ? "text-red-300" : "text-zinc-200"}`}>
                                {jobLabel(cell.job)} <span className="font-mono tabular-nums text-amber-300">({cell.total_assets.toLocaleString()}원)</span>
                              </p>
                            ) : <span className="text-zinc-700">-</span>}
                          </td>
                        );
                      })}
                      <td className="px-1 text-center font-mono font-black tabular-nums text-amber-300">{finalPlayer ? `${finalPlayer.total_assets.toLocaleString()}원` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex shrink-0 items-center gap-4">
            <p className="text-xs text-zinc-500">빨간 칸은 해당 라운드의 마피아 직업입니다. 자산은 라운드 종료 시점 기준입니다.</p>
          </div>
        </main>
      ) : (
        <main className="relative min-h-0 flex-1 py-4">
          <div className="flex h-full items-end justify-center gap-4 pb-14 sm:gap-7">
            {[1, 0, 2].map((rankIndex) => {
            const player = data.final[rankIndex] ?? null;
            const rank = rankIndex + 1;
            const isWinner = rank === 1;
            const heightClass = isWinner
              ? "h-[82%]"
              : rank === 2
                ? "h-[68%]"
                : "h-[58%]";
            const toneClass = isWinner
              ? "border-amber-300 bg-gradient-to-b from-amber-400/25 to-amber-950/30"
              : rank === 2
                ? "border-zinc-400/60 bg-gradient-to-b from-zinc-300/15 to-zinc-900"
                : "border-orange-600/50 bg-gradient-to-b from-orange-700/15 to-zinc-900";

            return (
              <article key={rank} className={`relative flex w-[29%] max-w-md flex-col items-center justify-between overflow-hidden rounded-t-[2rem] border-x border-t px-4 py-5 text-center shadow-2xl shadow-black/40 ${heightClass} ${toneClass}`}>
                <div className="flex flex-col items-center">
                  <span className={`font-mono text-[clamp(3rem,7vw,7rem)] font-black leading-none ${RANK_ACCENT[rankIndex] ?? "text-zinc-500"}`}>{rank}</span>
                  <span className="mt-1 text-xs font-black tracking-[0.2em] text-zinc-500">PLACE</span>
                </div>
                {player ? (
                  <div className="w-full min-w-0">
                    {isWinner ? <div className="mb-2 text-[clamp(2.5rem,5vw,5rem)] leading-none">🏆</div> : null}
                    <div className="flex items-center justify-center gap-2">
                      <p className="truncate text-[clamp(1.2rem,2.5vw,2.4rem)] font-black text-white">{player.nickname ?? "이름 없음"}</p>
                      {player.is_mafia ? <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">마피아</span> : null}
                    </div>
                    <p className="mt-2 truncate text-sm font-bold text-zinc-400">{jobLabel(player.job)}</p>
                    <p className="mt-4 font-mono text-[clamp(1.5rem,3.5vw,3.5rem)] font-black tabular-nums text-amber-300">{player.total_assets.toLocaleString()}원</p>
                  </div>
                ) : (
                  <div className="mb-auto mt-auto text-sm font-bold text-zinc-700">순위 없음</div>
                )}
                <div className={`absolute inset-x-0 bottom-0 h-2 ${isWinner ? "bg-amber-300" : rank === 2 ? "bg-zinc-300" : "bg-orange-600"}`} />
              </article>
            );
            })}
          </div>
          <button type="button" onClick={() => setFinalView("history")} className="absolute bottom-0 right-0 rounded-xl bg-amber-400 px-6 py-3 text-base font-black text-zinc-950 shadow-lg shadow-amber-950/40 hover:bg-amber-300">
            다음 · 상세 결과 →
          </button>
        </main>
      )}
    </div>
  );
}
