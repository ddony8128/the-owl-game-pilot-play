"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { useGameState } from "@/lib/hooks/useGameState";

export type PageLockOptions = {
  requireLogin?: boolean;
  allowGames?: string[]; // active_game 허용 목록
  requireFinalist?: boolean;
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
  const isRoleAllowed = options.requireFinalist ? !!player?.is_finalist : true;

  const canAccess = isLoggedIn && isPageActivated && isRoleAllowed;

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
    isRoleAllowed,
  } as const;
}
