"use client";

import { useState } from "react";
import { usePolling } from "@/lib/hooks/usePolling";
import type { MafiaBoardSummary } from "@/lib/mafia/boardSummary";
import { BoardFrame, type BoardBg } from "@/components/board/BoardFrame";
import { BoardLobby } from "@/components/board/BoardLobby";
import { BoardCountdown, useBoardTimer } from "@/components/board/BoardCountdown";
import { useMounted, useRoomParam } from "@/components/board/useBoardRoom";
import { StockBoard } from "./StockBoard";
import { PriceReveal } from "./PriceReveal";
import { MafiaResult } from "./MafiaResult";
import { PHASE_LABEL, PHASE_TIMER_LABEL, mafiaRoundLabel } from "./labels";

export function MafiaBoardClient() {
  const mounted = useMounted();
  const room = useRoomParam();
  if (!mounted) return <div className="h-dvh bg-zinc-950" />;
  if (!room) return <RoomPrompt />;
  return <MafiaBoard room={room} />;
}

function RoomPrompt() {
  const [roomInput, setRoomInput] = useState("");
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-8 text-zinc-50">
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
        <button type="submit" className="h-10 rounded-lg bg-amber-400 px-4 text-base font-semibold text-zinc-950 hover:bg-amber-300">
          이동
        </button>
      </form>
    </div>
  );
}

type View = "lobby" | "live" | "waiting" | "result";

function MafiaBoard({ room }: { room: string }) {
  const q = encodeURIComponent(room);
  const summary = usePolling<MafiaBoardSummary>(`/api/mafia/board-summary?room=${q}`, 3000);
  const timer = useBoardTimer(`/api/gm/timers/mafia?room=${q}`);
  const data = summary.data;

  // 주가 변동 묶음 순차 공개 규칙(렌더 중 파생 — effect 안 setState 없음):
  //  - 처음 받은 응답의 묶음은 "이미 본 것"(열자마자 옛 변동을 다시 틀지 않는다).
  //  - 그 뒤 새로 생긴 묶음 중 **현재 라운드** 것만, 생긴 순서대로(정산 → 투표) 하나씩 공개한다.
  //  - 지난 라운드 묶음이 밀려 있으면(보드가 뒤처졌거나 GM 이 빠르게 넘김) 틀지 않고 본 것으로 처리한다.
  //  - 공개 중에는 새 묶음이 와도 끝날 때까지 바꾸지 않는다(리마운트로 0에서 다시 시작하는 사고 방지).
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [active, setActive] = useState<string | null>(null);
  if (data && seen === null) setSeen(new Set(data.changes.map((c) => c.key)));
  const unseen = data && seen ? data.changes.filter((c) => !seen.has(c.key)) : [];
  const stale = unseen.filter((c) => data && c.round !== data.round);
  if (stale.length > 0) {
    setSeen((prev) => {
      const next = new Set(prev ?? []);
      for (const c of stale) next.add(c.key);
      return next;
    });
  }
  const nextGroup = unseen.find((c) => data && c.round === data.round) ?? null;
  if (active === null && nextGroup) setActive(nextGroup.key);
  const pending = active ? (data?.changes.find((c) => c.key === active) ?? null) : null;
  const finishReveal = (key: string) => {
    setSeen((prev) => {
      const next = new Set(prev ?? []);
      next.add(key);
      return next;
    });
    setActive(null);
  };

  const view: View | null = !data
    ? null
    : data.revealed
      ? "result"
      : data.finished
        ? "waiting"
        : data.round <= 0 && (data.phase === "prepare" || data.phase === null)
          ? "lobby"
          : "live";

  const failures = Math.max(summary.failures, timer.failures);
  const roomMissing = summary.status === 404;
  const phaseLabel = data?.phase ? PHASE_LABEL[data.phase] : "";
  const title =
    view === "result"
      ? "자본주의 마피아 — 최종 결과"
      : view === "waiting"
        ? "모든 라운드가 끝났습니다"
        : view === "lobby"
          ? "곧 자본주의 마피아가 시작됩니다"
          : view === "live" && data
            ? `${mafiaRoundLabel(data.round)} · ${phaseLabel}`
            : roomMissing
              ? "방을 찾을 수 없습니다"
              : "불러오는 중…";
  const bg: BoardBg = view === "result" ? "skyline-mafia" : view === "lobby" ? "hall-mafia" : "floor-mafia";

  return (
    <BoardFrame
      bg={bg}
      dim={view === "lobby" ? 0.62 : view === "live" ? 0.82 : 0.78}
      title={title}
      subtitle={
        <>
          자본주의 마피아 · 방 {room}
          {data ? ` · ${mafiaRoundLabel(data.round)} ${phaseLabel}` : ""}
          {data?.roomStatus === "ended" ? " · 종료된 방" : ""}
        </>
      }
      failures={failures}
      stage={{
        game: "mafia",
        view: view ?? "none",
        round: data?.round ?? null,
        phase: data?.phase ?? null,
        finished: data?.finished ?? false,
        revealed: data?.revealed ?? false,
      }}
      right={<BoardCountdown state={timer.state} label={data?.phase ? PHASE_TIMER_LABEL[data.phase] : undefined} />}
    >
      {roomMissing ? (
        <p className="m-auto text-[clamp(1.2rem,3vh,2rem)] text-red-300">방 코드 {room} 을(를) 찾을 수 없습니다.</p>
      ) : !data || !view ? (
        <p className="m-auto text-[clamp(1rem,2.6vh,1.6rem)] text-zinc-400" data-testid="board-stage-loading">
          {summary.error ? `서버와 연결하는 중… (${summary.error})` : "불러오는 중…"}
        </p>
      ) : view === "lobby" ? (
        <BoardLobby
          code={room}
          playerCount={data.playerCount}
          heading="곧 자본주의 마피아가 시작됩니다"
          hint="QR을 찍어 입장하세요. 닉네임은 진행자가 등록한 이름과 같아야 합니다. 권장 인원 6~12명."
        />
      ) : view === "result" ? (
        <MafiaResult data={data} />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-[2vh]" data-testid="board-live">
          {view === "waiting" ? (
            <div className="flex-none text-center" data-testid="board-waiting-reveal">
              <p className="text-[clamp(1.6rem,5vh,3.4rem)] font-black text-amber-300">게임이 끝나면 결과가 공개됩니다</p>
              <p className="mt-[1vh] text-[clamp(1rem,2.6vh,1.7rem)] text-zinc-300">
                최종 순위와 직업(마피아 포함)은 진행자가 공개 버튼을 누르면 이 화면에 표시됩니다.
              </p>
            </div>
          ) : (
            <p className="flex-none text-center text-[clamp(1rem,2.6vh,1.7rem)] text-zinc-300">
              {data.phase === "trade"
                ? "거래가 끝나면 주가 변동을 종목별로 공개합니다"
                : data.phase === "auction"
                  ? "폰에서 원하는 직업에 베팅하세요"
                  : data.phase === "vote"
                    ? "경제사범으로 의심되는 사람에게 투표하세요"
                    : "현재 주가"}
            </p>
          )}
          <StockBoard prices={data.prices} changes={data.changes} />
          {pending ? <PriceReveal key={pending.key} group={pending} onDone={() => finishReveal(pending.key)} /> : null}
        </div>
      )}
    </BoardFrame>
  );
}
