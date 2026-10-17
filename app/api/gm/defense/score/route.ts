import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { DefenseScore } from "@/lib/types";

type GetResponse =
  | {
      scores: DefenseScore[];
    }
  | { error: string };

type PostBody = {
  room?: string;
  playerId?: string;
  delta?: number;
};

type PostResponse =
  | {
      ok: true;
      points: number;
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");

  if (!room) {
    return NextResponse.json({ error: "room 필요" } as GetResponse, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("defense_score")
    .select("player_id, points")
    .eq("room_code", room);

  if (error) {
    return NextResponse.json({ error: error.message } as GetResponse, {
      status: 500,
    });
  }

  return NextResponse.json(
    {
      scores: (data || []) as DefenseScore[],
    } as GetResponse,
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as PostBody | null;

  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) {
    return NextResponse.json({ error: "room 필요" } as PostResponse, {
      status: 400,
    });
  }

  if (!body || typeof body.playerId !== "string") {
    return NextResponse.json(
      { error: "playerId is required" } as PostResponse,
      { status: 400 }
    );
  }

  const delta =
    typeof body.delta === "number" && (body.delta === 1 || body.delta === -1)
      ? body.delta
      : 0;

  if (!delta) {
    return NextResponse.json(
      { error: "delta must be +1 or -1" } as PostResponse,
      { status: 400 }
    );
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("defense_score")
    .select("player_id, points")
    .eq("room_code", room)
    .eq("player_id", body.playerId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message } as PostResponse,
      { status: 500 }
    );
  }

  const currentPoints =
    existingRow && typeof existingRow.points === "number"
      ? existingRow.points
      : 0;
  const nextPoints = currentPoints + delta;

  const { error: upsertError } = await supabase
    .from("defense_score")
    .upsert(
      {
        room_code: room,
        player_id: body.playerId,
        points: nextPoints,
      } as DefenseScore,
      { onConflict: "player_id" }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message } as PostResponse,
      { status: 500 }
    );
  }

  // 이미 끝난 라운드의 점수 공개 직전에 GM이 보정한 경우,
  // 가장 최근 점수 스냅샷에도 같은 보정을 반영한다.
  const latestSnapshot = await supabase
    .from("defense_score_snapshot")
    .select("round, points")
    .eq("room_code", room)
    .eq("player_id", body.playerId)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSnapshot.error && latestSnapshot.data) {
    await supabase
      .from("defense_score_snapshot")
      .update({ points: (latestSnapshot.data.points ?? 0) + delta })
      .eq("room_code", room)
      .eq("player_id", body.playerId)
      .eq("round", latestSnapshot.data.round);
  }

  return NextResponse.json(
    { ok: true, points: nextPoints } as PostResponse,
    { status: 200 }
  );
}


