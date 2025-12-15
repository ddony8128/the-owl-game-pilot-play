import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);

  if (!body || typeof body.active_game !== "string") {
    return NextResponse.json(
      { error: "active_game is required" },
      { status: 400 }
    );
  }

  const active_game = body.active_game.trim();
  if (!active_game) {
    return NextResponse.json(
      { error: "active_game is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("game_state")
    .update({ active_game })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active_game });
}
