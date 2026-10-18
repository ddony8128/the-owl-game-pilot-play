"use client";

import Image from "next/image";
import { JOB_META } from "./MafiaInfoTab";

// 규칙 탭 — 문구는 룰지(2026-10-14 v11)·코드와 한 줄씩 대조한 본문(main)을 그대로 쓰고, 배치만 포크 UI를 따른다.
// 참가자용 문구 원칙: 앱 조작·운영 설명(탭 이름, 화면 전환, 입장 방법)은 넣지 않는다.
const PHASES = [
  {
    number: "01",
    title: "라운드 준비",
    text: "대기 상태입니다. 첫 라운드에서는 모든 플레이어의 현금이 30원으로 초기화됩니다.",
  },
  {
    number: "02",
    title: "직업 경매",
    text: "얻고 싶은 직업 하나를 고르고, 그 직업에 베팅합니다. 낙찰에 실패하거나 베팅을 포기하면 자동으로 월급쟁이가 됩니다.",
  },
  {
    number: "03",
    title: "주식 거래 · 능력",
    text: "4종류 주식 중 원하는 만큼 매수/매도합니다. 같은 주식을 한 라운드에 매수 매도 둘 다 할 수는 없습니다. 또한 각 직업의 특수 능력을 사용합니다.",
  },
  {
    number: "04",
    title: "주가 변동",
    text: "거래량과 마피아 능력에 따라 주가가 변동되고, 직업별 월급이 지급됩니다. 각 직업의 능력이 적용됩니다.",
  },
  {
    number: "05",
    title: "투표",
    text: "경제사범으로 뽑고자 하는 사람에게 원하는 만큼 표를 행사합니다. 자기 자신에게는 투표할 수 없습니다. 표의 가격은 시장에 의해 1~3원 중 하나로 결정됩니다. 기본적으로는 1원입니다. 득표수는 공개되지 않습니다.",
  },
];

const JOB_RULES: readonly (readonly [string, string])[] = [
  [
    "up_manipulator",
    "국채를 제외한 한 종목의 주가를 1 올립니다. 그 종목이 이번 라운드 최대 매도 종목이라면 1이 추가로 상승합니다.",
  ],
  [
    "down_manipulator",
    "국채를 제외한 한 종목의 주가를 2 내립니다. 그 종목이 이번 라운드 최대 매수 종목이라면 1이 추가로 하락합니다.",
  ],
  [
    "robber",
    "자신을 제외한 두 명을 대상으로 지정해, 각 대상의 이번 라운드 수익의 25%(버림)를 빼앗습니다. 여기서 이번 라운드 수익은 주식 매도 수익과 직업 능력으로 인한 수익의 합을 의미합니다. 강도가 선택한 대상과 얻은 금액은 다른 플레이어에게 비공개입니다.",
  ],
  [
    "broker",
    "선택한 한 종목(국채 제외)의 총 거래금액 10%(버림)를 얻습니다.",
  ],
  [
    "police",
    "5원의 월급을 받습니다. 자신을 제외한 두 명을 조사해, 그 두 명 중 마피아가 있는지 알 수 있습니다. 그 라운드에서 마피아가 경제사범이 되면 시민 공통 보상에 더해 국채를 하나 더 받습니다.",
  ],
  [
    "tax_auditor",
    "5원의 월급을 받습니다. 자신을 제외한 두 명을 골라, 그 두 명이 보유한 주식 종류와 보유량, 이번 라운드 매수/매도 내역을 확인합니다.",
  ],
  [
    "mayor",
    "5원의 월급을 받습니다. 강도에게 지목될 경우 그 피해를 막아내고, 강도가 누구인지 알 수 있습니다. 이번 라운드의 표 가격을 1, 2, 3원 중 선택합니다.",
  ],
  [
    "ceo",
    "10원의 월급을 받습니다. 자신을 제외한 한 사람을 선택해 그 사람에게 5원을 지급합니다. 선택된 사람은 누구에게서 돈을 받았는지(CEO가 누구인지) 알 수 있습니다.",
  ],
  ["salaryman", "3원의 월급을 받는다부엉! 그것 말고는 없다부엉. 불쌍해부엉..."],
];

const MAFIA_JOBS = ["up_manipulator", "down_manipulator", "robber"];

export function MafiaRulesTab() {
  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-zinc-900 to-amber-950/20 p-4">
        <p className="text-[11px] font-black tracking-[0.18em] text-amber-400">QUICK GUIDE</p>
        <h2 className="mt-1 text-xl font-black text-white">게임 진행 순서</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          자본주의 마피아 규칙 요약이다부엉! 총 5라운드입니다.
        </p>
        <div className="mt-4 space-y-2">
          {PHASES.map((phase) => (
            <div
              key={phase.number}
              className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-xl bg-black/20 p-3"
            >
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
          <span>라운드 종료</span>
          <span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p>투표에서 뽑힌 사람은 경제사범이 됩니다.</p>
          <p>
            <b className="text-red-300">마피아가 경제사범으로 뽑히면</b> · 국채 가격이 1 오르고, 모든 시민은
            국채를 1개씩 얻습니다.
          </p>
          <p>
            <b className="text-amber-300">마피아가 뽑히지 않으면(동점/무투표 포함)</b> · 모든 마피아는 그 시점에서
            가장 비싼 주식 1주를 받습니다. 가장 비싼 주식이 여러 종류라면 각 마피아에게 랜덤으로 지급됩니다.
          </p>
          <p>
            <b className="text-zinc-200">경제사범 벌금</b> · 마피아 여부와 상관 없이 경제사범은 국채 가격만큼
            벌금을 냅니다.
          </p>
        </div>
      </details>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-black text-white">직업 능력 요약</h2>
          <span className="text-[11px] text-zinc-600">눌러서 펼치기</span>
        </div>
        {JOB_RULES.map(([jobId, description]) => {
          const job = JOB_META[jobId];
          const isMafia = MAFIA_JOBS.includes(jobId);
          return (
            <details
              key={jobId}
              className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                  {job?.icon ? <Image src={job.icon} alt="" fill className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-zinc-100">{job?.label ?? jobId}</p>
                  {isMafia ? (
                    <span className="text-[11px] font-bold text-red-400">마피아 직업</span>
                  ) : (
                    <span className="text-[11px] text-zinc-600">시민 직업</span>
                  )}
                </div>
                <span className="text-zinc-600 transition group-open:rotate-180">⌄</span>
              </summary>
              <p className="border-t border-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-400">
                {description}
              </p>
            </details>
          );
        })}
      </section>
    </div>
  );
}
