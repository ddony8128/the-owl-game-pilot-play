"use client";

import type { VoteResult } from "@/lib/mafia/boardSummary";
import { useRevealSteps } from "@/components/board/useRevealSteps";
import { mafiaRoundLabel } from "./labels";

/**
 * ITER6 B4(2026-10-18 또니) — 라운드 종료 때 보드에 그 라운드의 경제사범 결과를 공개한다(튜토리얼 포함).
 * 지목자 닉네임과 마피아 여부만 보여 준다 — 득표수·누가 누구에게 투표했는지는 보이지 않는다.
 * 공개 연출은 다른 보드 공개와 같은 useRevealSteps(제목 → 지목자 → 판정). 라운드마다 key 로 리마운트.
 */
export function VoteResultReveal({ result }: { result: VoteResult }) {
  const none = result.outcome === "none";
  const { shown } = useRevealSteps(none ? 1 : 2);
  return (
    <div
      className="flex-none rounded-3xl border border-amber-400/40 bg-zinc-950/80 px-[3vw] py-[2.4vh] text-center"
      data-testid="board-vote-result"
      data-outcome={result.outcome}
      data-round={result.round}
    >
      <p className="text-[clamp(1rem,2.8vh,1.8rem)] font-bold text-zinc-300">{mafiaRoundLabel(result.round)} 투표 결과</p>
      {none ? (
        <p
          className={`mt-[1vh] text-[clamp(1.8rem,6vh,4rem)] font-black text-zinc-100 ${shown >= 1 ? "board-reveal" : "opacity-0"}`}
          data-testid="board-vote-none"
        >
          경제사범 없음 <span className="text-[0.55em] font-bold text-zinc-400">(동점 또는 무투표)</span>
        </p>
      ) : (
        <>
          <p className={`mt-[1vh] text-[clamp(1.8rem,6vh,4rem)] font-black text-white ${shown >= 1 ? "board-reveal" : "opacity-0"}`}>
            이번 라운드 경제사범: <span className="text-amber-300" data-testid="board-vote-nickname">{result.nickname ?? "?"}</span>
          </p>
          <p
            className={`mt-[0.6vh] text-[clamp(1.4rem,4.6vh,3rem)] font-black ${
              result.outcome === "mafia" ? "text-red-400" : "text-sky-300"
            } ${shown >= 2 ? "board-reveal" : "opacity-0"}`}
            data-testid="board-vote-verdict"
          >
            {result.outcome === "mafia" ? "마피아였습니다" : "마피아가 아니었습니다"}
          </p>
        </>
      )}
    </div>
  );
}
