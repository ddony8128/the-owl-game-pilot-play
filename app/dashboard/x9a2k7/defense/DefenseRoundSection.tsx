"use client";

import { useState } from "react";
import { ConfirmDialog, PendingLine } from "@/components/ConfirmDialog";
import { getDefenseRoundLabel } from "@/lib/admin/defenseLabels";
import { checkDefenseAdvance } from "@/lib/admin/headcount";
import { planDefenseRewind } from "@/lib/admin/rewindRules";
import type { PendingInfo } from "./useDefenseAdminState";

type Props = {
  round: number | null;
  playerCount: number;
  pending: PendingInfo | null;
  disabled?: boolean;
  busy?: boolean;
  /** (다음 라운드, 화면이 보고 있던 라운드) */
  onAdvanceRound: (nextRound: number, from: number) => Promise<void>;
  onRewind: (from: number) => Promise<void>;
};

// 라운드 관리 — 「다음 라운드」는 확인창(미제출 N명·인원 경고·정산 안내)을 거치고, 화면이 본 라운드(from)를 함께 보낸다.
export function DefenseRoundSection({
  round,
  playerCount,
  pending,
  disabled = false,
  busy = false,
  onAdvanceRound,
  onRewind,
}: Props) {
  const currentRound = typeof round === "number" ? round : 0;
  const nextRound = currentRound < 16 ? currentRound + 1 : null;
  const [dialog, setDialog] = useState<"advance" | "rewind" | null>(null);

  const rewindPlan = planDefenseRewind(currentRound);
  const headcount = checkDefenseAdvance(playerCount);
  const isSettlement = nextRound != null && !((currentRound === 0 && nextRound === 1) || (currentRound === 3 && nextRound === 4));

  return (
    <section className="space-y-3 text-base" data-testid="defense-round-section">
      <h2 className="text-lg font-semibold">라운드 관리</h2>
      <p className="text-sm text-zinc-400">
        현재 라운드: <b className="text-zinc-100">{getDefenseRoundLabel(currentRound)}</b> (DB round {currentRound})
        {pending?.applicable && (
          <span className="ml-2 text-xs" data-testid="pending-count">
            · 제출 {pending.submitted}/{pending.total}
            {pending.pending.length > 0 && (
              <span className="text-amber-300"> · 미제출 {pending.pending.length}명</span>
            )}
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-sm text-zinc-400">다음 라운드 선택:</span>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((r) => {
          const isNext = nextRound === r;
          return (
            <button
              key={r}
              type="button"
              data-testid={isNext ? "advance-round" : undefined}
              className={`rounded-full px-3 py-1 disabled:opacity-40 ${
                isNext
                  ? "bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
                  : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:hover:bg-zinc-900"
              }`}
              disabled={!isNext || disabled || busy}
              onClick={() => {
                if (!isNext) return;
                setDialog("advance");
              }}
            >
              {getDefenseRoundLabel(r)}
            </button>
          );
        })}
        <button
          type="button"
          data-testid="rewind-round"
          className="ml-2 rounded-full border border-red-700/60 bg-zinc-900 px-3 py-1 text-red-200 hover:bg-red-950 disabled:opacity-40"
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
      {nextRound == null && (
        <p className="text-sm text-zinc-500">
          마지막 라운드(12라운드)까지 진행되었습니다.
        </p>
      )}

      <ConfirmDialog
        open={dialog === "advance" && nextRound != null}
        title={`${getDefenseRoundLabel(currentRound)} → ${getDefenseRoundLabel(nextRound ?? 0)}`}
        confirmLabel="다음 라운드로"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          if (nextRound != null) await onAdvanceRound(nextRound, currentRound);
        }}
      >
        <PendingLine pending={pending} />
        {isSettlement && (
          <p className="text-zinc-300">
            지금 넘기면 <b>{getDefenseRoundLabel(currentRound)}의 전투 정산</b>(피해·처치 점수·도망 페널티·새 몬스터 소환)이 실행됩니다.
            미제출 참가자는 이번 라운드에 아무 행동도 하지 않은 것으로 처리됩니다.
          </p>
        )}
        {!isSettlement && (
          <p className="text-zinc-300">
            {currentRound === 0 ? "튜토리얼을 시작합니다. 카드 1·2·3·4가 전원에게 지급되고 몬스터 대기열이 채워집니다." : "본게임을 시작합니다. 카드·점수가 초기화되고 저장된 몬스터 비율로 풀이 채워집니다."}
          </p>
        )}
        {headcount.warn && (
          <p className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-amber-200" data-testid="headcount-warning">
            {headcount.warn}
          </p>
        )}
        <p className="text-xs text-zinc-500">되돌리기는 다음 라운드 제출이 0건일 때만 가능합니다.</p>
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
