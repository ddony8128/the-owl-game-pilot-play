"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { SubwayPlayerState } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

type MoveResult = "correct" | "wrong" | "reset" | "noop" | null;

export default function SubwayClient() {
  return (
    <PageGuard requireLogin allowGames={["subway"]}>
      <SubwayInner />
    </PageGuard>
  );
}

function SubwayInner() {
  const router = useRouter();
  const { nickname } = usePlayerAuth();
  const [subwayPlayer, setSubwayPlayer] = useState<SubwayPlayerState | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animState, setAnimState] = useState<"normal" | "shock1" | "shock2">(
    "normal"
  );
  const [lastResult, setLastResult] = useState<MoveResult>(null);

  useEffect(() => {
    if (!nickname) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/subway/state?nickname=${encodeURIComponent(nickname)}`
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            data?.error ?? "플레이어 상태를 불러오지 못했습니다."
          );
        }
        const json = (await res.json()) as {
          state: SubwayPlayerState | null;
        };
        if (cancelled) return;
        if (!json.state) {
          // 아직 시작하지 않은 경우, 첫 move에서 초기화
          setSubwayPlayer(null);
        } else if (json.state.is_finished) {
          router.replace("/subway/end");
          return;
        } else {
          setSubwayPlayer(json.state);
        }
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [nickname, router]);

  const handleMove = async (direction: "forward" | "back" | "reset") => {
    if (!nickname) return;
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/subway/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname, direction }),
      });

      const json = (await res.json().catch(() => null)) as {
        state?: SubwayPlayerState;
        result?: MoveResult;
        reason?: string;
        error?: string;
      } | null;

      if (!res.ok || !json) {
        throw new Error(
          json?.error ?? "이동 중 오류가 발생했습니다. GM에게 문의해 주세요."
        );
      }

      if (json.state?.is_finished) {
        router.replace("/subway/end");
        return;
      }

      if (json.state) {
        setSubwayPlayer(json.state);
      }
      setLastResult(json.result ?? null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "이동 중 오류가 발생했습니다.";
      setError(message);
    }
  };

  const handleMoveNextExit = () => handleMove("forward");
  const handleReset = () => handleMove("reset");

  const triggerShock = () => {
    setAnimState("shock1");
    setTimeout(() => setAnimState("shock2"), 500);
    setTimeout(() => setAnimState("normal"), 1000);
  };

  if (loading || !nickname) return <LoadingScreen />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const exitNumber = subwayPlayer?.exit_number ?? 0;
  const locationKey = subwayPlayer?.current_location ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <header className="flex w-full max-w-md items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">이상교통 8번출구</h1>
          <p className="text-xs text-zinc-400">출구를 찾아 이동해 보세요.</p>
        </div>
        <button
          className="text-xs text-zinc-400 underline"
          onClick={() => router.push("/intro")}
        >
          인트로로
        </button>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-4">
        {/* 상단 안내 + 피드백 */}
        <section className="flex flex-col gap-2 rounded-xl bg-zinc-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-300">
              <div>주변을 잘 관찰하고,</div>
              <div>수상한 출구를 찾으세요.</div>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <div>현재 출구</div>
              <div className="text-base font-semibold text-amber-300">
                {exitNumber} 번
              </div>
            </div>
          </div>
          {lastResult === "correct" && (
            <p className="text-[11px] text-emerald-300">
              올바른 방향입니다! 출구 번호가 증가했습니다.
            </p>
          )}
          {lastResult === "wrong" && (
            <p className="text-[11px] text-red-300">
              잘못된 방향입니다. 출구 번호가 0으로 돌아갔습니다.
            </p>
          )}
        </section>

        {/* 출구 / 이미지 영역 */}
        <section className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-300">현재 장소</p>
          </div>

          <div
            className={`flex flex-1 items-center justify-center rounded-2xl bg-zinc-900 ${
              animState !== "normal" ? "ring-2 ring-red-500/60" : ""
            }`}
          >
            {locationKey ? (
              <div className="relative h-full w-full max-h-80 overflow-hidden rounded-2xl">
                <Image
                  src={`/subway-location/${locationKey}`}
                  alt="지하철 장소"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                GM이 장소를 설정하는 중입니다. 잠시만 기다려 주세요.
              </p>
            )}
          </div>
        </section>

        {/* 하단 버튼 */}
        <section className="mt-4 flex flex-col gap-3">
          <button
            className="h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
            onClick={handleMoveNextExit}
          >
            다음 출구로 이동
          </button>
          <button
            className="h-11 w-full rounded-full border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
            onClick={handleReset}
          >
            처음부터 다시
          </button>
          <button
            className="h-10 w-full rounded-full border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-900"
            onClick={triggerShock}
          >
            (디버그) 놀래키기 연출 보기
          </button>
        </section>
      </main>
    </div>
  );
}
