import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isTestConsoleEnabled,
  TEST_CONSOLE_DISABLED_MESSAGE,
} from "@/lib/test/guard";

// 테스트 편의용 "게임 시작" 헬퍼.
// - game_state.active_game 을 지정 값으로 변경
// - 해당 게임의 phase 싱글톤이 없을 수 있는 신규 DB 를 대비해 초기 행을 upsert
//   (실제 자산 시드는 GM 대시보드의 페이즈 전환에서 일어남)
const VALID_GAMES = new Set([
  "ready",
  "subway",
  "mafia_tutorial",
  "mafia",
  "defense",
  "vote",
  "survey",
]);

export async function POST(request: Request) {
  if (!isTestConsoleEnabled()) {
    return NextResponse.json(
      { error: TEST_CONSOLE_DISABLED_MESSAGE },
      { status: 403 }
    );
  }

  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    game?: string;
  } | null;

  const game = body?.game?.trim();
  if (!game || !VALID_GAMES.has(game)) {
    return NextResponse.json(
      { error: `game 값이 올바르지 않습니다. (${[...VALID_GAMES].join("|")})` },
      { status: 400 }
    );
  }

  // active_game 변경 (game_state 싱글톤이 없으면 생성)
  const gameRes = await supabase
    .from("game_state")
    .upsert({ id: 1, active_game: game }, { onConflict: "id" });
  if (gameRes.error) {
    return NextResponse.json({ error: gameRes.error.message }, { status: 500 });
  }

  // 게임별 phase 싱글톤 보장 (없을 때만 초기 행 생성)
  if (game === "mafia" || game === "mafia_tutorial") {
    const { data } = await supabase
      .from("mafia_phase_state")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (!data) {
      await supabase
        .from("mafia_phase_state")
        .insert({ id: 1, round_number: 0, phase: "prepare" });
    }
  }

  if (game === "defense") {
    const { data } = await supabase
      .from("defense_phase_state")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (!data) {
      await supabase.from("defense_phase_state").insert({ id: 1, round: 0 });
    }
  }

  return NextResponse.json({ ok: true, active_game: game });
}
