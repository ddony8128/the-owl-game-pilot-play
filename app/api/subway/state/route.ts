import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, SubwayPlayerState } from "@/lib/types";

type StateResponse = { state: SubwayPlayerState | null } | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname");
  const all = searchParams.get("all") === "1";

  if (all) {
    const { data, error } = await supabase
      .from("subway_player_state")
      .select(
        "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
      );

    if (error) {
      return NextResponse.json({ error: error.message } as StateResponse, {
        status: 500,
      });
    }

    return NextResponse.json(
      { state: data as unknown as SubwayPlayerState[] } as unknown,
      { status: 200 }
    );
  }

  if (!nickname) {
    return NextResponse.json(
      { error: "nickname is required" } as StateResponse,
      { status: 400 }
    );
  }

  const playerRes = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerRes.error) {
    return NextResponse.json(
      { error: playerRes.error.message } as StateResponse,
      { status: 500 }
    );
  }

  if (!playerRes.data) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as StateResponse,
      { status: 403 }
    );
  }

  const player = playerRes.data as Player;

  const { data: stateRow, error: stateError } = await supabase
    .from("subway_player_state")
    .select(
      "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
    )
    .eq("player_id", player.id)
    .maybeSingle();

  if (stateError) {
    return NextResponse.json({ error: stateError.message } as StateResponse, {
      status: 500,
    });
  }

  if (!stateRow) {
    // 최초 진입: state가 없으면 null을 반환하고, 클라이언트는 move를 통해 시작하도록 할 수 있음
    return NextResponse.json({ state: null } as StateResponse, { status: 200 });
  }

  return NextResponse.json(
    { state: stateRow as SubwayPlayerState } as StateResponse,
    { status: 200 }
  );
}
