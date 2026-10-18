"use client";

import { useState } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import { BoardFrame, type BoardBg } from "@/components/board/BoardFrame";
import { BoardLobby } from "@/components/board/BoardLobby";
import { BoardCountdown, useBoardTimer } from "@/components/board/BoardCountdown";
import { useMounted, useRoomParam } from "@/components/board/useBoardRoom";
import type { BoardApiResponse, BoardPhaseResponse, BoardScoresResponse } from "./types";
import { DefenseBoardGrid } from "./DefenseBoardGrid";
import { DefenseBoardScores } from "./DefenseBoardScores";
import { normalizeStage, roundName, type DefenseStage } from "@/lib/defense/steps";

// 디펜스 보드(빔) — GM 의 [다음] 버튼이 정한 단계(round, stage)를 그대로 보여 주고 그 화면에 머문다(또니 10-18).
//  ready  : 로비(QR·방 코드·입장 인원)
//  action : 이번 라운드 대기열("공격하세요!") + 카운트다운
//  prep   : 본게임 준비(새 대기열 공개, 타이머 없음)
//  result : 직전 라운드 전투 결과(몬스터별 순차 공개) — 끝나도 다음 단계로 넘어가지 않는다
//  score  : 점수 발표(꼴찌부터)
// 자동 넘김·수동 모드·"자동 추종" 문구는 없앴다.

type Kind = "ready" | "snapshot" | "result" | "score";

const BG_BY_KIND: Record<Kind, BoardBg> = {
  ready: "stage-defense",
  snapshot: "alley-defense",
  result: "alley-defense",
  score: "city-defense",
};

/** score 단계가 /api/defense/board-scores 에 넘길 round(API 가 3·16 은 직전 라운드 스냅샷을 쓴다) */
const SCORE_ROUND_PARAM: Record<number, number> = { 3: 3, 8: 7, 12: 11, 16: 16 };

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
      <p className="text-xl">보드 — 방 코드가 필요합니다.</p>
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

function scoreTitle(round: number): string {
  if (round === 3) return "튜토리얼 점수 발표";
  if (round === 16) return "최종 점수 발표";
  return "중간 점수 발표";
}

function DefenseBoard({ room }: { room: string }) {
  const q = encodeURIComponent(room);
  const phase = usePolling<BoardPhaseResponse>(`/api/defense/board-phase?room=${q}`, 2500);
  const gmRound = phase.data?.round ?? null;
  const stage: DefenseStage | null = gmRound == null ? null : normalizeStage(gmRound, phase.data?.stage);
  const prevRound = phase.data?.prevRound ?? (gmRound != null ? gmRound - 1 : null);

  // 단계 → 화면 종류·보여 줄 라운드
  const kind: Kind | null =
    stage == null ? null : stage === "ready" ? "ready" : stage === "result" ? "result" : stage === "score" ? "score" : "snapshot";
  const viewRound = stage === "result" ? prevRound : gmRound;
  const key = `${gmRound ?? "x"}:${stage ?? "none"}:${viewRound ?? "x"}`;

  // 타이머는 행동 단계에만(준비·결과·점수·본게임 준비에는 없음)
  const timer = useBoardTimer(stage === "action" ? `/api/gm/timers/defense?room=${q}` : null);

  const stateUrl = kind === "snapshot" || kind === "result" ? `/api/defense/board-state?room=${q}&round=${viewRound}` : null;
  const scoreUrl = kind === "score" && gmRound != null ? `/api/defense/board-scores?room=${q}&round=${SCORE_ROUND_PARAM[gmRound] ?? gmRound}` : null;
  const statePoll = usePolling<BoardApiResponse>(stateUrl, 2500);
  const scorePoll = usePolling<BoardScoresResponse>(scoreUrl, 2500);
  const stateData = stateUrl && statePoll.data && statePoll.data.round === viewRound ? statePoll.data : null;
  const scoreData =
    scoreUrl && gmRound != null && scorePoll.data && scorePoll.data.round === (SCORE_ROUND_PARAM[gmRound] ?? gmRound) ? scorePoll.data : null;

  const failures = Math.max(phase.failures, timer.failures, statePoll.failures, scorePoll.failures);
  const roomMissing = phase.status === 404;
  const ended = phase.data?.roomStatus === "ended";

  const title =
    roomMissing
      ? "방을 찾을 수 없습니다"
      : kind == null || gmRound == null
        ? "불러오는 중…"
        : kind === "ready"
          ? "곧 디펜스 딜레마가 시작됩니다"
          : stage === "prep"
            ? "본게임 준비"
            : kind === "snapshot"
              ? `${roundName(gmRound)} · 공격하세요!`
              : kind === "result"
                ? `${roundName(viewRound ?? gmRound - 1)} 전투 결과`
                : scoreTitle(gmRound);

  return (
    <BoardFrame
      bg={kind ? BG_BY_KIND[kind] : "stage-defense"}
      dim={kind === "ready" ? 0.62 : 0.8}
      title={title}
      subtitle={ended ? "종료된 방" : undefined}
      failures={failures}
      stage={{
        game: "defense",
        kind: kind ?? "none",
        stage: stage ?? "none",
        round: viewRound,
        "gm-round": gmRound,
        "stage-key": key,
      }}
      right={stage === "action" ? <BoardCountdown state={timer.state} label="행동 시간" /> : null}
    >
      {roomMissing ? (
        <p className="m-auto text-[clamp(1.2rem,3vh,2rem)] text-red-300">방 코드 {room} 을(를) 찾을 수 없습니다.</p>
      ) : kind == null || gmRound == null ? (
        <p className="m-auto text-[clamp(1rem,2.6vh,1.6rem)] text-zinc-400" data-testid="board-stage-loading">
          {phase.error ? `서버와 연결하는 중… (${phase.error})` : "불러오는 중…"}
        </p>
      ) : kind === "ready" ? (
        <BoardLobby code={room} playerCount={phase.data?.playerCount ?? null} heading="곧 디펜스 딜레마가 시작됩니다" />
      ) : kind === "score" ? (
        scoreData ? (
          <DefenseBoardScores key={key} scores={scoreData.scores} showDamage={gmRound === 16} />
        ) : (
          <StageLoading text="점수 정보를 불러오는 중입니다…" error={scorePoll.error} />
        )
      ) : stateData ? (
        <DefenseBoardGrid key={key} monsters={stateData.monsters} isResultView={kind === "result"} />
      ) : (
        <StageLoading text={`${roundName(viewRound ?? gmRound)} 정보를 불러오는 중입니다…`} error={statePoll.error} />
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
