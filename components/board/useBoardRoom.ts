"use client";

import { useSyncExternalStore } from "react";

/**
 * 보드 화면 공통 훅 — 하이드레이션 안전(반면교사 1-13).
 * URL(?room=)·창 크기·마운트 여부는 서버가 모르므로 useSyncExternalStore 의 서버 스냅샷으로 "모름"을 돌려주고,
 * 클라이언트에서 실제 값으로 다시 그린다. effect 안 setState 를 쓰지 않는다.
 */

const noopSubscribe = () => () => {};

/** 마운트 뒤에만 true. 서버/하이드레이션 중에는 false. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** ?room= (대문자·공백 제거). 서버에서는 null. */
export function useRoomParam(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const v = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "";
      return v || null;
    },
    () => null,
  );
}

function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

/** 창 높이(px). 서버에서는 0. QR 크기처럼 vh 로 못 쓰는 px 값을 뷰포트에 맞출 때 쓴다. */
export function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerHeight,
    () => 0,
  );
}

/** E2E 가속용 — 연출의 "머무는 시간"을 줄인다(공개 간격 1.4초는 바꾸지 않는다). */
export function boardHoldMs(defaultMs: number): number {
  if (typeof window === "undefined") return defaultMs;
  const scale = (window as unknown as { __OWL_BOARD_HOLD_SCALE__?: number }).__OWL_BOARD_HOLD_SCALE__;
  return typeof scale === "number" && scale > 0 ? Math.round(defaultMs * scale) : defaultMs;
}
