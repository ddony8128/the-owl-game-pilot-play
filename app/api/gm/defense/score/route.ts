import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DefenseScore } from "@/lib/types";

type GetResponse =
  | {
      scores: DefenseScore[];
    }
  | { error: string };

type PostBody = {
  playerId?: string;
  delta?: number;
};

type PostResponse =
  | {
      ok: true;
      points: number;
    }
  | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("defense_score")
    .select("player_id, points");

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

  return NextResponse.json(
    { ok: true, points: nextPoints } as PostResponse,
    { status: 200 }
  );
}


