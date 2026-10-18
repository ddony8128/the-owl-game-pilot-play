"use client";

import { useState } from "react";
import type { MafiaPhase, MafiaPhaseState } from "@/lib/types";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { ConfirmDialog, PendingLine } from "@/components/ConfirmDialog";
import { checkMafiaStart } from "@/lib/admin/headcount";
import { MAFIA_REWIND_TARGET } from "@/lib/admin/rewindRules";
import type { PendingInfo } from "../defense/useDefenseAdminState";

type Props = {
  phase: MafiaPhaseState | null;
  playerCount: number;
  pending: PendingInfo | null;
  disabled?: boolean;
  busy?: boolean;
  onChangePhase: (to: MafiaPhase, from: MafiaPhase) => Promise<void>;
  onChangeRound: (round: number, from: number) => Promise<void>;
  onRewind: (from: MafiaPhase) => Promise<void>;
};

const ORDERED_PHASES: MafiaPhase[] = [
  "prepare",
  "auction",
  "trade",
  "apply",
  "vote",
  "end",
];

/** 전환 버튼에 쓰는 동사형 이름(GM 안내와 일치) */
export const MAFIA_TRANSITION_LABEL: Partial<Record<MafiaPhase, string>> = {
  auction: "경매 시작",
  trade: "경매 마감 → 주식 거래",
  apply: "거래 마감 → 주가 변동",
  vote: "투표 시작",
  end: "투표 마감 → 라운드 종료",
};

function getNextPhase(
  current: MafiaPhase | null | undefined
): MafiaPhase | null {
  if (!current) return "prepare";
  const idx = ORDERED_PHASES.indexOf(current);
  if (idx === -1 || idx === ORDERED_PHASES.length - 1) return null;
  return ORDERED_PHASES[idx + 1] ?? null;
}

const roundLabel = (r: number) => (r === 0 ? "튜토리얼" : `${r}라운드`);

