"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// GM 확인창(자체 모달) — Iteration 5 WS-A 2 (증권가 components/gm/ui.tsx Popup/ConfirmButton 참고).
//  - 포커스 가둠(Tab 순환) · Esc/배경 클릭으로 닫기 · 열린 직후 400ms 잠금(연타·Enter 길게 누름 방지)
//  - 열릴 때만 내부 컴포넌트를 마운트해 잠금 상태가 매번 새로 시작된다(effect 안 setState 없음).
export const CONFIRM_LOCK_MS = 400;

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 빨간 확인 버튼(강퇴·방 종료·되돌리기) */
  danger?: boolean;
  /** 요청 진행 중 — 확인 버튼 비활성 */
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  testId?: string;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <ConfirmDialogInner {...props} />;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ConfirmDialogInner({
  title,
  children,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
  testId = "confirm-dialog",
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const t = setTimeout(() => setUnlocked(true), CONFIRM_LOCK_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid={`${testId}-backdrop`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        data-testid={testId}
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-sm text-zinc-100 shadow-2xl"
      >
        <h3 id={`${testId}-title`} className="text-base font-bold text-amber-300">
          {title}
        </h3>
        {children && <div className="mt-3 space-y-2 leading-relaxed text-zinc-200">{children}</div>}
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            data-testid="confirm-cancel"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2 font-semibold text-zinc-100 hover:bg-zinc-700"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-ok"
            disabled={!unlocked || busy}
            className={`flex-1 rounded-lg py-2 font-bold disabled:opacity-50 ${
              danger
                ? "bg-red-700 text-red-50 hover:bg-red-600"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
            }`}
            onClick={() => {
              if (!unlocked || busy) return;
              void onConfirm();
            }}
          >
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 확인창 본문용: 미제출 명단 한 줄 */
export function PendingLine({
  pending,
}: {
  pending: { applicable: boolean; total: number; pending: { id: string; nickname: string }[] } | null | undefined;
}) {
  if (!pending || !pending.applicable) return null;
  if (pending.pending.length === 0) {
    return <p className="text-emerald-300">모든 참가자({pending.total}명)가 제출했습니다.</p>;
  }
  return (
    <p className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-amber-200" data-testid="pending-warning">
      <b>미제출 {pending.pending.length}명</b>
      {pending.total > 0 ? ` / ${pending.total}명` : ""}: {pending.pending.map((p) => p.nickname).join(", ")}
    </p>
  );
}
