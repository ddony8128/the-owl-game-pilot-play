"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubwayPlayerState } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SubwayEndContent } from "./SubwayEndContent";

export default function SubwayEndClient() {
  const router = useRouter();
  const { nickname, isLoading } = usePlayerAuth();
  const [state, setState] = useState<SubwayPlayerState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;

    const load = async () => {
      setLoadingState(true);
      try {
        const res = await fetch(
          `/api/subway/state?nickname=${encodeURIComponent(nickname)}`
        );
        const json = (await res.json().catch(() => null)) as
          | { state: SubwayPlayerState | null; error?: string }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "플레이어 상태를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setState(json.state ?? null);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "플레이어 상태를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [nickname]);

  if (isLoading || loadingState) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  const finishedRank = state?.finished_rank ?? null;

  return (
    <SubwayEndContent
      finishedRank={finishedRank}
      onBackToIntro={() => router.replace("/intro")}
    />
  );
}
