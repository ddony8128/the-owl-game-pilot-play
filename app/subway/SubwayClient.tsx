"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SubwayPlayerState } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SubwayHeader } from "./SubwayHeader";
import { SubwayLocationSection } from "./SubwayLocationSection";
import { SubwayControlsSection } from "./SubwayControlsSection";
import { SubwayGuideModal } from "./SubwayGuideModal";

export type SubwayRuleClient = {
  id: number;
  title: string;
  body: string;
  conditionDescription: string;
};

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

  const [subwayPlayer, setSubwayPlayer] = useState<SubwayPlayerState | null>(
    null
  );
  const [displayLocation, setDisplayLocation] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rules, setRules] = useState<SubwayRuleClient[]>([]);
  const [hasNewRule, setHasNewRule] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  const [animState, setAnimState] = useState<"normal" | "shock1" | "shock2">(
    "normal"
  );
  const [isScareActive, setIsScareActive] = useState(false);
  const [scareVariant, setScareVariant] = useState<1 | 2 | null>(null);
  const [scareStep, setScareStep] = useState<0 | 1 | 2>(0);

  const [timerState, setTimerState] = useState<{
    remainingSeconds: number;
    isRunning: boolean;
  } | null>(null);

  // 서버 타이머 폴링 + 로컬 1초 틱
  useEffect(() => {
    if (!nickname) return;

    let cancelled = false;

    const loadTimer = async () => {
      try {
        const res = await fetch("/api/gm/timers/subway");
        const json = (await res.json().catch(() => null)) as {
          remainingSeconds: number;
          isRunning: boolean;
        } | null;
        if (!res.ok || !json || cancelled) return;

        if (json.remainingSeconds <= 0) {
          router.replace("/subway/end");
          return;
        }

        setTimerState({
          remainingSeconds: json.remainingSeconds,
          isRunning: json.isRunning,
        });
      } catch {
        // 타이머 오류는 게임 진행을 막지 않음
      }
    };

    void loadTimer();
    const pollId = setInterval(() => {
      void loadTimer();
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
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [nickname, router]);

  useEffect(() => {
    if (subwayPlayer?.current_location && !moving) {
      setDisplayLocation(subwayPlayer.current_location);
    }
  }, [subwayPlayer?.current_location, moving]);

  const triggerShock = useCallback(() => {
    // 이미 연출 중이면 중복으로 켜지지 않게 무시
    if (isScareActive) return;

    const variant = Math.random() < 0.5 ? 1 : 2;
    setIsScareActive(true);
    setScareVariant(variant);
    setScareStep(1);
    setAnimState("shock1");

    setTimeout(() => {
      setScareStep(2);
      setAnimState("shock2");
    }, 1000);

    setTimeout(() => {
      setIsScareActive(false);
      setScareVariant(null);
      setScareStep(0);
      setAnimState("normal");
    }, 2000);
  }, [isScareActive]);

  // 플레이어 상태 + 규칙 + 놀래키기 플래그 폴링
  useEffect(() => {
    if (!nickname) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/subway/state?nickname=${encodeURIComponent(nickname)}`
        );
        const json = (await res.json().catch(() => null)) as
          | {
              state: SubwayPlayerState | null;
              rules?: SubwayRuleClient[];
              scare?: boolean;
              error?: string;
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "플레이어 상태를 불러오지 못했습니다."
          );
        }

        if (cancelled) return;

        const state = json.state ?? null;
        if (state?.is_finished) {
          router.replace("/subway/end");
          return;
        }
        setSubwayPlayer(state);

        const serverRules = json.rules ?? [];
        setRules((prev) => {
          const prevIds = new Set(prev.map((r) => r.id));
          let triggered = false;
          for (const r of serverRules) {
            if (!prevIds.has(r.id) && r.id !== 0 && r.id !== 8) {
              triggered = true;
            }
          }
          if (triggered) {
            setHasNewRule(true);
          }
          return serverRules;
        });

        if (json.scare) {
          triggerShock();
        }

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

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [nickname, router, triggerShock]);

  const handleMove = async (direction: "forward" | "back") => {
    if (!nickname) return;
    if (!timerState?.isRunning || isScareActive) return;
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
        state?: SubwayPlayerState;
        reason?: string;
        error?: string;
      } | null;

      if (!res.ok || !json) {
        throw new Error(
          json?.error ?? "이동 중 오류가 발생했습니다. 새로고침해주세요."
        );
      }

      if (json.state?.is_finished) {
        router.replace("/subway/end");
        return;
      }

      if (json.state) {
        setSubwayPlayer(json.state);
        setTimeout(() => {
          setDisplayLocation(json.state!.current_location);
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

  const exitNumber = subwayPlayer?.exit_number ?? 0;
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

  const exitLabel = isScareActive ? "엵칠 %#" : "현재 출구";
  const exitValue = isScareActive ? "666 번" : `${exitNumber} 번`;

  let imageSrc: string | null = null;
  if (isScareActive && scareVariant) {
    if (scareVariant === 1) {
      imageSrc =
        scareStep === 2
          ? "/jump-scare/scare-1-2.png"
          : "/jump-scare/scare-1-1.png";
    } else {
      imageSrc =
        scareStep === 2
          ? "/jump-scare/scare-2-2.png"
          : "/jump-scare/scare-2-1.png";
    }
  } else if (locationKey) {
    imageSrc = `/subway-location/${locationKey}`;
  }

  const interactionDisabled = isScareActive || !timerState?.isRunning;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      {/* 상단 타이머 + 안내문 버튼 + 출구 번호 */}
      <SubwayHeader
        timeLabel={timeLabel}
        exitLabel={exitLabel}
        exitValue={exitValue}
        hasNewRule={hasNewRule}
        interactionDisabled={interactionDisabled}
        onOpenGuide={() => {
          setIsGuideOpen(true);
          setHasNewRule(false);
        }}
      />

      {/* 장소 이미지 영역 */}
      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-4">
        <SubwayLocationSection
          imageSrc={imageSrc}
          animState={animState}
          moving={moving}
        />

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
        rules={rules}
        onClose={() => {
          setIsGuideOpen(false);
          setHasNewRule(false);
        }}
      />
    </div>
  );
}
