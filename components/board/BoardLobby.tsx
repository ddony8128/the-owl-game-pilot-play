"use client";

import { JoinQr } from "@/components/JoinQr";
import { useViewportHeight } from "./useBoardRoom";

/**
 * 보드 준비(로비) 화면 — 큰 참가 QR + 방 코드 + 등록 인원.
 * QR 은 px 크기라 창 높이에 맞춰 계산한다(1280×720 에서도 한 화면).
 */
export function BoardLobby({
  code,
  playerCount,
  heading,
  hint,
}: {
  code: string;
  playerCount: number | null;
  heading: string;
  hint?: string;
}) {
  const vh = useViewportHeight();
  const qrSize = vh > 0 ? Math.max(200, Math.min(380, Math.round(vh * 0.4))) : 300;
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center gap-[5vw]" data-testid="board-lobby">
      <div className="flex-none">
        <JoinQr code={code} size={qrSize} />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-[2vh]">
        <p className="text-[clamp(1.4rem,4vh,2.8rem)] font-black leading-tight text-amber-300">{heading}</p>
        <div>
          <p className="text-[clamp(0.9rem,2vh,1.4rem)] text-zinc-400">방 코드</p>
          <p
            className="font-mono text-[clamp(3.5rem,12vh,8rem)] font-black leading-none tracking-[0.18em] text-amber-300"
            data-testid="board-room-code"
          >
            {code}
          </p>
        </div>
        <p className="text-[clamp(1rem,2.6vh,1.8rem)] text-zinc-200" data-testid="board-player-count">
          입장 인원 <b className="text-zinc-50">{playerCount ?? "-"}</b>명
        </p>
        {hint && <p className="max-w-[34vw] text-[clamp(0.8rem,1.9vh,1.2rem)] leading-relaxed text-zinc-400">{hint}</p>}
      </div>
    </div>
  );
}
