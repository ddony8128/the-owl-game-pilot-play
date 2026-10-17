"use client";

import { useEffect, useMemo, useState } from "react";
import type { MafiaBoardSummary } from "@/lib/mafia/boardSummary";
import { RankingReveal, type RankingRow } from "@/components/board/RankingReveal";
import { boardHoldMs } from "@/components/board/useBoardRoom";
import { jobLabel } from "./labels";

/** 순위가 다 나온 뒤 마피아 공개까지의 뜸 */
const MAFIA_REVEAL_DELAY_MS = 1800;

/**
 * 최종 결과(GM 공개 토글 뒤) — 포디움 단계 공개(꼴찌부터) → 1~3위 → 마피아 공개 연출.
 * 이 컴포넌트는 revealed=true 인 응답(final 에 is_mafia 가 들어 있는)에서만 그려진다.
 */
export function MafiaResult({ data }: { data: MafiaBoardSummary }) {
  const [rankingDone, setRankingDone] = useState(false);
  const [mafiaShown, setMafiaShown] = useState(false);
  const [page, setPage] = useState<"podium" | "rounds">("podium");

  useEffect(() => {
    if (!rankingDone) return;
    const t = window.setTimeout(() => setMafiaShown(true), boardHoldMs(MAFIA_REVEAL_DELAY_MS));
    return () => window.clearTimeout(t);
  }, [rankingDone]);

  const rows: RankingRow[] = useMemo(
    () =>
      data.final.map((p) => ({
        id: p.player_id,
        rank: p.rank,
        tieCount: p.tieCount,
        name: p.nickname ?? "(이름 없음)",
        right: `${p.total_assets.toLocaleString()}원`,
        sub: `현금 ${p.cash.toLocaleString()} · 주식 ${p.holdings_value.toLocaleString()} · ${jobLabel(p.job)}`,
        tone: mafiaShown && p.is_mafia ? "danger" : undefined,
        badge:
          mafiaShown && p.is_mafia ? (
            <span
              className="board-reveal flex-none rounded-md bg-red-600 px-[0.5em] py-[0.05em] text-white"
              style={{ fontSize: "0.7em" }}
              data-testid="board-mafia-badge"
            >
              마피아
            </span>
          ) : undefined,
      })),
    [data.final, mafiaShown],
  );
  const mafiaNames = data.final.filter((p) => p.is_mafia).map((p) => p.nickname ?? "(이름 없음)");

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="board-mafia-result" data-mafia-shown={mafiaShown ? "true" : "false"}>
      <div className="mb-[1vh] flex flex-none items-center justify-between">
        <p className="text-[clamp(0.8rem,1.9vh,1.2rem)] text-zinc-400">
          총자산 = 현금 + 보유 주식 × 최종 주가 · 같으면 현금이 많은 쪽 · 그래도 같으면 공동 순위
        </p>
        <button
          type="button"
          onClick={() => setPage((p) => (p === "podium" ? "rounds" : "podium"))}
          className="h-8 rounded-full border border-white/15 bg-zinc-900/60 px-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          data-testid="board-result-page-toggle"
        >
          {page === "podium" ? "라운드별 추이 보기" : "최종 순위로"}
        </button>
      </div>

      {page === "podium" ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <RankingReveal rows={rows} onDone={() => setRankingDone(true)} heightVh={58} testId="board-podium" />
          <div className="mt-[1.5vh] flex h-[7vh] flex-none items-center justify-center">
            {mafiaShown ? (
              <p
                className="board-reveal rounded-2xl border border-red-500/70 bg-red-950/70 px-[2vw] py-[1vh] text-[clamp(1.2rem,3.4vh,2.4rem)] font-black text-red-200"
                data-testid="board-mafia-banner"
              >
                이번 게임의 마피아: {mafiaNames.length > 0 ? mafiaNames.join(", ") : "없음"}
              </p>
            ) : rankingDone ? (
              <p className="board-drum text-[clamp(1rem,2.8vh,1.8rem)] text-zinc-300">마피아는 누구였을까요…</p>
            ) : null}
          </div>
        </div>
      ) : (
        <RoundsTable data={data} />
      )}
    </div>
  );
}

function RoundsTable({ data }: { data: MafiaBoardSummary }) {
  const roundList = data.rounds.map((r) => r.round);
  const byPlayerRound = new Map<string, Map<number, MafiaBoardSummary["rounds"][number]["players"][number]>>();
  for (const rd of data.rounds) {
    for (const p of rd.players) {
      if (!byPlayerRound.has(p.player_id)) byPlayerRound.set(p.player_id, new Map());
      byPlayerRound.get(p.player_id)!.set(rd.round, p);
    }
  }
  const rowCount = Math.max(1, data.final.length);
  const rowVh = Math.min(6, 66 / (rowCount + 1));
  const fs = `${Math.min(2.2, rowVh * 0.42).toFixed(2)}vh`;
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 p-[1vw]" data-testid="board-rounds-table">
      <table className="w-full border-collapse" style={{ fontSize: fs }}>
        <thead>
          <tr style={{ height: `${rowVh}vh` }}>
            <th className="px-[0.6vw] text-left text-zinc-400">플레이어</th>
            {roundList.map((r) => (
              <th key={r} className="px-[0.6vw] text-center text-zinc-400">
                {r}라운드
              </th>
            ))}
            <th className="px-[0.6vw] text-center text-amber-300">최종</th>
          </tr>
        </thead>
        <tbody>
          {data.final.map((fin) => {
            const perRound = byPlayerRound.get(fin.player_id);
            return (
              <tr key={fin.player_id} className="border-t border-white/10" style={{ height: `${rowVh}vh` }}>
                <td className="board-user-text max-w-[14vw] truncate px-[0.6vw] font-bold">
                  {fin.rank}위 {fin.nickname ?? "(이름 없음)"}
                  {fin.is_mafia ? <span className="ml-[0.4em] rounded bg-red-600 px-[0.3em] text-white" style={{ fontSize: "0.75em" }}>마피아</span> : null}
                </td>
                {roundList.map((r) => {
                  const cell = perRound?.get(r) ?? null;
                  return (
                    <td key={r} className={`px-[0.6vw] text-center tabular-nums ${cell?.is_mafia ? "bg-red-950/50 text-red-200" : ""}`}>
                      {cell ? (
                        <>
                          <span className="text-zinc-400" style={{ fontSize: "0.8em" }}>
                            {jobLabel(cell.job)}
                          </span>{" "}
                          <b>{cell.total_assets.toLocaleString()}원</b>
                        </>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-[0.6vw] text-center font-black tabular-nums text-amber-300">{fin.total_assets.toLocaleString()}원</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-[0.8vh] text-zinc-500" style={{ fontSize: "0.9em" }}>
        빨간 칸은 그 라운드에 마피아(주가조작범·강도) 직업이었음을 뜻합니다.
      </p>
    </div>
  );
}
