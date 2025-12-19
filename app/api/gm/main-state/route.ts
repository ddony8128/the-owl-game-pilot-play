import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GameState, RulesState, Player } from "@/lib/types";

type MainStateResponse =
  | { game: GameState | null; rules: RulesState[]; players: Player[] }
  | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [gameRes, rulesRes, playersRes] = await Promise.all([
    supabase
      .from("game_state")
      .select(
        "id, active_game, updated_at, timer_start, timer_start_at, pause_at"
      )
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("rules_state").select("rule_key, is_open, updated_at"),
    supabase
      .from("players")
      .select("id, nickname, is_finalist, created_at")
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
  const players = (playersRes.data || []) as Player[];

  return NextResponse.json({ game, rules, players });
}
