import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
  MafiaLog,
  Player,
} from "@/lib/types";

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname");
  const all = searchParams.get("all") === "1";

  // phase
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message }, { status: 500 });
  }

  const phase = (phaseRow || null) as MafiaPhaseState | null;

  // stocks
  const { data: stockRows, error: stockError } = await supabase
    .from("mafia_stock_state")
    .select("stock_key, price, updated_at");

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 });
  }

  const stocks = (stockRows || []) as MafiaStockState[];

  // logs (공개 로그)
  const { data: logRows, error: logError } = await supabase
    .from("mafia_public_logs")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  const logs = (logRows || []) as MafiaLog[];

  if (all) {
    // GM용 전체 플레이어 상태
    const { data: playerStateRows, error: playerStateError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at");

    if (playerStateError) {
      return NextResponse.json(
        { error: playerStateError.message },
        { status: 500 }
      );
    }

    const players = (playerStateRows || []) as MafiaPlayerState[];

    return NextResponse.json({ phase, stocks, players, logs });
  }

  let playerState: MafiaPlayerState | null = null;

  if (nickname) {
    const playerRes = await supabase
      .from("players")
      .select("id, nickname, is_finalist, created_at")
      .eq("nickname", nickname)
      .maybeSingle();

    if (playerRes.error) {
      return NextResponse.json(
        { error: playerRes.error.message },
        { status: 500 }
      );
    }

    if (!playerRes.data) {
      return NextResponse.json(
        { error: "등록되지 않은 닉네임입니다." },
        { status: 403 }
      );
    }

    const player = playerRes.data as Player;

    const { data: stateRow, error: stateError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("player_id", player.id)
      .maybeSingle();

    if (stateError) {
      return NextResponse.json({ error: stateError.message }, { status: 500 });
    }

    playerState = (stateRow || null) as MafiaPlayerState | null;
  }

  return NextResponse.json({ phase, stocks, playerState, logs });
}
