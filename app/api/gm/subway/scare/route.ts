import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ScareBody = {
  player_id?: string;
};

type ScareResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as ScareBody | null;

  if (!body || typeof body.player_id !== "string") {
    return NextResponse.json(
      { error: "player_id is required" } as ScareResponse,
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("subway_player_state")
    .update({ scare_status: true })
    .eq("player_id", body.player_id);

  if (error) {
    return NextResponse.json(
      { error: error.message } as ScareResponse,
      { status: 500 }
    );
  }

  await supabase.from("subway_player_events").insert({
    player_id: body.player_id,
    event_type: "scare",
    event_value: {},
  });

  return NextResponse.json({ ok: true } as ScareResponse, { status: 200 });
}

