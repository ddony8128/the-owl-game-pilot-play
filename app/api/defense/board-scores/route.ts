import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { rankPlayers, type Ranked } from "@/lib/defense/rank";
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

// Iteration 5: 순위(rank·tieCount)는 lib/defense/rank.ts 의 rankPlayers 가 매긴다(점수 → 누적 데미지 → 공동 순위).
// 배열은 등수 오름차순. 닉네임으로 가르지 않는다.
type BoardScoreResponse =
  | {
      round: number;
      scores: Ranked<BoardScore>[];
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
  let sourceRound = round === 3 || round === 16 ? round - 1 : round;
  if (round === 16) {
    // 조기 종료(모든 몬스터 처치·도망)면 15 가 아니라 마지막으로 정산된 라운드의 스냅샷을 쓴다.
    const { data: phaseRow } = await supabase
      .from("defense_phase_state")
      .select("ended_early_from")
      .eq("room_code", room)
      .maybeSingle();
    const from = (phaseRow as { ended_early_from?: number | null } | null)?.ended_early_from;
    if (typeof from === "number") sourceRound = from;
  }

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

  // 점수 내림차순 → 동점이면 누적 데미지 내림차순 → 그래도 같으면 공동 순위(1,1,3). 닉네임 순 정렬은 쓰지 않는다.
  const ranked = rankPlayers(scores);

  return NextResponse.json(
    {
      round,
      scores: ranked,
    } as BoardScoreResponse,
    { status: 200 }
  );
}


