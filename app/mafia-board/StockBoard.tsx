"use client";

import type { PriceChangeGroup } from "@/lib/mafia/boardSummary";
import { stockLogoSrc } from "./labels";

/** 종목별 최근 변동(가장 마지막 묶음 기준) */
export function lastDeltaByStock(changes: PriceChangeGroup[]): Map<string, { delta: number; round: number; phase: string }> {
  const out = new Map<string, { delta: number; round: number; phase: string }>();
  for (const g of changes) {
    for (const it of g.items) {
      out.set(it.stock_key, { delta: it.price_after - it.price_before, round: g.round, phase: g.phase });
    }
  }
  return out;
}

export function DeltaBadge({ delta, size = "md" }: { delta: number; size?: "md" | "lg" }) {
  const cls = delta > 0 ? "bg-red-500/20 text-red-300" : delta < 0 ? "bg-sky-500/20 text-sky-300" : "bg-zinc-700/60 text-zinc-300";
  const txt = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "— 0";
  const fs = size === "lg" ? "text-[clamp(1.2rem,3.4vh,2.4rem)]" : "text-[clamp(0.85rem,2.1vh,1.4rem)]";
  return (
    <span className={`inline-block rounded-full px-[0.7em] py-[0.1em] font-black tabular-nums ${cls} ${fs}`} data-delta={delta}>
      {txt}
    </span>
  );
}

/**
 * 시세판 — 현재 주가 4종목(공개 정보). 변동 배지는 마지막 변동 묶음 기준.
 * 카드 높이는 vh 비율이라 1280×720 에서 한 화면.
 */
export function StockBoard({
  prices,
  changes,
  compact = false,
}: {
  prices: { stock_key: string; price: number }[];
  changes: PriceChangeGroup[];
  compact?: boolean;
}) {
  const delta = lastDeltaByStock(changes);
  return (
    <div
      className={`grid min-h-0 gap-[1.2vw] ${compact ? "grid-cols-4" : "grid-cols-4"}`}
      style={{ height: compact ? "min(26vh, 100%)" : "min(46vh, 100%)" }}
      data-testid="board-stock-board"
    >
      {prices.map((s) => {
        const logo = stockLogoSrc(s.stock_key);
        const d = delta.get(s.stock_key);
        return (
          <div
            key={s.stock_key}
            className="flex min-h-0 flex-col items-center justify-center gap-[1vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/75 px-[1vw] py-[1.5vh] text-center backdrop-blur-sm"
            data-testid="board-stock-card"
            data-stock={s.stock_key}
            data-price={s.price}
          >
            {logo && !compact ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-[12vh] w-[12vh] flex-none rounded-xl object-cover" />
            ) : null}
            <p className="text-[clamp(1rem,2.8vh,1.9rem)] font-bold">{s.stock_key}</p>
            <p className="text-[clamp(1.8rem,6vh,4rem)] font-black leading-none tabular-nums text-amber-300">{s.price}원</p>
            {d ? <DeltaBadge delta={d.delta} /> : <span className="text-[clamp(0.8rem,1.9vh,1.2rem)] text-zinc-500">변동 없음</span>}
          </div>
        );
      })}
    </div>
  );
}
