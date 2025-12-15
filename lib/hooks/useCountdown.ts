"use client";

import { useEffect, useState } from "react";

export function useCountdown(targetIso: string | null, intervalMs = 1000) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!targetIso) {
      const timeoutId = setTimeout(() => setRemainingMs(null), 0);
      return () => clearTimeout(timeoutId);
    }

    const target = new Date(targetIso).getTime();
    if (Number.isNaN(target)) {
      const timeoutId = setTimeout(() => setRemainingMs(null), 0);
      return () => clearTimeout(timeoutId);
    }

    const update = () => {
      const now = Date.now();
      const diff = target - now;
      setRemainingMs(diff > 0 ? diff : 0);
    };

    const immediateId = setTimeout(update, 0);
    const intervalId = setInterval(update, intervalMs);
    return () => {
      clearTimeout(immediateId);
      clearInterval(intervalId);
    };
  }, [targetIso, intervalMs]);

  const totalSeconds =
    remainingMs != null ? Math.floor(remainingMs / 1000) : null;
  const seconds = totalSeconds != null ? totalSeconds % 60 : null;
  const minutes =
    totalSeconds != null ? Math.floor(totalSeconds / 60) % 60 : null;
  const hours = totalSeconds != null ? Math.floor(totalSeconds / 3600) : null;

  return { remainingMs, totalSeconds, hours, minutes, seconds } as const;
}
