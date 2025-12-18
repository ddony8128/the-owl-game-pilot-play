import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type Body = {
  player_id?: string;
  is_finalist?: boolean;
};

type FinalistResponse = { ok: true; player: Player } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.player_id !== "string") {
    return NextResponse.json(
      { error: "player_id is required" } as FinalistResponse,
      { status: 400 }
    );
  }

  if (typeof body.is_finalist !== "boolean") {
    return NextResponse.json(
      { error: "is_finalist is required" } as FinalistResponse,
      { status: 400 }
    );
  }

  const nextFinalist = !body.is_finalist;

  const { data: updated, error: updateError } = await supabase
    .from("players")
    .update({ is_finalist: nextFinalist })
    .eq("id", body.player_id)
    .select("id, nickname, is_finalist, created_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "플레이어 finalist 상태를 업데이트하지 못했습니다.",
      } as FinalistResponse,
      { status: 500 }
    );
  }

  if (nextFinalist) {
    await supabase.from("quiz_player_state").upsert(
      {
        player_id: body.player_id,
        score: 0,
        chances: { peek: true, bet: true, safe: true },
      },
      { onConflict: "player_id" }
    );
  }

  return NextResponse.json(
    { ok: true, player: updated as Player } as FinalistResponse,
    { status: 200 }
  );
}
