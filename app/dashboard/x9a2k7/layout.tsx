import type { ReactNode } from "react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50">
      <aside className="flex w-40 flex-col gap-2 border-r border-zinc-800 bg-zinc-900 px-3 py-4 text-xs">
        <h1 className="mb-2 text-sm font-semibold">나폴리탄 카지노 운영</h1>
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
        <Link className="text-zinc-200 hover:text-amber-300" href="/subway-board">
          결과 중계
        </Link>
        <Link
          className="text-zinc-200 hover:text-amber-300"
          href="/dashboard/x9a2k7/police"
        >
          신고 관리
        </Link>
        {/* 1게임(이상교통) 전용 빌드: 마피아/디펜스 등 타 게임 GM 페이지는 노출하지 않음 */}
      </aside>
      <main className="flex flex-1 flex-col px-4 py-4">{children}</main>
    </div>
  );
}