// 라운드/페이즈 — 전환·라운드 변경·되돌리기는 모두 확인창을 거치고, 화면이 본 단계(from)를 함께 보낸다.
// 큰 단계 이름·단계 띠·큰 호박색 전환 버튼 구성은 bluecode674 포크의 대시보드를 따른다.
export function MafiaPhaseSection({
  phase,
  playerCount,
  pending,
  disabled = false,
  busy = false,
  onChangePhase,
  onChangeRound,
  onRewind,
}: Props) {
  const currentPhase = phase?.phase ?? null;
  const currentRound = typeof phase?.round_number === "number" ? phase.round_number : 0;
  const nextPhase = getNextPhase(currentPhase);
  const canChangeRound = currentPhase === "end";
  const [dialog, setDialog] = useState<
    | { kind: "phase"; to: MafiaPhase }
    | { kind: "round"; round: number }
    | { kind: "rewind" }
    | null
  >(null);

  const headcount = checkMafiaStart(playerCount);
  // 튜토리얼(0) → 본게임 시작은 5명 미만이면 서버가 409 로 막는다. 화면도 버튼을 막고 사유를 보여 준다.
  const startBlocked = currentRound === 0 && !headcount.ok;
  const rewindTo = currentPhase ? MAFIA_REWIND_TARGET[currentPhase] : undefined;
  const currentIndex = currentPhase ? ORDERED_PHASES.indexOf(currentPhase) : -1;

  return (
    <section className="flex h-full flex-col gap-5 text-sm" data-testid="mafia-phase-section">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">라운드 / 페이즈</h2>
          {pending?.applicable && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300" data-testid="pending-count">
              제출 {pending.submitted}/{pending.total}
              {pending.pending.length > 0 && <span className="text-amber-300"> · 미제출 {pending.pending.length}명</span>}
            </span>
          )}
        </div>
        <p className="mt-1 text-3xl font-black text-white">
          {phase ? roundLabel(currentRound) : "-"}
          <span className="mx-2 text-zinc-600">·</span>
          {getMafiaPhaseLabel(currentPhase)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          현재 라운드: {phase ? roundLabel(currentRound) : "-"} · 페이즈: {getMafiaPhaseLabel(currentPhase)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ORDERED_PHASES.map((ph, phaseIndex) => (
          <span
            key={ph}
            className={`flex min-h-11 items-center justify-center rounded-xl px-2 py-2 text-center text-xs ${
              ph === currentPhase
                ? "bg-amber-400 font-black text-zinc-950 shadow-lg shadow-amber-950/40"
                : phaseIndex < currentIndex
                  ? "bg-emerald-500/15 font-bold text-emerald-300"
                  : "bg-zinc-800/80 text-zinc-500"
            }`}
          >
            {phaseIndex < currentIndex ? "✓ " : ""}
            {getMafiaPhaseLabel(ph)}
          </span>
        ))}
      </div>

      <div className="mt-auto space-y-3">
        {nextPhase ? (
          <button
            type="button"
            data-testid="advance-phase"
            className="min-h-16 w-full rounded-2xl bg-amber-400 px-5 text-lg font-black text-zinc-950 shadow-xl shadow-amber-950/40 transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            disabled={disabled || busy}
            onClick={() => setDialog({ kind: "phase", to: nextPhase })}
          >
            {MAFIA_TRANSITION_LABEL[nextPhase] ?? `페이즈 전환: ${getMafiaPhaseLabel(nextPhase)}`} ▶
          </button>
        ) : (
          <p className="rounded-xl bg-zinc-800 p-3 text-center text-zinc-400">
            {currentRound >= 5 ? "5라운드가 끝났습니다. 아래 [결과 공개]를 켜고 상단 [게임 종료]로 마무리하세요." : "라운드가 끝났습니다. 아래에서 다음 라운드를 시작하세요."}
          </p>
        )}

        <div className="space-y-1.5 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-500">
            참가자 {playerCount}명 · 권장 6~12명 · 5명 미만은 본게임 시작 불가
            {headcount.warn && !startBlocked && (
              <span className="ml-1 text-amber-300" data-testid="headcount-warning-inline">
                — {headcount.warn}
              </span>
            )}
          </p>
          {startBlocked && canChangeRound && (
            <p
              className="rounded border border-red-500/50 bg-red-500/10 px-2 py-1.5 text-xs text-red-200"
              data-testid="headcount-block"
            >
              {headcount.block}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">라운드 선택:</span>
            {[0, 1, 2, 3, 4, 5].map((round) => {
              const blocked = startBlocked && round >= 1;
              return (
                <button
                  key={round}
                  type="button"
                  data-testid={`round-select-${round}`}
                  className={`rounded-full px-3 py-1 text-xs disabled:opacity-40 disabled:hover:bg-zinc-900 ${
                    currentRound === round ? "bg-zinc-700 font-bold text-white" : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  }`}
                  disabled={!canChangeRound || currentRound === round || disabled || busy || blocked}
                  title={blocked ? headcount.block : !canChangeRound ? "라운드 종료 단계에서만 바꿀 수 있습니다" : undefined}
                  onClick={() => setDialog({ kind: "round", round })}
                >
                  {roundLabel(round)}
                </button>
              );
            })}
            <button
              type="button"
              data-testid="rewind-phase"
              className="ml-auto rounded-full border border-red-700/60 bg-zinc-900 px-3 py-1 text-xs text-red-200 hover:bg-red-950 disabled:opacity-40"
              disabled={!rewindTo || disabled || busy}
              title={
                rewindTo
                  ? `${getMafiaPhaseLabel(currentPhase)} → ${getMafiaPhaseLabel(rewindTo)} 로 되돌립니다(이 단계 제출 0건일 때만)`
                  : "이 단계는 되돌릴 수 없습니다(주가 변동·라운드 종료 뒤에는 정산을 되돌릴 수 없습니다)"
              }
              onClick={() => setDialog({ kind: "rewind" })}
            >
              ↩ 되돌리기
            </button>
          </div>
        </div>
      </div>

      {/* 페이즈 전환 확인 */}
      <ConfirmDialog
        open={dialog?.kind === "phase"}
        title={
          dialog?.kind === "phase"
            ? MAFIA_TRANSITION_LABEL[dialog.to] ?? `페이즈 전환: ${getMafiaPhaseLabel(dialog.to)}`
            : ""
        }
        confirmLabel="전환"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "phase" || !currentPhase) return;
          const to = dialog.to;
          setDialog(null);
          await onChangePhase(to, currentPhase);
        }}
      >
        <p className="text-zinc-300">
          {roundLabel(currentRound)} · {getMafiaPhaseLabel(currentPhase)} → {dialog?.kind === "phase" ? getMafiaPhaseLabel(dialog.to) : ""}
        </p>
        <PendingLine pending={pending} />
        {dialog?.kind === "phase" && dialog.to === "trade" && (
          <p className="text-zinc-300">경매를 마감하면 낙찰자가 정해지고 베팅액이 차감됩니다. 미제출자는 월급쟁이가 됩니다.</p>
        )}
        {dialog?.kind === "phase" && dialog.to === "apply" && (
          <p className="text-zinc-300">거래를 마감하면 주가 변동·능력·강도 정산이 실행됩니다(이 뒤로는 되돌릴 수 없습니다).</p>
        )}
        {dialog?.kind === "phase" && dialog.to === "end" && (
          <p className="text-zinc-300">투표를 마감하면 경제사범 처리(벌금·국채)가 실행됩니다(이 뒤로는 되돌릴 수 없습니다).</p>
        )}
      </ConfirmDialog>

      {/* 라운드 변경 확인 */}
      <ConfirmDialog
        open={dialog?.kind === "round"}
        title={dialog?.kind === "round" ? `${roundLabel(dialog.round)} 시작` : ""}
        confirmLabel="라운드 시작"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "round") return;
          const r = dialog.round;
          setDialog(null);
          await onChangeRound(r, currentRound);
        }}
      >
        <p className="text-zinc-300">
          {roundLabel(currentRound)} 종료 → {dialog?.kind === "round" ? roundLabel(dialog.round) : ""} 준비 단계로 넘어갑니다. 전원의 직업이
          초기화됩니다(자산은 유지).
        </p>
        {currentRound === 0 && dialog?.kind === "round" && dialog.round >= 1 && (
          <p className="text-zinc-300">본게임 1라운드 경매 시작 시 전원 현금 30원·주식 0주·주가 5원으로 다시 세팅됩니다.</p>
        )}
        {headcount.warn && (
          <p className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-amber-200" data-testid="headcount-warning">
            {headcount.warn}
          </p>
        )}
      </ConfirmDialog>

      {/* 되돌리기 확인 */}
      <ConfirmDialog
        open={dialog?.kind === "rewind" && !!rewindTo}
        title={`되돌리기: ${getMafiaPhaseLabel(currentPhase)} → ${getMafiaPhaseLabel(rewindTo ?? null)}`}
        confirmLabel="되돌리기"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (!currentPhase) return;
          setDialog(null);
          await onRewind(currentPhase);
        }}
      >
        {currentPhase === "trade" && (
          <p className="text-zinc-300">경매 마감을 취소합니다 — 직업 배정과 낙찰액 지불이 경매 종료 시점으로 돌아갑니다. 입찰 기록은 유지됩니다.</p>
        )}
        {currentPhase === "auction" && (
          <p className="text-zinc-300">경매 시작을 취소하고 라운드 준비로 돌아갑니다.</p>
        )}
        {currentPhase === "vote" && <p className="text-zinc-300">투표 시작을 취소하고 주가 변동 단계로 돌아갑니다.</p>}
        {pending?.applicable && pending.submitted > 0 && (
          <p className="rounded border border-red-500/50 bg-red-500/10 px-2 py-1.5 text-red-200">
            이 단계에 이미 {pending.submitted}명이 제출해 서버가 거부합니다(409).
          </p>
        )}
        <p className="text-xs text-zinc-500">되돌린 내용은 GM 조작 기록에 남습니다.</p>
      </ConfirmDialog>
    </section>
  );
}
