"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import { BoardFrame, type BoardBg } from "@/components/board/BoardFrame";
import { BoardLobby } from "@/components/board/BoardLobby";
import { BoardCountdown, useBoardTimer } from "@/components/board/BoardCountdown";
import { boardHoldMs, useMounted, useRoomParam } from "@/components/board/useBoardRoom";
import type { BoardApiResponse, BoardPhaseResponse, BoardScoresResponse } from "./types";
import { DefenseBoardGrid } from "./DefenseBoardGrid";
import { DefenseBoardScores } from "./DefenseBoardScores";
import { TIMELINE, getRoundLabel, stageKey, stageTitle, stagesForRound, timelineIndexOf, type BoardStage } from "./stages";

/** 전투 결과 공개가 끝난 뒤 다음 단계로 넘어가기 전 머무는 시간 */
const RESULT_HOLD_MS = 4000;
/** 점수 발표가 끝난 뒤 대기열로 넘어가기 전 머무는 시간(진행자가 말할 시간) */
const SCORE_HOLD_MS = 12000;

const BG_BY_KIND: Record<BoardStage["kind"], BoardBg> = {
  ready: "stage-defense",
  snapshot: "alley-defense",
  result: "alley-defense",
  score: "city-defense",
};

export function DefenseBoardClient() {
  const mounted = useMounted();
  const room = useRoomParam();
  if (!mounted) return <div className="h-dvh bg-zinc-950" />;
  if (!room) return <RoomPrompt />;
  return <DefenseBoard room={room} />;
}

function RoomPrompt() {
  const [roomInput, setRoomInput] = useState("");
  const goToRoom = () => {
    const code = roomInput.trim().toUpperCase();
    if (!code) return;
    window.location.search = `?room=${encodeURIComponent(code)}`;
  };
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-zinc-50">
      <p className="text-xl">결과 페이지 — 방 코드가 필요합니다.</p>
      <div className="flex items-center gap-2">
        <input
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToRoom();
          }}
          placeholder="방 코드"
          className="rounded bg-zinc-800 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={goToRoom}
          className="rounded bg-amber-400 px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-amber-300"
        >
          이동
        </button>
      </div>
    </div>
  );
}

