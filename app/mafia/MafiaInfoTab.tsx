"use client";

import Image from "next/image";
import type {
  MafiaLog,
  MafiaPlayerState,
  MafiaStockState,
  MafiaStocksHolding,
} from "@/lib/types";

type Props = {
  mafiaPlayer: MafiaPlayerState | null;
  stocks: MafiaStockState[];
  logs: MafiaLog[];
};

export const JOB_META: Record<
  string,
  {
    label: string;
    icon: string | null;
  }
> = {
  ceo: { label: "CEO", icon: "/mafia/job/ceo.png" },
  salaryman: { label: "월급쟁이", icon: "/mafia/job/salaryman.png" },
  police: { label: "경찰", icon: "/mafia/job/police.png" },
  robber: { label: "강도", icon: "/mafia/job/robber.png" },
  mayor: { label: "시장", icon: "/mafia/job/mayor.png" },
  up_manipulator: {
    label: "상승 주가조작범",
    icon: "/mafia/job/up_manip.png",
  },
  down_manipulator: {
    label: "하락 주가조작범",
    icon: "/mafia/job/down_manip.png",
  },
  tax_auditor: {
    label: "세무조사원",
    icon: "/mafia/job/investor.png",
  },
  broker: {
    label: "증권사 직원",
    icon: "/mafia/job/financial.png",
  },
};

export function MafiaInfoTab({ mafiaPlayer, stocks, logs }: Props) {
  const holdings: MafiaStocksHolding =
    (mafiaPlayer?.stocks as MafiaStocksHolding | null) ?? {};

  const priceByKey = new Map<string, number>();
  for (const s of stocks) {
    priceByKey.set(s.stock_key, s.price);
  }

  const rows =
    holdings && typeof holdings === "object"
      ? Object.entries(holdings)
      : ([] as [string, { amount: number }][]);

  let totalStockValue = 0;
  const stockRows = rows.map(([key, info]) => {
    const amount = typeof info.amount === "number" ? info.amount : 0;
    const price = priceByKey.get(key) ?? 0;
    const value = amount * price;
    totalStockValue += value;
    return { key, amount, price, value };
  });

  const cash = mafiaPlayer?.cash ?? 0;
  const totalAsset = cash + totalStockValue;
  const displayedStockRows = stockRows.filter((row) => row.amount > 0);
  const jobId = mafiaPlayer?.job ?? null;
  const jobMeta =
    jobId && JOB_META[jobId]
      ? JOB_META[jobId]
      : jobId
      ? { label: jobId, icon: null }
      : null;

  const formatCoin = (value: number) => `${value.toLocaleString("ko-KR")} 코인`;

  return (
    <div className="flex flex-col gap-5 text-sm text-zinc-100">
      <section className="overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-zinc-900 to-amber-950/20 p-4 shadow-lg shadow-black/20">
        <p className="text-[11px] font-black tracking-[0.2em] text-amber-400">MY ROLE</p>
        <div className="mt-3 flex items-center gap-4">
          {jobMeta?.icon ? (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 shadow-md">
              <Image src={jobMeta.icon} alt={jobMeta.label} fill className="object-cover" />
            </div>
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-2xl text-zinc-600">?</div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-500">현재 내 직업</p>
            <p className="mt-1 truncate text-2xl font-black text-white">
              {jobMeta?.label ?? "배정 전"}
            </p>
            <p className="mt-1 text-xs text-red-300">다른 플레이어에게 공개하지 마세요.</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-zinc-200">내 자산</h2>
          <span className="text-xs text-zinc-600">현재 주가 기준</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">보유 현금</p>
            <p className="mt-1 text-lg font-black tabular-nums text-amber-300">{formatCoin(cash)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">주식 평가액</p>
            <p className="mt-1 text-lg font-black tabular-nums text-emerald-300">{formatCoin(totalStockValue)}</p>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-emerald-400">총 자산</p>
              <p className="text-[11px] text-zinc-600">현금 + 주식 평가액</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-white">{formatCoin(totalAsset)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-zinc-200">보유 주식</h2>
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500">{displayedStockRows.length}종목</span>
        </div>
        <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {displayedStockRows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              보유한 주식이 없습니다.
            </p>
          )}
          {displayedStockRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-zinc-100">{row.key}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {row.amount}주 × {row.price.toLocaleString("ko-KR")} 코인
                </p>
              </div>
              <span className="font-bold tabular-nums text-emerald-300">{formatCoin(row.value)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-zinc-200">전달 사항</h2>
          {logs.length > 0 ? <span className="text-xs text-zinc-600">{logs.length}개</span> : null}
        </div>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-200"
            >
              {log.content}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-sm text-zinc-600">아직 전달 사항이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
