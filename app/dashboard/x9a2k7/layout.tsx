import type { ReactNode } from "react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <aside className="flex w-40 flex-col gap-2 border-r border-zinc-800 bg-zinc-900 px-3 py-4 text-xs">
        <h1 className="mb-2 text-sm font-semibold">GM Dashboard</h1>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7"
        >
          방 관리
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/bgm"
        >
          BGM
        </Link>
        {/* 게임 대시보드는 "방 관리"에서 방을 골라 입장합니다(방 코드 필요). */}
      </aside>
      <main className="flex flex-1 flex-col px-4 py-4">{children}</main>
    </div>
  );
}
