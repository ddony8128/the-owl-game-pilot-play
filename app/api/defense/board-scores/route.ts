import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  DefenseScoreSnapshot,
  DefenseAction,
  Player,
} from "@/lib/types";

type BoardScore = {
  playerId: string;
  nickname: string | null;
  points: number;
  damage: number;
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
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  const roundParam = searchParams.get("round");
  const round = roundParam ? Number(roundParam) : NaN;

  if (!room) {
    return NextResponse.json({ error: "room 필요" } as BoardScoreResponse, {
      status: 400,
    });
  }

  if (!Number.isInteger(round)) {
    return NextResponse.json(
      { error: "round must be an integer" } as BoardScoreResponse,
      { status: 400 }
    );
  }

  // 튜토리얼 결과(3), 게임 종료(16)는
  // 직전에 끝난 라운드의 스냅샷을 사용한다.
  // 중간 점수 발표(7, 11)는 해당 라운드까지의 스냅샷을 그대로 사용한다.
  const sourceRound = round === 3 || round === 16 ? round - 1 : round;

  const [playersRes, scoresSnapRes, actionsRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, nickname, created_at")
      .eq("room_code", room),
    supabase
      .from("defense_score_snapshot")
      .select("player_id, round, points")
      .eq("room_code", room)
      .eq("round", sourceRound),
    supabase
      .from("defense_action")
      .select(
        "round, player_id, action_type, used_card_value"
      )
      .eq("room_code", room)
      // 본게임(DB round 4~15)만 누적 데미지 타이브레이커에 반영. 튜토리얼(1·2)은 제외.
      .gte("round", 4)
      .lte("round", sourceRound)
      .eq("action_type", "combat"),
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

  if (actionsRes.error) {
    return NextResponse.json(
      { error: actionsRes.error.message } as BoardScoreResponse,
      { status: 500 }
    );
  }

  const players = (playersRes.data || []) as Player[];
  const snaps = (scoresSnapRes.data || []) as DefenseScoreSnapshot[];
  const actions =
    (actionsRes.data || []) as DefenseAction[];

  const pointsByPlayer = new Map<string, number>();
  snaps.forEach((s) => {
    pointsByPlayer.set(s.player_id, s.points);
  });

  // sourceRound까지의 "전투: ...에게 총 X 피해를 입혔습니다." 로그를 파싱해 누적 데미지 합산
  const damageByPlayer = new Map<string, number>();
  actions.forEach((a) => {
    if (a.action_type !== "combat") return;
    if (typeof a.used_card_value !== "number") return;
    const prev = damageByPlayer.get(a.player_id) ?? 0;
    damageByPlayer.set(a.player_id, prev + a.used_card_value);
  });

  const scores: BoardScore[] = players.map((p) => ({
    playerId: p.id,
    nickname: p.nickname ?? null,
    points: pointsByPlayer.get(p.id) ?? 0,
    damage: damageByPlayer.get(p.id) ?? 0,
  }));

  // 점수 내림차순, 동점이면 누적 데미지 내림차순, 그래도 동점이면 닉네임/ID 순
  scores.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.damage !== a.damage) return b.damage - a.damage;
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


