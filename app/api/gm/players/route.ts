import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type PlayersResponse = { players: Player[] } | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .order("nickname", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message } as PlayersResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ players: (data || []) as Player[] });
}
