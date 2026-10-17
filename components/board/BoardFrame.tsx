"use client";

import type { ReactNode } from "react";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import "./board.css";

/** 테마 배경(video/assets/bg → public/board-bg, webp). 어둡게 깔아 글자·QR·영상 오버레이 가독성을 지킨다. */
export type BoardBg =
  | "stage-defense"
  | "alley-defense"
  | "city-defense"
  | "hall-mafia"
  | "floor-mafia"
  | "skyline-mafia";

/**
 * 보드(빔) 공통 틀 — h-dvh 한 화면, 넘침 금지(반면교사 1-12).
 * 헤더(제목·라운드·카운트다운·재연결 배지) + 본문(flex-1 min-h-0). 본문은 data-testid="board-main".
 */
export function BoardFrame({
  bg,
  dim = 0.78,
  title,
  subtitle,
  right,
  failures,
  stage,
  children,
}: {
  bg: BoardBg;
  /** 배경 위에 덮는 검정 불투명도(0~1) */
  dim?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 헤더 오른쪽(카운트다운·토글) */
  right?: ReactNode;
  failures: number;
  /** data-stage 속성(E2E) */
  stage: Record<string, string | number | boolean | null | undefined>;
  children: ReactNode;
}) {
  const dataAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(stage)) {
    if (v !== undefined && v !== null) dataAttrs[`data-${k}`] = String(v);
  }
  return (
    <div
      className="board-root relative flex h-dvh w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-50"
      data-testid="board-root"
      {...dataAttrs}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(/board-bg/${bg}.webp)` }}
        data-testid="board-bg"
        data-bg={bg}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(9,9,11,${Math.min(1, dim + 0.12)}) 0%, rgba(9,9,11,${dim}) 45%, rgba(9,9,11,${Math.min(1, dim + 0.1)}) 100%)`,
        }}
      />
      <header className="relative z-10 flex flex-none items-center justify-between gap-6 border-b border-white/10 bg-zinc-950/40 px-[2vw] py-[1.2vh] backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(1.3rem,3.6vh,2.6rem)] font-black leading-tight tracking-tight" data-testid="board-title">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-[clamp(0.8rem,1.9vh,1.25rem)] text-zinc-400" data-testid="board-subtitle">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex flex-none items-center gap-5">
          <ConnectionBadge failures={failures} />
          {right}
        </div>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-[2vw] py-[1.5vh]" data-testid="board-main">
        {children}
      </main>
    </div>
  );
}
