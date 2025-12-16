"use client";

import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function SubwayEndClient() {
  const router = useRouter();
  const { isLoading } = usePlayerAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <h1 className="mb-2 text-xl font-semibold">수고하셨습니다!</h1>
      <p className="mb-4 max-w-xs text-sm text-zinc-400">
        이상교통 8번출구 게임을 모두 완료했습니다.
        <br />
        GM의 다음 안내를 기다려 주세요.
      </p>
      <button
        className="h-11 w-full max-w-xs rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
        onClick={() => router.replace("/intro")}
      >
        인트로로 돌아가기
      </button>
    </div>
  );
}
