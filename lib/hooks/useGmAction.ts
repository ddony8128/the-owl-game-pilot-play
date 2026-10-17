"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeGmFailure } from "@/lib/admin/gmFailure";
import { newRequestId } from "@/lib/requestId";

// GM 조작 공통(증권가 app/gm/[slug]/page.tsx act() 방식) — Iteration 5 WS-A 1.
//  - 요청 1건이 끝날 때까지 모든 조작을 잠근다(연타 방지).
//  - 12초 제한: 응답 없는 요청 하나가 대시보드 전체를 잠그지 않게.
//  - 실패는 { status, reason, error } 를 사람이 읽는 문구로 바꿔 배너에 띄운다. 409 는 사유를 구분한다.
//  - 409(이미 넘어감 등)도 성공처럼 즉시 상태를 다시 불러와 화면을 서버와 맞춘다.
export const GM_REQUEST_TIMEOUT_MS = 12_000;

export type GmResult<T = unknown> =
  | { ok: true; status: number; json: T }
  | { ok: false; status: number | null; error: string | null; reason: string | null; json: unknown; message: string };

export async function gmRequest<T = unknown>(
  url: string,
  init?: { method?: string; body?: unknown },
  timeoutMs = GM_REQUEST_TIMEOUT_MS,
): Promise<GmResult<T>> {
  // 변경 요청(POST/PATCH)에는 재전송 멱등 키를 자동으로 붙인다 — 점수/현금 ±1 같은 "두 번 적용되면 안 되는" API 가 거른다.
  const method = init?.method ?? "POST";
  const body =
    init?.body !== undefined && init.body !== null && typeof init.body === "object" && !Array.isArray(init.body) && method !== "GET"
      ? { request_id: newRequestId(), ...(init.body as Record<string, unknown>) }
      : init?.body;
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const j = (json ?? {}) as { error?: unknown; reason?: unknown };
      const error = typeof j.error === "string" ? j.error : null;
      const reason = typeof j.reason === "string" ? j.reason : null;
      return { ok: false, status: res.status, error, reason, json, message: describeGmFailure({ status: res.status, error, reason }) };
    }
    return { ok: true, status: res.status, json: json as T };
  } catch {
    return { ok: false, status: null, error: null, reason: null, json: null, message: describeGmFailure({ status: null }) };
  }
}

export type GmActionApi = {
  busy: boolean;
  error: string | null;
  notice: string | null;
  run: <T = unknown>(
    url: string,
    init?: { method?: string; body?: unknown },
    opts?: { notice?: string | ((json: T) => string | null) },
  ) => Promise<GmResult<T> | null>;
  clearError: () => void;
  setError: (message: string | null) => void;
};

export function useGmAction(afterChange?: () => void | Promise<void>): GmActionApi {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busyRef = useRef(false);

  // 성공 토스트는 최소: 4초 뒤 자동으로 사라진다.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const run = useCallback(
    async <T = unknown,>(
      url: string,
      init?: { method?: string; body?: unknown },
      opts?: { notice?: string | ((json: T) => string | null) },
    ): Promise<GmResult<T> | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await gmRequest<T>(url, init);
        if (!result.ok) {
          setError(result.message);
          // 다른 창에서 먼저 넘어간 경우 등은 서버 상태를 즉시 다시 불러와 화면을 맞춘다.
          if (result.status === 409 || result.status === 404) await afterChange?.();
          return result;
        }
        if (opts?.notice) {
          const text = typeof opts.notice === "function" ? opts.notice(result.json) : opts.notice;
          if (text) setNotice(text);
        }
        await afterChange?.();
        return result;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [afterChange],
  );

  return { busy, error, notice, run, clearError: () => setError(null), setError };
}
