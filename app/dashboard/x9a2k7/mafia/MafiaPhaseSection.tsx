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

  return (
    <section className="space-y-2 text-sm" data-testid="mafia-phase-section">
      <h2 className="text-base font-semibold">라운드 / 페이즈</h2>
      <p className="text-sm text-zinc-400">
        현재 라운드: <b className="text-zinc-100">{phase ? roundLabel(currentRound) : "-"}</b> / 페이즈:{" "}
        <b className="text-zinc-100">{getMafiaPhaseLabel(currentPhase)}</b>
        {pending?.applicable && (
          <span className="ml-2 text-xs" data-testid="pending-count">
            · 제출 {pending.submitted}/{pending.total}
            {pending.pending.length > 0 && <span className="text-amber-300"> · 미제출 {pending.pending.length}명</span>}
          </span>
        )}
      </p>
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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-sm text-zinc-400">라운드 선택:</span>
        {[0, 1, 2, 3, 4, 5].map((round) => {
          const blocked = startBlocked && round >= 1;
          return (
            <button
              key={round}
              data-testid={`round-select-${round}`}
              className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900"
              disabled={!canChangeRound || currentRound === round || disabled || busy || blocked}
              title={blocked ? headcount.block : undefined}
              onClick={() => setDialog({ kind: "round", round })}
            >
              {roundLabel(round)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {ORDERED_PHASES.map((ph) => (
          <button
            key={ph}
            data-testid={ph === nextPhase ? "advance-phase" : undefined}
            className={`rounded-full px-3 py-1 disabled:opacity-40 ${
              ph === nextPhase
                ? "bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
                : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:hover:bg-zinc-900"
            }`}
            disabled={ph !== nextPhase || disabled || busy}
            onClick={() => setDialog({ kind: "phase", to: ph })}
          >
            페이즈 전환: {getMafiaPhaseLabel(ph)}
          </button>
        ))}
        <button
          type="button"
          data-testid="rewind-phase"
          className="rounded-full border border-red-700/60 bg-zinc-900 px-3 py-1 text-red-200 hover:bg-red-950 disabled:opacity-40"
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
