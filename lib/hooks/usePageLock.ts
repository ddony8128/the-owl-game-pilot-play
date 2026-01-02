"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { useGameState } from "@/lib/hooks/useGameState";

export type PageLockOptions = {
  requireLogin?: boolean;
  allowGames?: string[]; // active_game 허용 목록
};

export function usePageLock(options: PageLockOptions) {
  const router = useRouter();
  const { player, nickname, isLoading: authLoading } = usePlayerAuth();
  const { activeGame, isLoading: gameLoading } = useGameState();

  const isLoading = authLoading || gameLoading;

  const isLoggedIn = !!nickname && !!player;
  const isPageActivated =
    !options.allowGames ||
    (activeGame != null && options.allowGames.includes(activeGame));

  // finalist 기반 접근 제한은 더 이상 사용하지 않음
  const canAccess = isLoggedIn && isPageActivated;

  useEffect(() => {
    if (isLoading) return;
    if (!canAccess) {
      router.replace("/locked");
    }
  }, [canAccess, isLoading, router]);

  return {
    isLoading,
    canAccess,
    isLoggedIn,
    isPageActivated,
  } as const;
}
