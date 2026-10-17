"use client";

import Image from "next/image";
import { JOB_META } from "./MafiaInfoTab";

const PHASES = [
  { number: "01", title: "직업 경매", text: "원하는 직업 하나에 입찰합니다. 낙찰에 실패하거나 포기하면 월급쟁이가 됩니다." },
  { number: "02", title: "주식 거래 · 능력", text: "주식을 사고팔고 직업 능력을 사용합니다. 같은 종목은 한 라운드에 매수와 매도를 모두 할 수 없습니다." },
  { number: "03", title: "투표", text: "경제사범으로 지목할 사람에게 표를 사용합니다. 표 가격은 기본 1원이며 시장의 능력으로 달라질 수 있습니다." },
  { number: "04", title: "결과 확인", text: "투표 결과는 전광판에 공개됩니다. 관리자가 다음 라운드를 시작하면 곧바로 새 직업 경매가 열립니다." },
];

const JOB_RULES = [
  ["up_manipulator", "국채를 제외한 종목 하나를 1 올립니다. 최대 매도 종목이면 1이 추가로 오릅니다."],
  ["down_manipulator", "국채를 제외한 종목 하나를 2 내립니다. 최대 매수 종목이면 1이 추가로 내립니다."],
  ["robber", "두 명을 골라 각 대상의 이번 라운드 수익 25%(버림)를 빼앗습니다. 대상과 금액은 비공개입니다."],
  ["broker", "선택한 종목의 이번 라운드 총 거래금액 중 10%(버림)를 받습니다."],
  ["police", "5코인의 월급을 받고 두 명을 조사합니다. 둘 중 마피아가 있는지를 확인하며, 마피아 검거 시 국채 1주를 받습니다."],
  ["tax_auditor", "5코인의 월급을 받고 두 명의 보유 주식과 이번 라운드 거래 내역을 확인합니다."],
  ["mayor", "5코인의 월급을 받습니다. 강도의 공격을 막고 정체를 확인하며, 표 가격을 1~3원으로 정합니다."],
  ["ceo", "10코인의 월급을 받고 다른 한 명에게 5코인을 지급합니다."],
  ["salaryman", "별도 능력 없이 매 라운드 3코인의 월급을 받습니다."],
] as const;

export function MafiaRulesTab() {
  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-zinc-900 to-amber-950/20 p-4">
        <p className="text-[11px] font-black tracking-[0.18em] text-amber-400">QUICK GUIDE</p>
        <h2 className="mt-1 text-xl font-black text-white">게임 진행 순서</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">총 5라운드입니다. 최초 시작할 때 모든 플레이어는 30코인으로 시작합니다.</p>
        <div className="mt-4 space-y-2">
          {PHASES.map((phase) => (
            <div key={phase.number} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-xl bg-black/20 p-3">
              <span className="font-mono text-lg font-black text-amber-400">{phase.number}</span>
              <div>
                <p className="font-black text-zinc-100">{phase.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{phase.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <details className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900" open>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black text-white">
          <span>투표 결과 규칙</span><span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p><b className="text-red-300">마피아 지목 성공</b> · 국채 가격이 1 오르고 모든 시민이 국채 1주를 받습니다.</p>
          <p><b className="text-amber-300">지목 실패·동률·무투표</b> · 모든 마피아가 현재 가장 비싼 주식 1주를 받습니다.</p>
          <p><b className="text-zinc-200">경제사범 벌금</b> · 정체와 관계없이 현재 국채 가격만큼 벌금을 냅니다.</p>
        </div>
      </details>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1"><h2 className="font-black text-white">직업 능력</h2><span className="text-[11px] text-zinc-600">눌러서 펼치기</span></div>
        {JOB_RULES.map(([jobId, description]) => {
          const job = JOB_META[jobId];
          const isMafia = ["up_manipulator", "down_manipulator", "robber"].includes(jobId);
          return (
            <details key={jobId} className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800">{job?.icon ? <Image src={job.icon} alt="" fill className="object-cover" /> : null}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-zinc-100">{job?.label ?? jobId}</p>
                  {isMafia ? <span className="text-[11px] font-bold text-red-400">마피아 직업</span> : <span className="text-[11px] text-zinc-600">시민 직업</span>}
                </div>
                <span className="text-zinc-600 transition group-open:rotate-180">⌄</span>
              </summary>
              <p className="border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">{description}</p>
            </details>
          );
        })}
      </section>
    </div>
  );
}
