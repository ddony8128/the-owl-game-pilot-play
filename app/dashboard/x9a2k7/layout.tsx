import type { ReactNode } from "react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <aside className="flex w-40 flex-col gap-2 border-r border-zinc-800 bg-zinc-900 px-3 py-4 text-xs">
        <h1 className="mb-2 text-sm font-semibold">GM Dashboard</h1>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/main"
        >
          메인
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/memo"
        >
          메모
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/bgm"
        >
          BGM
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/subway"
        >
          이상교통
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/mafia"
        >
          마피아
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/defense"
        >
          디펜스
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/police"
        >
          신고 관리
        </Link>
        {/* 3게임(퀴즈쇼) 관련 GM 페이지는 더 이상 사용하지 않음 */}
      </aside>
      <main className="flex flex-1 flex-col px-4 py-4">{children}</main>
    </div>
  );
}
