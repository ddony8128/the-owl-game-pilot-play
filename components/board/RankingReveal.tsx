"use client";

import type { ReactNode } from "react";
import { rankLabel } from "@/lib/defense/rank";
import { useRevealSteps } from "./useRevealSteps";

export type RankingRow = {
  id: string;
  rank: number;
  tieCount: number;
  name: string;
  /** 오른쪽 큰 숫자(점수·총자산) */
  right: string;
  /** 작은 보조 줄 */
  sub?: ReactNode;
  /** 이름 옆 배지(마피아 등) — 공개 연출이 끝난 뒤에만 그리고 싶으면 호출자가 조건으로 넣는다 */
  badge?: ReactNode;
  /** 행 강조색 */
  tone?: "gold" | "silver" | "bronze" | "danger" | "plain";
};

const TONE: Record<NonNullable<RankingRow["tone"]>, string> = {
  gold: "border-amber-300/80 bg-amber-400/15",
  silver: "border-zinc-200/70 bg-zinc-200/10",
  bronze: "border-orange-400/70 bg-orange-500/10",
  danger: "border-red-500/70 bg-red-950/50",
  plain: "border-white/10 bg-zinc-900/70",
};

export function toneForRank(rank: number): NonNullable<RankingRow["tone"]> {
  return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";
}

/**
 * 순위 목록 순차 공개 — **꼴찌부터** 한 줄씩(수산시장 BoardRankingList·증권가 Podium 과 같은 순서).
 * 행 높이·글자는 뷰포트 비율이라 15명이어도 1280×720 에서 한 화면. 8명 초과면 2단(세로 우선).
 * 공개가 끝나면 onDone. 연출을 다시 시작하려면 key 로 리마운트.
 */
export function RankingReveal({
  rows,
  onDone,
  stepMs = 700,
  heightVh = 62,
  testId = "board-ranking",
}: {
  rows: RankingRow[];
  onDone?: () => void;
  stepMs?: number;
  /** 목록에 쓸 수 있는 높이(vh) */
  heightVh?: number;
  testId?: string;
}) {
  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  const { shown, done } = useRevealSteps(ordered.length, onDone, stepMs);
  const twoCols = ordered.length > 8;
  const perCol = twoCols ? Math.ceil(ordered.length / 2) : ordered.length;
  const rowVh = Math.min(8.5, heightVh / Math.max(perCol, 1));
  const fs = `${Math.min(3.4, rowVh * 0.4).toFixed(2)}vh`;
  const small = `${Math.min(2, rowVh * 0.25).toFixed(2)}vh`;

  return (
    <div
      className="grid min-h-0 flex-none gap-x-[1.5vw] gap-y-[0.6vh]"
      style={{
        gridTemplateRows: `repeat(${perCol}, ${rowVh.toFixed(2)}vh)`,
        gridAutoFlow: "column",
        gridTemplateColumns: twoCols ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)",
      }}
      data-testid={testId}
      data-shown={shown}
      data-total={ordered.length}
      data-done={done ? "true" : "false"}
    >
      {ordered.map((r, i) => {
        const revealIndex = ordered.length - 1 - i; // 꼴찌부터
        const visible = shown > revealIndex;
        const tone = TONE[r.tone ?? toneForRank(r.rank)];
        return (
          <div
            key={r.id}
            className={`flex min-h-0 items-center gap-[1vw] overflow-hidden rounded-xl border px-[1.2vw] ${
              visible ? `board-reveal ${tone}` : "opacity-0"
            }`}
            style={{ fontSize: fs }}
            data-testid="board-ranking-row"
            data-rank={r.rank}
            data-shown={visible ? "true" : "false"}
          >
            <span className="w-[3.2em] flex-none text-center font-black leading-none tabular-nums">
              {r.tieCount > 1 ? (
                <span className="block">
                  <span className="block" style={{ fontSize: "0.55em" }}>
                    공동
                  </span>
                  {r.rank}위
                </span>
              ) : (
                `${r.rank}위`
              )}
            </span>
            <span className="board-user-text min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-[0.5em] truncate font-bold">
                <span className="truncate">{r.name}</span>
                {r.badge}
              </span>
              {r.sub ? (
                <span className="block truncate text-zinc-400" style={{ fontSize: small }}>
                  {r.sub}
                </span>
              ) : null}
            </span>
            <span className="flex-none font-black tabular-nums text-amber-300">{r.right}</span>
            <span className="sr-only">{rankLabel(r.rank, r.tieCount)}</span>
          </div>
        );
      })}
    </div>
  );
}
