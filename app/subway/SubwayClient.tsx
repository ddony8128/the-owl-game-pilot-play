"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubwayPlayerStateClient } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SubwayHeader } from "./SubwayHeader";
import { SubwayLocationSection } from "./SubwayLocationSection";
import { SubwayControlsSection } from "./SubwayControlsSection";
import { SubwayGuideModal } from "./SubwayGuideModal";
import { SubwayFooter } from "./SubwayFooter";

export default function SubwayClient() {
  return (
    <PageGuard requireLogin allowGames={["subway"]}>
      <SubwayInner />
    </PageGuard>
  );
}

function SubwayInner() {
  const router = useRouter();
  const { nickname } = usePlayerAuth();

  const [subwayPlayer, setSubwayPlayer] =
    useState<SubwayPlayerStateClient | null>(null);
  const [displayLocation, setDisplayLocation] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasNewRule, setHasNewRule] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  const [timerState, setTimerState] = useState<{
    remainingSeconds: number;
    isRunning: boolean;
  } | null>(null);

  const computeRemaining = (
    timerStart: boolean,
    timerStartAt: string | null,
    totalSeconds: number,
    pauseAt: string | null,
    nowMs: number
  ) => {
    if (!pauseAt && !timerStart) {
      return { remainingSeconds: totalSeconds, isRunning: false } as const;
    }

    if (timerStart && timerStartAt) {
      const startMs = new Date(timerStartAt).getTime();
      if (Number.isNaN(startMs)) {
        return {
          remainingSeconds: totalSeconds,
          isRunning: false,
        } as const;
      }
      const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      const remaining = Math.max(0, totalSeconds - elapsed);
      return {
        remainingSeconds: remaining,
        isRunning: remaining > 0,
      } as const;
    }

    if (!timerStart && timerStartAt && pauseAt) {
      const startMs = new Date(timerStartAt).getTime();
      const pauseMs = new Date(pauseAt).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(pauseMs)) {
        return {
          remainingSeconds: totalSeconds,
          isRunning: false,
        } as const;
      }
      const elapsed = Math.max(0, Math.floor((pauseMs - startMs) / 1000));
      const remaining = Math.max(0, totalSeconds - elapsed);
      return { remainingSeconds: remaining, isRunning: false } as const;
    }

    return { remainingSeconds: totalSeconds, isRunning: false } as const;
  };

  useEffect(() => {
    if (subwayPlayer?.currentLocation && !moving) {
      setDisplayLocation(subwayPlayer.currentLocation);
    }
  }, [subwayPlayer?.currentLocation, moving]);

  useEffect(() => {
    if (!nickname) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/subway/state?nickname=${encodeURIComponent(nickname)}`
        );
        const json = (await res.json().catch(() => null)) as
          | { state: SubwayPlayerStateClient | null; error?: string }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          const message =
            json && "error" in json && typeof json.error === "string"
              ? json.error
              : "플레이어 상태를 불러오지 못했습니다.";
          throw new Error(message);
        }

        if (cancelled) return;

        const rawState = json.state ?? null;
        if (rawState?.isFinished) {
          router.replace("/subway/end");
          return;
        }

        const serverRules = json.state?.rules ?? [];
        const othersAtSameLocation = json.state?.othersAtSameLocation ?? [];

        setSubwayPlayer((prev) => {
          const prevRules = prev?.rules ?? [];
          const prevRuleIds = new Set(prevRules.map((r) => r.id));

          let triggered = false;
          for (const r of serverRules) {
            if (!prevRuleIds.has(r.id) && r.id !== 0 && r.id !== 8) {
              triggered = true;
              break;
            }
          }
          if (triggered) {
            setHasNewRule(true);
          }

          if (!rawState) return null;

          const base: SubwayPlayerStateClient = rawState;

          if (
            prev?.timerStart !== base.timerStart ||
            prev?.timerStartAt !== base.timerStartAt ||
            prev?.pauseAt !== base.pauseAt ||
            prev?.totalSeconds !== base.totalSeconds
          ) {
            const now = Date.now();
            const { remainingSeconds, isRunning } = computeRemaining(
              base.timerStart,
              base.timerStartAt,
              base.totalSeconds,
              base.pauseAt,
              now
            );

            if (remainingSeconds <= 0) {
              router.replace("/subway/end");
            } else {
              setTimerState((current) => {
                if (
                  current &&
                  current.remainingSeconds === remainingSeconds &&
                  current.isRunning === isRunning
                ) {
                  return current;
                }
                return { remainingSeconds, isRunning };
              });
            }
          }

          return {
            ...base,
            rules: serverRules,
            othersAtSameLocation,
          };
        });

        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "플레이어 상태를 불러오지 못했습니다.";
          setError(message);
        }
      }
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, 2000);

    const tickId = setInterval(() => {
      setTimerState((prev) => {
        if (!prev) return prev;
        if (!prev.isRunning || prev.remainingSeconds <= 0) return prev;
        const next = prev.remainingSeconds - 1;
        if (next <= 0) {
          router.replace("/subway/end");
          return { ...prev, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: next };
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(tickId);
    };
  }, [nickname, router]);

  // 포커스/가시성 변경 시 서버 기준 시간으로 타이머 재계산
  useEffect(() => {
    if (!subwayPlayer) return;

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined") {
        if (document.visibilityState !== "visible") return;
      }

      const { timerStart, timerStartAt, totalSeconds, pauseAt } = subwayPlayer;

      const now = Date.now();

      let remainingSeconds = totalSeconds;
      let isRunning = false;

      if (!pauseAt && !timerStart) {
        remainingSeconds = totalSeconds;
        isRunning = false;
      } else if (timerStart && timerStartAt) {
        const startMs = new Date(timerStartAt).getTime();
        if (!Number.isNaN(startMs)) {
          const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
          remainingSeconds = Math.max(0, totalSeconds - elapsed);
          isRunning = remainingSeconds > 0;
        }
      } else if (!timerStart && timerStartAt && pauseAt) {
        const startMs = new Date(timerStartAt).getTime();
        const pauseMs = new Date(pauseAt).getTime();
        if (!Number.isNaN(startMs) && !Number.isNaN(pauseMs)) {
          const elapsed = Math.max(0, Math.floor((pauseMs - startMs) / 1000));
          remainingSeconds = Math.max(0, totalSeconds - elapsed);
          isRunning = false;
        }
      }

      if (remainingSeconds <= 0) {
        router.replace("/subway/end");
        return;
      }

      setTimerState((prev) => {
        if (
          prev &&
          prev.remainingSeconds === remainingSeconds &&
          prev.isRunning === isRunning
        ) {
          return prev;
        }
        return { remainingSeconds, isRunning };
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleVisibilityOrFocus);
      document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleVisibilityOrFocus);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityOrFocus
        );
      }
    };
  }, [subwayPlayer, router]);

  const handleMove = async (direction: "forward" | "back") => {
    if (!nickname) return;
    if (!timerState?.isRunning) return;
    setError(null);
    setMoving(true);
    setDisplayLocation(null);
    try {
      const res = await fetch("/api/subway/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname, direction }),
      });

      const json = (await res.json().catch(() => null)) as {
        state?: SubwayPlayerStateClient;
        reason?: string;
        error?: string;
      } | null;

      if (!res.ok || !json) {
        throw new Error(
          json?.error ?? "이동 중 오류가 발생했습니다. 새로고침해주세요."
        );
      }

      if (json.state?.isFinished) {
        router.replace("/subway/end");
        return;
      }

      if (json.state) {
        setSubwayPlayer((prev) => {
          const next = json.state!;
          const prevRules = prev?.rules ?? [];
          const prevRuleIds = new Set(prevRules.map((r) => r.id));
          const nextRules = next.rules ?? [];

          let triggered = false;
          for (const r of nextRules) {
            if (!prevRuleIds.has(r.id) && r.id !== 0 && r.id !== 8) {
              triggered = true;
              break;
            }
          }
          if (triggered) {
            setHasNewRule(true);
          }

          return next;
        });
        setTimeout(() => {
          setDisplayLocation(json.state!.currentLocation);
          setMoving(false);
        }, 1500);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "이동 중 오류가 발생했습니다. 새로고침해주세요.";
      setError(message);
    }
  };

  if (!nickname) return <LoadingScreen />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const exitNumber = subwayPlayer?.exitNumber ?? 0;
  const locationKey = displayLocation ?? null;

  const totalSeconds = timerState?.remainingSeconds ?? null;
  const minutes =
    totalSeconds != null ? Math.floor(totalSeconds / 60) % 60 : null;
  const seconds = totalSeconds != null ? totalSeconds % 60 : null;
  const timeLabel =
    minutes != null && seconds != null
      ? `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`
      : "--:--";

  const exitLabel = "현재 출구";
  const exitValue = `${exitNumber} 번`;
  const resetCount = subwayPlayer?.resetCount ?? 0;

  let imageSrc: string | null = null;
  if (locationKey) {
    imageSrc = `/subway-location/${locationKey}`;
  }

  const interactionDisabled = !timerState?.isRunning;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      {/* 상단 타이머 + 안내문 버튼 + 출구 번호 */}
      <SubwayHeader
        timeLabel={timeLabel}
        exitLabel={exitLabel}
        exitValue={exitValue}
        resetCount={resetCount}
        hasNewRule={hasNewRule}
        interactionDisabled={interactionDisabled}
        onOpenGuide={() => {
          setIsGuideOpen(true);
          setHasNewRule(false);
        }}
      />

      {/* 장소 이미지 영역 */}
      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-4">
        <SubwayLocationSection imageSrc={imageSrc} moving={moving} />

        <SubwayFooter others={subwayPlayer?.othersAtSameLocation ?? []} />

        {/* 하단 이동 버튼 */}
        <SubwayControlsSection
          interactionDisabled={interactionDisabled || moving}
          onMoveForward={() => handleMove("forward")}
          onMoveBack={() => handleMove("back")}
        />
      </main>

      {/* 안내문 모달 */}
      <SubwayGuideModal
        isOpen={isGuideOpen}
        rules={subwayPlayer?.rules ?? []}
        onClose={() => {
          setIsGuideOpen(false);
          setHasNewRule(false);
        }}
      />
    </div>
  );
}
