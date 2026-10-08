"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoomEndedNotice } from "../RoomEndedNotice";
import { RuleVideoPanel } from "../RuleVideoPanel";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useMafiaAdminState } from "./useMafiaAdminState";
import { MafiaCountdownSection } from "./MafiaCountdownSection";
import { MafiaPhaseSection } from "./MafiaPhaseSection";
import { MafiaAssetsSection } from "./MafiaAssetsSection";
import { MafiaStocksSection } from "./MafiaStocksSection";
import { MafiaLogsSection } from "./MafiaLogsSection";
import { MafiaRoundSummarySection } from "./MafiaRoundSummarySection";
import type { MafiaLog } from "@/lib/types";

export default function DashboardMafiaPage() {
  // 하이드레이션 안전: room(URL)·mounted 는 서버에서 알 수 없으므로 마운트 후에만 읽는다.
  // (서버·클라 첫 렌더가 동일한 로딩 화면이 되도록 하여 SSR/CSR 불일치를 방지)
  const [room, setRoom] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 은 마운트 후에만 읽을 수 있다
    setRoom(new URLSearchParams(window.location.search).get("room"));
    setMounted(true);
  }, []);

  const { phase, stocks, players, playerNames, logs, loading, error, reload } =
    useMafiaAdminState(room);

  const changePhase = async (to: string) => {
    if (!room) return;
    try {
      const res = await fetch("/api/gm/mafia/advance-phase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, room }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        // eslint-disable-next-line no-console
        console.error(json?.error ?? "페이즈 전환 중 오류가 발생했습니다.");
      } else {
        // 성공 시 즉시 상태를 다시 로딩해 반영
        reload();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleLogAdded = (log: MafiaLog) => {
    // useMafiaAdminState가 가진 logs는 변경 불가이므로,
    // 최신 로그는 MafiaLogsSection 내부에서만 관리하거나
    // 향후 훅에 onLogAdded를 통합하는 방향으로 개선 가능.
    // 현재는 별도 리프레시 없이 화면상 목록에만 추가.
    logs.unshift(log);
  };

  if (!mounted) return <LoadingScreen />;

  if (!room) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm">
        <p className="text-zinc-300">방이 선택되지 않았습니다.</p>
        <Link
          href="/dashboard/x9a2k7"
          className="rounded bg-amber-400 px-3 py-1 font-semibold text-zinc-950 hover:bg-amber-300"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-400">
          방 <b className="font-mono text-amber-300">{room}</b>
        </span>
        <a
          href={`/mafia-board?room=${room}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded bg-zinc-800 px-3 py-1.5 text-amber-300 hover:bg-zinc-700"
        >
          결과 페이지 ↗
        </a>
      </div>

      <RoomEndedNotice room={room} />
      <RuleVideoPanel room={room} video="mafia" />
      <MafiaCountdownSection phase={phase} room={room} />

      <MafiaPhaseSection
        phase={phase}
        onChangePhase={changePhase}
        onChangeRound={async (round) => {
          try {
            const res = await fetch("/api/gm/mafia/phase", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ round, room }),
            });
            const json = (await res.json().catch(() => null)) as {
              ok?: true;
              error?: string;
            } | null;
            if (!res.ok || !json?.ok) {
              // eslint-disable-next-line no-console
              console.error(
                json?.error ?? "라운드 변경 중 오류가 발생했습니다."
              );
            } else {
              reload();
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
          }
        }}
      />

      <MafiaAssetsSection
        players={players}
        playerNames={playerNames}
        stocks={stocks}
      />

      <MafiaStocksSection stocks={stocks} />

      <MafiaRoundSummarySection currentRound={phase?.round_number} room={room} />

      <MafiaLogsSection logs={logs} onLogAdded={handleLogAdded} room={room} />
    </div>
  );
}
