"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";

export type PageLockOptions = {
  requireLogin?: boolean;
  allowGames?: string[]; // 이 방의 game 허용 목록 (예: ["mafia"])
};

// 방 모델: 로그인(방+닉네임 검증 완료) + 방의 game 일치 여부로 접근 제어.
// 게임 진행 상태(phase)는 서버가 강제하므로 여기선 방 소속만 본다.
export function usePageLock(options: PageLockOptions) {
  const router = useRouter();
  const { player, nickname, roomCode, roomGame, isLoading } = usePlayerAuth();

  const isLoggedIn = !!nickname && !!roomCode && !!player;
  const isPageActivated =
    !options.allowGames ||
    (roomGame != null && options.allowGames.includes(roomGame));

  const canAccess = isLoggedIn && isPageActivated;

  useEffect(() => {
    if (isLoading) return;
    if (!canAccess) router.replace("/locked");
  }, [canAccess, isLoading, router]);

  return {
    isLoading,
    canAccess,
    isLoggedIn,
    isPageActivated,
  } as const;
}