function DefenseBoard({ room }: { room: string }) {
  const q = encodeURIComponent(room);
  // GM 라운드 자동 추종(공개 정보만) + 헤더 카운트다운(기존 타이머 API)
  const phase = usePolling<BoardPhaseResponse>(`/api/defense/board-phase?room=${q}`, 2500);
  const timer = useBoardTimer(`/api/gm/timers/defense?room=${q}`);
  const gmRound = phase.data?.round ?? null;

  // ── 자동 추종 단계: GM 라운드가 바뀌면 그 라운드의 첫 단계부터(렌더 중 파생 — effect 안 setState 없음) ──
  const [auto, setAuto] = useState<{ round: number; idx: number }>({ round: -1, idx: 0 });
  const autoStages = gmRound == null ? [] : stagesForRound(gmRound);
  const autoIdx = gmRound != null && auto.round === gmRound ? Math.min(auto.idx, autoStages.length - 1) : 0;

  // ── 수동 모드: 옛 [이전]/[다음] 타임라인 ──
  const [manual, setManual] = useState(false);
  const [manualIdx, setManualIdx] = useState(0);

  const stage: BoardStage | null = manual ? TIMELINE[manualIdx] : (autoStages[autoIdx] ?? null);
  const key = stage ? `${manual ? "m" : "a"}:${stage.gmRound}:${stageKey(stage)}` : "none";

  // 단계 데이터(공개 API). usePolling 은 URL 이 바뀌어도 옛 data 를 지우지 않으므로 round 로 걸러 쓴다.
  const stateUrl =
    stage && (stage.kind === "snapshot" || stage.kind === "result")
      ? `/api/defense/board-state?room=${q}&round=${stage.round}`
      : null;
  const scoreUrl =
    stage && stage.kind === "score" ? `/api/defense/board-scores?room=${q}&round=${stage.scoreRound ?? stage.round}` : null;
  const statePoll = usePolling<BoardApiResponse>(stateUrl, 2500);
  const scorePoll = usePolling<BoardScoresResponse>(scoreUrl, 2500);
  const stateData = stage && statePoll.data && statePoll.data.round === stage.round ? statePoll.data : null;
  const scoreData =
    stage && scorePoll.data && scorePoll.data.round === (stage.scoreRound ?? stage.round) ? scorePoll.data : null;

  // ── 자동 단계 넘김: 연출이 끝나면 hold 뒤 다음 단계. 단계가 바뀌면 예약을 지운다. ──
  const holdRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (holdRef.current != null) window.clearTimeout(holdRef.current);
      holdRef.current = null;
    };
  }, [key]);
  const handleStageDone = useCallback(() => {
    if (manual || !stage || gmRound == null) return;
    if (autoIdx >= autoStages.length - 1) return;
    const hold = boardHoldMs(stage.kind === "score" ? SCORE_HOLD_MS : stage.kind === "result" ? RESULT_HOLD_MS : 0);
    if (holdRef.current != null) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null;
      setAuto((prev) => ({ round: gmRound, idx: (prev.round === gmRound ? prev.idx : 0) + 1 }));
    }, hold);
  }, [manual, stage, gmRound, autoIdx, autoStages.length]);

  const toggleManual = () => {
    if (!manual && stage) setManualIdx(timelineIndexOf(stage));
    setManual((m) => !m);
  };
  const canPrev = manual && manualIdx > 0;
  const canNext = manual && manualIdx < TIMELINE.length - 1;

  const failures = Math.max(phase.failures, timer.failures, statePoll.failures, scorePoll.failures);
  const roomMissing = phase.status === 404;
  const ended = phase.data?.roomStatus === "ended";

  const title = stage ? stageTitle(stage) : roomMissing ? "방을 찾을 수 없습니다" : "불러오는 중…";
  const subtitle = (
    <>
      디펜스 딜레마 · 방 {room}
      {gmRound != null ? ` · 진행 ${getRoundLabel(gmRound)}` : ""}
      {manual ? " · 수동 모드" : " · 자동 추종"}
      {ended ? " · 종료된 방" : ""}
    </>
  );

  return (
    <BoardFrame
      bg={stage ? BG_BY_KIND[stage.kind] : "stage-defense"}
      dim={stage?.kind === "ready" ? 0.62 : 0.8}
      title={title}
      subtitle={subtitle}
      failures={failures}
      stage={{
        game: "defense",
        kind: stage?.kind ?? "none",
        round: stage?.round ?? null,
        "gm-round": gmRound,
        mode: manual ? "manual" : "auto",
        "stage-key": key,
      }}
      right={
        <>
          <BoardCountdown state={timer.state} label="행동 시간" />
          <div className="flex items-center gap-2">
            {manual ? (
              <>
                <button
                  type="button"
                  className="h-9 rounded-full bg-zinc-800 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                  disabled={!canPrev}
                  onClick={() => setManualIdx((i) => Math.max(0, i - 1))}
                  data-testid="board-prev"
                >
                  이전
                </button>
                <button
                  type="button"
                  className="h-9 rounded-full bg-amber-400 px-3 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                  disabled={!canNext}
                  onClick={() => setManualIdx((i) => Math.min(TIMELINE.length - 1, i + 1))}
                  data-testid="board-next"
                >
                  다음
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={toggleManual}
              aria-pressed={manual}
              data-testid="board-manual-toggle"
              className={`h-9 rounded-full border px-3 text-sm font-semibold ${
                manual ? "border-amber-300 bg-amber-400/20 text-amber-200" : "border-white/15 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {manual ? "자동 추종으로" : "수동 모드"}
            </button>
          </div>
        </>
      }
    >
      {roomMissing ? (
        <p className="m-auto text-[clamp(1.2rem,3vh,2rem)] text-red-300">방 코드 {room} 을(를) 찾을 수 없습니다.</p>
      ) : !stage ? (
        <p className="m-auto text-[clamp(1rem,2.6vh,1.6rem)] text-zinc-400" data-testid="board-stage-loading">
          {phase.error ? `서버와 연결하는 중… (${phase.error})` : "불러오는 중…"}
        </p>
      ) : stage.kind === "ready" ? (
        <BoardLobby
          code={room}
          playerCount={phase.data?.playerCount ?? null}
          heading="곧 디펜스 딜레마가 시작됩니다"
          hint="QR을 찍어 입장하세요. 닉네임은 진행자가 등록한 이름과 같아야 합니다. 접속이 끊겼으면 같은 닉네임으로 다시 들어오면 됩니다."
        />
      ) : stage.kind === "score" ? (
        scoreData ? (
          <DefenseBoardScores
            key={key}
            scores={scoreData.scores}
            showDamage={stage.round === 16}
            onDone={handleStageDone}
          />
        ) : (
          <StageLoading text={`${getRoundLabel(stage.round)} 점수 정보를 불러오는 중입니다…`} error={scorePoll.error} />
        )
      ) : stateData ? (
        <DefenseBoardGrid
          key={key}
          monsters={stateData.monsters}
          isResultView={stage.kind === "result"}
          onDone={handleStageDone}
        />
      ) : (
        <StageLoading text={`${getRoundLabel(stage.round)} 정보를 불러오는 중입니다…`} error={statePoll.error} />
      )}
    </BoardFrame>
  );
}

function StageLoading({ text, error }: { text: string; error: string | null }) {
  return (
    <div className="m-auto text-center" data-testid="board-stage-loading">
      <p className="text-[clamp(1rem,2.6vh,1.6rem)] text-zinc-400">{text}</p>
      {error ? <p className="mt-2 text-[clamp(0.8rem,1.8vh,1.1rem)] text-red-300">{error}</p> : null}
    </div>
  );
}
