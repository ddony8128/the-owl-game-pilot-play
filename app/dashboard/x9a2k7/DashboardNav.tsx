"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function navClass(active: boolean) {
  return `flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold transition ${
    active
      ? "bg-zinc-800 text-amber-300"
      : "text-zinc-300 hover:bg-zinc-800 hover:text-amber-300"
  }`;
}

export function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const room = searchParams.get("room")?.trim().toUpperCase() ?? "";
  const gameFromPath = pathname.includes("/mafia")
    ? "mafia"
    : pathname.includes("/defense")
      ? "defense"
      : null;
  const gameFromQuery = searchParams.get("game");
  const game =
    gameFromPath ??
    (gameFromQuery === "mafia" || gameFromQuery === "defense"
      ? gameFromQuery
      : null);
  const inRoom = Boolean(room && game);
  const roomManagementActive = pathname === "/dashboard/x9a2k7";
  const bgmActive = pathname === "/dashboard/x9a2k7/bgm";
  const gameActive = pathname === `/dashboard/x9a2k7/${game}`;
  const playersActive = pathname === "/dashboard/x9a2k7/players";

  return (
    <>
      <h1 className="mr-auto shrink-0 text-base font-bold xl:mb-5 xl:mr-0">
        부엉이게임 GM
      </h1>
      <Link prefetch={!roomManagementActive} className={navClass(roomManagementActive)} href="/dashboard/x9a2k7">
        방 관리
      </Link>
      <Link prefetch={!bgmActive} className={navClass(bgmActive)} href="/dashboard/x9a2k7/bgm">
        BGM
      </Link>

      {inRoom && (
        <>
          <div className="mx-1 hidden border-t border-zinc-800 pt-4 xl:mt-3 xl:block">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
              현재 방
            </p>
            <p className="mt-1 px-3 font-mono text-sm font-bold tracking-widest text-amber-300">
              {room}
            </p>
          </div>
          <Link
            prefetch={!gameActive}
            className={navClass(gameActive)}
            href={`/dashboard/x9a2k7/${game}?room=${encodeURIComponent(room)}`}
          >
            게임 진행
          </Link>
          <Link
            prefetch={!playersActive}
            className={navClass(playersActive)}
            href={`/dashboard/x9a2k7/players?room=${encodeURIComponent(room)}&game=${game}`}
          >
            참가자 관리
          </Link>
        </>
      )}
    </>
  );
}
