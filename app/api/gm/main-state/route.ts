import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { GameState, RulesState, Player } from "@/lib/types";

type MainStateResponse =
  | {
      game: GameState | null;
      rules: RulesState[];
      players: (Player & { feather?: number | null })[];
    }
  | { error: string };

export async function GET(request: Request) {
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json(
      { error: "room 필요" } as MainStateResponse,
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const [gameRes, rulesRes, playersRes] = await Promise.all([
    supabase
      .from("game_state")
      .select(
        "room_code, active_game, updated_at, timer_start, timer_start_at, pause_at"
      )
      .eq("room_code", room)
      .maybeSingle(),
    supabase
      .from("rules_state")
      .select("rule_key, is_open, updated_at")
      .eq("room_code", room),
    supabase
      .from("players")
      .select("id, nickname, created_at, feather")
      .eq("room_code", room)
      .order("nickname", { ascending: true }),
  ]);

  if (gameRes.error) {
    return NextResponse.json(
      { error: gameRes.error.message } as MainStateResponse,
      { status: 500 }
    );
  }

  if (rulesRes.error) {
    return NextResponse.json(
      { error: rulesRes.error.message } as MainStateResponse,
      { status: 500 }
    );
  }

  if (playersRes.error) {
    return NextResponse.json(
      { error: playersRes.error.message } as MainStateResponse,
      { status: 500 }
    );
  }

  const game = (gameRes.data || null) as GameState | null;
  const rules = (rulesRes.data || []) as RulesState[];
  const players = (playersRes.data || []) as (Player & {
    feather?: number | null;
  })[];

  return NextResponse.json({ game, rules, players });
}
