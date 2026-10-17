"use client";

import { useEffect, useRef, useState } from "react";

/** 종목·몬스터 순차 공개 간격(증권가 RevealSequence 와 같은 1.4초) */
export const REVEAL_STEP_MS = 1400;
/** 첫 항목이 나오기 전 잠깐의 뜸 */
export const REVEAL_DELAY_MS = 600;

/**
 * total 개를 stepMs 간격으로 하나씩 공개한다. 반환 shown 은 0..total.
 * - 타이머는 **마운트 때 한 번** 건다(증권가 교훈: 폴링 리렌더마다 타이머를 다시 걸면 0에서 멈춘다).
 *   호출하는 컴포넌트를 `key` 로 리마운트해서 새 연출을 시작한다.
 * - onDone 은 마지막 항목이 나온 뒤 한 번 불린다(ref 로 최신 콜백 유지).
 */
export function useRevealSteps(
  total: number,
  onDone?: () => void,
  stepMs: number = REVEAL_STEP_MS,
  delayMs: number = REVEAL_DELAY_MS,
): { shown: number; done: boolean } {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (total <= 0) {
      const t = window.setTimeout(() => doneRef.current?.(), delayMs);
      return () => window.clearTimeout(t);
    }
    let step = 0;
    let interval: number | null = null;
    const start = window.setTimeout(() => {
      const tick = () => {
        step += 1;
        setShown(step);
        if (step >= total) {
          if (interval != null) window.clearInterval(interval);
          doneRef.current?.();
        }
      };
      tick();
      if (step < total) interval = window.setInterval(tick, stepMs);
    }, delayMs);
    return () => {
      window.clearTimeout(start);
      if (interval != null) window.clearInterval(interval);
    };
  }, [total, stepMs, delayMs]);

  return { shown: Math.min(shown, total), done: shown >= total };
}
