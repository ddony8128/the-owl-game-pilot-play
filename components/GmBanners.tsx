"use client";

// GM 조작 실패/성공 배너 — Iteration 5 WS-A 1. 실패는 빨간 배너(닫기 버튼), 성공은 작은 초록 문구(자동 소멸).
export function GmErrorBanner({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      data-testid="gm-error"
      className="flex items-start justify-between gap-3 rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200"
    >
      <span>{message}</span>
      <button type="button" className="shrink-0 text-xs text-zinc-400 hover:text-zinc-100" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}

export function GmNoticeBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      data-testid="gm-notice"
      className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-200"
    >
      {message}
    </div>
  );
}
