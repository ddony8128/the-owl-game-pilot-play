import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardNav } from "./DashboardNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 xl:flex">
      <aside className="sticky top-0 z-40 flex h-16 items-center gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-900/95 px-4 backdrop-blur xl:h-screen xl:w-52 xl:flex-col xl:items-stretch xl:overflow-visible xl:border-b-0 xl:border-r xl:px-4 xl:py-6">
        <Suspense fallback={<span className="text-sm font-bold">부엉이게임 GM</span>}>
          <DashboardNav />
        </Suspense>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col p-3 sm:p-5 lg:p-6">{children}</main>
    </div>
  );
}
