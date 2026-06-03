import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isTestConsoleEnabled,
  TEST_CONSOLE_DISABLED_MESSAGE,
} from "@/lib/test/guard";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// 🟢 런타임 테이블: 자유롭게 비워도 다음 게임 시작 시 재생성된다.
// 각 테이블에서 "모든 행"을 지우기 위해 사용할 NOT NULL 컬럼(주로 PK)을 지정한다.
// 주의: id 컬럼이 bigint 인 테이블이 섞여 있으므로, 타입 무관한 `not is null` 필터를 쓴다.
// 주의: FK 가 있는 테이블은 "참조하는 쪽"을 먼저 지워야 한다.
const RUNTIME_TABLES: Record<string, { table: string; col: string }[]> = {
  subway: [
    { table: "subway_player_state", col: "player_id" },
    { table: "subway_player_events", col: "id" },
    { table: "subway_reports", col: "id" },
  ],
  mafia: [
    { table: "mafia_actions", col: "id" },
    { table: "mafia_player_snapshots", col: "id" },
    { table: "mafia_votes", col: "id" },
    { table: "mafia_public_logs", col: "id" },
    { table: "mafia_ability_results", col: "id" },
    { table: "mafia_stock_history", col: "id" },
    { table: "mafia_player_state", col: "player_id" },
  ],
  defense: [
    // 참조하는 쪽(snapshot/action)을 먼저, 참조되는 monster_instance 를 마지막에 삭제
    { table: "defense_monster_snapshot", col: "instance_id" },
    { table: "defense_action", col: "player_id" },
    { table: "defense_card_state", col: "player_id" },
    { table: "defense_score", col: "player_id" },
    { table: "defense_score_snapshot", col: "player_id" },
    { table: "defense_player_log", col: "player_id" },
    { table: "defense_monster_instance", col: "id" },
  ],
  vote: [{ table: "player_votes", col: "id" }],
};

async function deleteAllRows(
  supabase: SupabaseClient,
  table: string,
  col: string
): Promise<string | null> {
  // col 이 NULL 이 아닌 모든 행 = 전체 행. (uuid/bigint 등 컬럼 타입에 무관)
  const { error } = await supabase.from(table).delete().not(col, "is", null);
  return error ? `${table}: ${error.message}` : null;
}

// 🔴/🟠 게임별 설정/시드 복원 (DELETE 가 아니라 초기값 upsert/update — 행을 지우면 게임이 부팅되지 않음)
async function restoreSubwayConfig(supabase: SupabaseClient): Promise<string[]> {
  const errors: string[] = [];
  // subway 는 별도 phase 싱글톤이 없고, 전역 타이머만 game_state 에 있다.
  const { error } = await supabase
    .from("game_state")
    .update({ timer_start: false, timer_start_at: null, pause_at: null })
    .eq("id", 1);
  if (error) errors.push(`game_state(timer): ${error.message}`);
  return errors;
}

async function restoreMafiaConfig(supabase: SupabaseClient): Promise<string[]> {
  const errors: string[] = [];
  const phase = await supabase
    .from("mafia_phase_state")
    .upsert({ id: 1, round_number: 0, phase: "prepare" }, { onConflict: "id" });
  if (phase.error) errors.push(`mafia_phase_state: ${phase.error.message}`);

  const stocks = await supabase.from("mafia_stock_state").upsert(
    [
      { stock_key: "부엉교육", price: 5 },
      { stock_key: "번쩍전기", price: 5 },
      { stock_key: "국채", price: 5 },
      { stock_key: "이상교통", price: 5 },
    ],
    { onConflict: "stock_key" }
  );
  if (stocks.error) errors.push(`mafia_stock_state: ${stocks.error.message}`);
  return errors;
}

