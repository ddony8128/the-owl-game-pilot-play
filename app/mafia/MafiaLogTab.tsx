"use client";

import type { MafiaRoundLog } from "@/lib/mafia/playerLog";

type Props = {
  log: MafiaRoundLog[];
};

// 로그 탭 — 라운드별 내 기록(경매·거래·정산·투표). 서버가 내 행만 담아 보내며(남의 직업·남의 표 없음) 종료 후에도 열람 가능.
const KIND_LABEL: Record<MafiaRoundLog["entries"][number]["kind"], string> = {
  auction: "경매",
  trade: "거래·능력",
  settlement: "정산",
  vote: "투표",
};

const KIND_CLASS: Record<MafiaRoundLog["entries"][number]["kind"], string> = {
  auction: "bg-amber-400/15 text-amber-200",
  trade: "bg-emerald-400/15 text-emerald-200",
  settlement: "bg-sky-400/15 text-sky-200",
  vote: "bg-rose-400/15 text-rose-200",
};

export function MafiaLogTab({ log }: Props) {
  if (log.length === 0) {
    return (
      <div className="text-base text-zinc-400" data-testid="mafia-log-empty">
        아직 기록이 없습니다. 경매·거래·투표를 하면 라운드별로 여기에 쌓입니다.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-base text-zinc-200" data-testid="mafia-log">
      <p className="text-sm text-zinc-400">
        내 기록만 보입니다(남의 직업·표는 보이지 않습니다). 최근 라운드부터.
      </p>
      {log.map((r) => (
        <section
          key={r.round}
          data-testid={`mafia-log-round-${r.round}`}
          className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
        >
          <h3 className="text-sm font-semibold text-zinc-100">
            {r.round === 0 ? "튜토리얼" : `${r.round}라운드`}
          </h3>
          <ul className="space-y-1.5">
            {r.entries.map((e, idx) => (
              <li key={`${r.round}-${idx}`} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${KIND_CLASS[e.kind]}`}
                >
                  {KIND_LABEL[e.kind]}
                </span>
                <span className="user-text min-w-0 whitespace-pre-wrap break-words">{e.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
