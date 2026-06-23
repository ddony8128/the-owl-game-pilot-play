import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { GameState, RulesState } from "@/lib/types";

export async function GET(request: Request) {
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const [
    { data: gameRow, error: gameError },
    { data: rulesRows, error: rulesError },
  ] = await Promise.all([
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
  ]);

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 });
  }
  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  const gameState = (gameRow || null) as GameState | null;
  const rules = (rulesRows || []) as RulesState[];

  return NextResponse.json({ gameState, rules });
}
