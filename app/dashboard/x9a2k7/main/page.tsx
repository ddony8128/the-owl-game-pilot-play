"use client";

import { PlayerAdminSection } from "./PlayerAdminSection";

// 1게임(이상교통) 전용: 전역 게임 상태/규칙 공개 토글은 사용하지 않으므로
// 참가자 관리만 남긴다. (active_game 은 세션 초기화 시 자동으로 'subway' 로 복원)
export default function DashboardMainPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 text-sm">
      <PlayerAdminSection />
    </div>
  );
}
