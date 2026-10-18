"use client";

import { Suspense, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { JoinQr } from "@/components/JoinQr";

/** GM 대시보드 「📲 참가 QR」이 새 창으로 여는 참가 안내 화면 — 큰 QR + 방 코드 + 접속 주소.
 *  빔/모니터에 띄우거나 노트북 화면을 돌려 보여 준다(중간 합류·재접속용). */
export default function JoinScreenPage() {
  return (
    <Suspense>
      <JoinScreen />
    </Suspense>
  );
}

function JoinScreen() {
  const params = useSearchParams();
  // ?code= (QR 안내) — ?room= 으로 열어도 같은 화면(ITER6 C1: 참가자가 /join?room=코드 로 열어도 막히지 않게)
  const code = (params.get("code") ?? params.get("room") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  if (!code) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-8 text-center text-zinc-100">
        <h1 className="mb-4 text-4xl font-black text-amber-300">참가 안내</h1>
        <p className="text-xl text-zinc-400">주소 뒤에 방 코드를 붙여 열어 주세요. 예: /join?code=A3F82</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-zinc-950 px-8 py-10 text-center text-zinc-100">
      <h1 className="text-4xl font-black text-amber-300">폰으로 접속해 참가하세요</h1>
      <JoinQr code={code} size={400} />
      <div>
        <p className="mb-2 text-2xl text-zinc-400">방 코드</p>
        <p className="font-mono text-8xl font-black tracking-[0.2em] text-amber-300" data-testid="join-screen-code">
          {code}
        </p>
      </div>
      <p className="font-mono text-2xl text-zinc-200" data-testid="join-screen-origin">
        {origin}
      </p>
    </main>
  );
}
