"use client";

import { useEffect, useRef } from "react";
import type { PriceChangeGroup } from "@/lib/mafia/boardSummary";
import { useRevealSteps } from "@/components/board/useRevealSteps";
import { boardHoldMs } from "@/components/board/useBoardRoom";
import { DeltaBadge } from "./StockBoard";
import { mafiaRoundLabel, stockLogoSrc } from "./labels";

/** 전체가 공개된 뒤 시세판으로 돌아가기 전 머무는 시간 */
const PRICE_REVEAL_HOLD_MS = 3500;

/**
 * 주가 변동 순차 공개(증권가 RevealSequence 방식) — 종목을 1.4초 간격으로 하나씩, 변동이 큰 종목을 뒤에.
 * 공개 가능한 정보(주가)만 담는다. 새 묶음마다 key 로 리마운트.
 */
export function PriceReveal({ group, onDone }: { group: PriceChangeGroup; onDone: () => void }) {
  const order = [...group.items].sort(
    (a, b) => Math.abs(a.price_after - a.price_before) - Math.abs(b.price_after - b.price_before),
  );
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const { shown, done } = useRevealSteps(order.length);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => doneRef.current(), boardHoldMs(PRICE_REVEAL_HOLD_MS));
    return () => window.clearTimeout(t);
  }, [done]);

  const title = group.phase === "vote" ? `${mafiaRoundLabel(group.round)} 투표 결과 · 국채` : `${mafiaRoundLabel(group.round)} 주가 변동`;
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/95 px-[4vw] backdrop-blur-sm"
      data-testid="board-price-reveal"
      data-key={group.key}
      data-shown={shown}
      data-total={order.length}
      data-done={done ? "true" : "false"}
    >
      <h2 className="mb-[3vh] text-[clamp(1.6rem,5vh,3.4rem)] font-black text-amber-300">{title}</h2>
      <div className="flex w-full max-w-[70vw] flex-col gap-[1.2vh]">
        {order.map((it, i) => {
          const visible = shown > i;
          const delta = it.price_after - it.price_before;
          const logo = stockLogoSrc(it.stock_key);
          return (
            <div
              key={it.stock_key}
              className={`flex items-center justify-between rounded-2xl border px-[2vw] py-[1.4vh] ${
                visible ? "board-reveal border-white/15 bg-zinc-900/90" : "border-transparent opacity-0"
              }`}
              style={{ height: "min(11vh, 96px)" }}
              data-testid="board-price-reveal-row"
              data-stock={it.stock_key}
              data-shown={visible ? "true" : "false"}
            >
              <span className="flex min-w-0 items-center gap-[1vw] text-[clamp(1.2rem,3.6vh,2.4rem)] font-black">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="h-[7vh] w-[7vh] rounded-lg object-cover" />
                ) : null}
                <span className="truncate">{it.stock_key}</span>
              </span>
              <span className="flex flex-none items-baseline gap-[1.5vw]">
                <span className="text-[clamp(1rem,2.8vh,1.8rem)] text-zinc-400 tabular-nums">{it.price_before}원 →</span>
                <span className="text-[clamp(1.4rem,4.2vh,2.8rem)] font-black tabular-nums text-amber-300">{it.price_after}원</span>
                <DeltaBadge delta={delta} size="lg" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
