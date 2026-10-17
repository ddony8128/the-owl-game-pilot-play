"use client";

/**
 * 폴링이 실패했지만 마지막 화면은 남아 있을 때 띄우는 작은 배지(수산시장 ConnectionBanner · 증권가 StaleBadge와 같은 역할).
 * 폴링이 계속 재시도하므로 재시도 버튼은 없다. failures ≥ 1이면 보이고, 4회 이상이면 문구를 키운다.
 */
export function ConnectionBadge({ failures, className = "" }: { failures: number; className?: string }) {
  if (failures <= 0) return null;
  const strong = failures >= 4;
  return (
    <div
      data-testid="connection-badge"
      role="status"
      aria-live="polite"
      className={`rounded-lg border px-3 py-1.5 text-center text-xs font-bold ${
        strong ? "border-red-500/60 bg-red-500/15 text-red-200" : "border-amber-500/50 bg-amber-500/10 text-amber-200"
      } ${className}`}
    >
      {strong ? "서버와 연결이 끊겼습니다 — 다시 연결하는 중…" : "다시 연결하는 중…"}
    </div>
  );
}
