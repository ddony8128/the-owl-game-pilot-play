"use client";

import { useState } from "react";
import { ConfirmDialog, PendingLine } from "@/components/ConfirmDialog";
import { getDefenseRoundLabel } from "@/lib/admin/defenseLabels";
import { checkDefenseAdvance } from "@/lib/admin/headcount";
import { planDefenseRewind } from "@/lib/admin/rewindRules";
import { defenseStageTitle, nextDefenseStep, normalizeStage, type DefenseStage } from "@/lib/defense/steps";
import type { PendingInfo } from "./useDefenseAdminState";

type Props = {
  round: number | null;
  stage: string | null;
  prevRound: number | null;
  playerCount: number;
  pending: PendingInfo | null;
  disabled?: boolean;
  busy?: boolean;
  /** [다음] — 화면이 보고 있던 (round, stage) 를 함께 보낸다 */
  onNext: (from: { round: number; stage: DefenseStage }) => Promise<void>;
  onRewind: (from: number) => Promise<void>;
};

// 진행 — 버튼 하나([다음])로 단계를 넘긴다(또니 10-18, 수산시장 방식). 버튼 이름은 다음 단계 이름으로 바뀐다.
//  준비 → 튜토리얼 1라운드 시작 → 튜토리얼 1라운드 결과 보기 → 튜토리얼 2라운드 시작 → … → 튜토리얼 점수 발표 → 본게임 준비
//  → 1라운드 시작 → 1라운드 결과 보기 → … → 4라운드 결과 보기 → 중간 점수 발표 → 5라운드 시작 → … → 최종 결과 발표
// 화면 구성(큰 단계 이름·본게임 진행률·큰 호박색 버튼)은 bluecode674 포크의 대시보드를 따른다.
export function DefenseRoundSection({
  round,
  stage: stageRaw,
  prevRound,
  playerCount,
  pending,
  disabled = false,
  busy = false,
  onNext,
  onRewind,
}: Props) {
  const currentRound = typeof round === "number" ? round : 0;
  const stage = normalizeStage(currentRound, stageRaw);
  const step = nextDefenseStep(currentRound, stage);
  const [dialog, setDialog] = useState<"advance" | "rewind" | null>(null);

  const rewindPlan = planDefenseRewind(currentRound);
  const headcount = checkDefenseAdvance(playerCount);
  const settles = step?.kind === "round" && step.settles;
  const isFirstStart = step?.kind === "round" && step.nextRound === 1;
  const title = defenseStageTitle(currentRound, stage, prevRound);

  // 본게임 진행률(1~12라운드). 결과 단계는 직전 라운드 기준.
  const progressRound =
    stage === "result" || stage === "score" ? (prevRound ?? currentRound - 1) : currentRound;
  const mainRound = progressRound >= 4 && progressRound <= 15 ? progressRound - 3 : null;
  const progress =
    currentRound >= 16 ? 100 : mainRound ? Math.round((mainRound / 12) * 100) : 0;

  return (
    <section className="flex h-full flex-col gap-5 text-base" data-testid="defense-round-section">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">진행</h2>
          {pending?.applicable && stage === "action" && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300" data-testid="pending-count">
              제출 {pending.submitted}/{pending.total}
              {pending.pending.length > 0 && (
                <span className="text-amber-300"> · 미제출 {pending.pending.length}명</span>
              )}
            </span>
          )}
        </div>
        <p className="mt-1 text-4xl font-black text-white" data-testid="stage-title">
          {title}
        </p>
        {mainRound && (
          <p className="mt-2 text-sm text-zinc-400">
            본게임 전체 12라운드 중 <b className="text-emerald-300">{mainRound}라운드</b>
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>준비</span>
          <span>본게임 진행률 {progress}%</span>
          <span>종료</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button
          type="button"
          data-testid="advance-round"
          className="min-h-16 w-full rounded-2xl bg-amber-400 px-5 text-lg font-black text-zinc-950 shadow-xl shadow-amber-950/40 transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          disabled={!step || disabled || busy}
          onClick={() => setDialog("advance")}
        >
          {step ? `${step.label} ▶` : "게임이 끝났습니다"}
        </button>
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span>{step ? "" : "최종 결과까지 공개했습니다. 상단의 [게임 종료]로 마무리하세요."}</span>
          <button
            type="button"
            data-testid="rewind-round"
            className="rounded-full border border-red-700/60 bg-zinc-900 px-3 py-1 text-red-200 hover:bg-red-950 disabled:opacity-40"
            disabled={!rewindPlan || disabled || busy}
            title={
              rewindPlan
                ? `${getDefenseRoundLabel(currentRound)} → ${getDefenseRoundLabel(rewindPlan.to)} 로 되돌립니다(이번 라운드 제출 0건일 때만)`
                : "준비 단계에서는 되돌릴 수 없습니다"
            }
            onClick={() => setDialog("rewind")}
          >
            ↩ 되돌리기
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "advance" && !!step}
        title={step?.label ?? ""}
        confirmLabel={step?.label ?? "다음"}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          if (step) await onNext({ round: currentRound, stage });
        }}
      >
        {settles && (
          <>
            <PendingLine pending={pending} />
            <p className="text-zinc-300">
              지금 넘기면 <b>{getDefenseRoundLabel(currentRound)}의 전투 정산</b>(피해·처치 점수·도망 페널티·새 몬스터 소환)이 실행되고
              보드에 결과가 공개됩니다. 미제출 참가자는 이번 라운드에 아무 행동도 하지 않은 것으로 처리됩니다.
            </p>
          </>
        )}
        {isFirstStart && (
          <>
            <p className="text-zinc-300">
              튜토리얼을 시작합니다. 지금 입장한 <b>{playerCount}명</b> 기준으로 몬스터 구성과 대기열이 정해지고, 카드 1·2·3·4가 전원에게
              지급됩니다. 시작 뒤에는 새 참가자가 들어올 수 없습니다.
            </p>
            {headcount.warn && (
              <p className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-amber-200" data-testid="headcount-warning">
                {headcount.warn}
              </p>
            )}
          </>
        )}
        {step?.kind === "round" && step.nextRound === 4 && (
          <p className="text-zinc-300">본게임을 시작합니다. 카드·점수가 초기화되고 몬스터 풀이 다시 채워집니다. 보드에 새 대기열이 공개됩니다.</p>
        )}
        {step?.kind === "stage" && step.stage === "action" && (
          <p className="text-zinc-300">참가자 휴대폰에 행동 탭이 열리고 타이머가 시작됩니다.</p>
        )}
        {step?.kind === "stage" && step.stage === "score" && (
          <p className="text-zinc-300">보드에 점수를 꼴찌부터 공개합니다.</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "rewind" && !!rewindPlan}
        title={`되돌리기: ${getDefenseRoundLabel(currentRound)} → ${getDefenseRoundLabel(rewindPlan?.to ?? 0)}`}
        confirmLabel="되돌리기"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          await onRewind(currentRound);
        }}
      >
        {rewindPlan?.kind === "settlement" ? (
          <p className="text-zinc-300">
            <b>{getDefenseRoundLabel(rewindPlan.to)}의 전투 정산을 취소</b>합니다 — 몬스터 HP·잔여 시간·처치/도망 상태, 처치 점수, 도망 페널티 카드가
            정산 직전으로 돌아가고 그 라운드에 소환된 새 몬스터는 회수됩니다. 참가자의 행동 제출 기록은 유지됩니다.
          </p>
        ) : (
          <p className="text-zinc-300">시작 전환을 취소합니다 — 소환된 몬스터를 회수하고 초기화된 카드·점수를 되돌립니다.</p>
        )}
        {pending?.applicable && pending.submitted > 0 && (
          <p className="rounded border border-red-500/50 bg-red-500/10 px-2 py-1.5 text-red-200">
            이번 라운드에 이미 {pending.submitted}명이 제출해 서버가 거부합니다(409).
          </p>
        )}
        <p className="text-xs text-zinc-500">되돌린 내용은 GM 조작 기록에 남습니다.</p>
      </ConfirmDialog>
    </section>
  );
}
