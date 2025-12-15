import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GameState, RulesState } from "@/lib/types";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [
    { data: gameRow, error: gameError },
    { data: rulesRows, error: rulesError },
  ] = await Promise.all([
    supabase
      .from("game_state")
      .select("id, active_game, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("rules_state").select("rule_key, is_open, updated_at"),
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
