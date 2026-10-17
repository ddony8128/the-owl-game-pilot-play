"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    /** E2E 테스트용 폴링 간격 오버라이드 (ms) */
    __OWL_POLL__?: number;
  }
}

/**
 * fetch를 감싸 timeoutMs 후 강제로 실패(AbortError)시킨다. usePolling의 in-flight 가드는
 * 요청이 하나라도 매달리면 이후 모든 tick을 영구히 건너뛰므로(모바일 네트워크 전환, 화면 잠금 중
 * 소켓 유실 등) 반드시 유한 시간 안에 끝나야 한다. (수산시장 lib/hooks/usePolling.ts에서 옮김 — Iteration 5)
 */
export function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
}

export type PollingResult<T> = {
  /** 마지막으로 성공한 응답. 실패해도 지우지 않는다(403/404 제외) — 화면이 사라지지 않게. */
  data: T | null;
  /** 마지막 요청의 오류 문구(성공하면 null) */
  error: string | null;
  /** 마지막 HTTP 상태(네트워크 오류면 null) */
  status: number | null;
  /** 서버가 준 사유 코드(있으면) */
  reason: string | null;
  /** 연속 실패 횟수 — 1 이상이면 "다시 연결 중" 배지를 띄운다 */
  failures: number;
  reload: () => Promise<void>;
};

/**
 * url을 intervalMs마다 폴링한다. url이 null이면 대기.
 * - 요청은 최대 1개만 떠 있다(in-flight 가드) → 느린 옛 응답이 새 응답을 덮어쓰는 레이스 없음.
 * - 실패해도 마지막 data를 유지한다. 403/404(강퇴·방 없음)만 data를 비운다.
 * - 탭이 숨겨져 있으면(document.hidden) tick을 건너뛰고, 다시 보이면 즉시 한 번 읽는다.
 */
export function usePolling<T>(url: string | null, defaultIntervalMs = 4000): PollingResult<T> {
  const intervalMs =
    typeof window !== "undefined" && window.__OWL_POLL__ ? window.__OWL_POLL__ : defaultIntervalMs;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!url || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetchWithTimeout(url, 8000);
      const json = (await res.json().catch(() => null)) as (T & { error?: string; reason?: string }) | null;
      if (!res.ok) {
        setStatus(res.status);
        setError((json && typeof json.error === "string" && json.error) || `오류 (${res.status})`);
        setReason(json && typeof json.reason === "string" ? json.reason : null);
        setFailures((n) => n + 1);
        if (res.status === 403 || res.status === 404) setData(null);
        return;
      }
      setData(json as T);
      setError(null);
      setReason(null);
      setStatus(res.status);
      setFailures(0);
    } catch {
      setError("네트워크 오류");
      setReason(null);
      setStatus(null);
      setFailures((n) => n + 1);
    } finally {
      inFlightRef.current = false;
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, intervalMs, load]);

  return { data, error, status, reason, failures, reload: load };
}
