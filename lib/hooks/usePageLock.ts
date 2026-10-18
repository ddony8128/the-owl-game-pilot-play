"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { guardRedirect } from "@/lib/gamePath";

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

  // ITER6 C1 — 막힌 화면(/locked)으로 보내지 않는다: 세션이 없으면 입장 화면, 다른 게임 방이면 그 게임 화면으로.
  useEffect(() => {
    if (isLoading) return;
    if (!canAccess) router.replace(guardRedirect({ isLoggedIn, roomGame, allowGames: options.allowGames }));
  }, [canAccess, isLoading, isLoggedIn, roomGame, options.allowGames, router]);

  return {
    isLoading,
    canAccess,
    isLoggedIn,
    isPageActivated,
  } as const;
}