async function restoreDefenseConfig(
  supabase: SupabaseClient
): Promise<string[]> {
  const errors: string[] = [];
  const phase = await supabase
    .from("defense_phase_state")
    .upsert({ id: 1, round: 0 }, { onConflict: "id" });
  if (phase.error) errors.push(`defense_phase_state: ${phase.error.message}`);

  const counts = DEFENSE_MONSTERS.map((m) => ({ id: m.id, count: m.baseCount }));
  const countRes = await supabase
    .from("defense_monster_count")
    .upsert(counts, { onConflict: "id" });
  if (countRes.error)
    errors.push(`defense_monster_count: ${countRes.error.message}`);
  return errors;
}

async function restoreGlobalConfig(
  supabase: SupabaseClient
): Promise<string[]> {
  const errors: string[] = [];
  // game_state 싱글톤 복원: active_game=ready, 타이머 해제
  const game = await supabase.from("game_state").upsert(
    {
      id: 1,
      active_game: "ready",
      timer_start: false,
      timer_start_at: null,
      pause_at: null,
    },
    { onConflict: "id" }
  );
  if (game.error) errors.push(`game_state: ${game.error.message}`);

  // rules_state 는 행을 보존하고 전부 닫기만 한다(행을 지우면 규칙 기능이 영구히 깨짐).
  const rules = await supabase
    .from("rules_state")
    .update({ is_open: false })
    .neq("rule_key", "__never__");
  if (rules.error) errors.push(`rules_state: ${rules.error.message}`);
  return errors;
}

/**
 * POST /api/test/reset
 * body:
 *   { scope: "game", game: "subway" | "mafia" | "defense" | "vote" }
 *      → 해당 게임 런타임만 삭제 + 해당 게임 설정 초기화 (플레이어 유지)
 *   { scope: "runtime" }
 *      → 모든 게임 런타임 삭제 + 전체 설정 초기화 (플레이어 유지)
 *   { scope: "all" }
 *      → 모든 런타임 삭제 + 플레이어 전체 삭제 + 전체 설정 초기화 (완전 clean slate)
 */
export async function POST(request: Request) {
  if (!isTestConsoleEnabled()) {
    return NextResponse.json(
      { error: TEST_CONSOLE_DISABLED_MESSAGE },
      { status: 403 }
    );
  }

  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    scope?: string;
    game?: string;
  } | null;

  const scope = body?.scope;
  const errors: string[] = [];

  if (scope === "game") {
    const game = body?.game;
    if (!game || !RUNTIME_TABLES[game]) {
      return NextResponse.json(
        { error: "game 값이 올바르지 않습니다. (subway|mafia|defense|vote)" },
        { status: 400 }
      );
    }
    for (const { table, col } of RUNTIME_TABLES[game]) {
      const err = await deleteAllRows(supabase, table, col);
      if (err) errors.push(err);
    }
    if (game === "subway") errors.push(...(await restoreSubwayConfig(supabase)));
    if (game === "mafia") errors.push(...(await restoreMafiaConfig(supabase)));
    if (game === "defense")
      errors.push(...(await restoreDefenseConfig(supabase)));
    // vote 는 별도 설정 없음
  } else if (scope === "runtime" || scope === "all") {
    // 모든 게임 런타임 삭제
    for (const tables of Object.values(RUNTIME_TABLES)) {
      for (const { table, col } of tables) {
        const err = await deleteAllRows(supabase, table, col);
        if (err) errors.push(err);
      }
    }

    if (scope === "all") {
      // 자식 런타임을 모두 지운 뒤 플레이어 삭제 (FK 안전)
      const err = await deleteAllRows(supabase, "players", "id");
      if (err) errors.push(err);
    }

    // 전체 설정 초기화 (싱글톤/시드 복원)
    errors.push(...(await restoreGlobalConfig(supabase)));
    errors.push(...(await restoreMafiaConfig(supabase)));
    errors.push(...(await restoreDefenseConfig(supabase)));
  } else {
    return NextResponse.json(
      { error: "scope 가 필요합니다. (game|runtime|all)" },
      { status: 400 }
    );
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, scope, errors },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, scope, game: body?.game ?? null });
}
