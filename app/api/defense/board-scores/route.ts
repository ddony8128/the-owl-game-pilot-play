import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DefenseScoreSnapshot, Player } from "@/lib/types";

type BoardScore = {
  playerId: string;
  nickname: string | null;
  points: number;
};

type BoardScoreResponse =
  | {
      round: number;
      scores: BoardScore[];
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const roundParam = searchParams.get("round");
  const round = roundParam ? Number(roundParam) : NaN;

  if (!Number.isInteger(round)) {
    return NextResponse.json(
      { error: "round must be an integer" } as BoardScoreResponse,
      { status: 400 }
    );
  }

  // 튜토리얼 결과(3), 게임 종료(14)는 직전에 끝난 라운드의 스냅샷을 사용
  const sourceRound =
    round === 3 || round === 14 ? round - 1 : round;

  const [playersRes, scoresSnapRes] = await Promise.all([
    supabase.from("players").select("id, nickname, created_at"),
    supabase
      .from("defense_score_snapshot")
      .select("player_id, round, points")
      .eq("round", sourceRound),
  ]);

  if (playersRes.error) {
    return NextResponse.json(
      { error: playersRes.error.message } as BoardScoreResponse,
      { status: 500 }
    );
  }

  if (scoresSnapRes.error) {
    return NextResponse.json(
      { error: scoresSnapRes.error.message } as BoardScoreResponse,
      { status: 500 }
    );
  }

  const players = (playersRes.data || []) as Player[];
  const snaps = (scoresSnapRes.data || []) as DefenseScoreSnapshot[];

  const pointsByPlayer = new Map<string, number>();
  snaps.forEach((s) => {
    pointsByPlayer.set(s.player_id, s.points);
  });

  const scores: BoardScore[] = players.map((p) => ({
    playerId: p.id,
    nickname: p.nickname ?? null,
    points: pointsByPlayer.get(p.id) ?? 0,
  }));

  // 점수 내림차순, 동점이면 닉네임/ID 순
  scores.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const na = a.nickname ?? a.playerId;
    const nb = b.nickname ?? b.playerId;
    return na.localeCompare(nb);
  });

  return NextResponse.json(
    {
      round,
      scores,
    } as BoardScoreResponse,
    { status: 200 }
  );
}


