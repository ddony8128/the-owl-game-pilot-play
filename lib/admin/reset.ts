import { randomUUID } from "crypto";
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// 아카이브 테이블이 아직 생성되지 않은 경우인지 판별.
// 이 경우엔 보존을 건너뛰되 reset 자체는 막지 않는다(경고만).
// Postgres(42P01) 와 PostgREST(PGRST205: 스키마 캐시에 테이블 없음) 양쪽 시그니처를 모두 처리.
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" || // postgres: undefined_table
    code === "PGRST205" || // postgrest: table not found in schema cache
    code === "PGRST202" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

// 🟢 런타임 테이블: 자유롭게 비워도 다음 게임 시작 시 재생성된다.
// 각 테이블에서 "모든 행"을 지우기 위해 사용할 NOT NULL 컬럼(주로 PK)을 지정한다.
// 주의: id 컬럼이 bigint 인 테이블이 섞여 있으므로, 타입 무관한 `not is null` 필터를 쓴다.
// 주의: FK 가 있는 테이블은 "참조하는 쪽"을 먼저 지워야 한다.
export const RUNTIME_TABLES: Record<string, { table: string; col: string }[]> = {
  subway: [
    // 자식(state 를 참조) → 부모(state) 순서로 삭제해야 FK 위반이 없다.
    // events/reports 가 subway_player_state(player_id) 를 참조하므로 먼저 비운다.
    { table: "subway_player_events", col: "id" },
    { table: "subway_reports", col: "id" },
    { table: "subway_player_state", col: "player_id" },
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

export async function deleteAllRows(
  supabase: SupabaseClient,
  table: string,
  col: string
): Promise<string | null> {
  // col 이 NULL 이 아닌 모든 행 = 전체 행. (uuid/bigint 등 컬럼 타입에 무관)
  const { error } = await supabase.from(table).delete().not(col, "is", null);
  return error ? `${table}: ${error.message}` : null;
}

// 🔴/🟠 게임별 설정/시드 복원 (DELETE 가 아니라 초기값 upsert/update — 행을 지우면 게임이 부팅되지 않음)
export async function restoreSubwayConfig(
  supabase: SupabaseClient
): Promise<string[]> {
  const errors: string[] = [];
  // subway 는 별도 phase 싱글톤이 없고, 전역 타이머만 game_state 에 있다.
  const { error } = await supabase
    .from("game_state")
    .update({ timer_start: false, timer_start_at: null, pause_at: null })
    .eq("id", 1);
  if (error) errors.push(`game_state(timer): ${error.message}`);
  return errors;
}

export async function restoreMafiaConfig(
  supabase: SupabaseClient
): Promise<string[]> {
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

export async function restoreDefenseConfig(
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

export async function restoreGlobalConfig(
  supabase: SupabaseClient
): Promise<string[]> {
  const errors: string[] = [];
  // game_state 싱글톤 복원: 3게임 통합 빌드(main)에서는 초기화 후 'ready' 로 두고
  // GM 이 대시보드의 게임 상태 선택기로 다음 게임을 직접 연다.
  // (단일 게임 분리 빌드에서는 이 값을 해당 게임으로 바꿔 둔다.)
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

// ───────────────────────────────────────────────────────────────────────────
// 이상교통(8번 출구) 플레이 데이터 아카이브
// reset 으로 런타임이 지워지기 전에, 한 판(session) 단위의 집계 지표를
// 영구 테이블 `subway_play_records` 에 적재한다. 이 테이블은 RUNTIME_TABLES 에
// 포함되지 않으므로 어떤 reset 으로도 삭제되지 않는다(=보존).
// ───────────────────────────────────────────────────────────────────────────

type SubwayEventRow = {
  player_id: string | null;
  event_type: string;
  event_value: Record<string, unknown> | null;
  created_at: string;
};

type ArchiveOutcome = { fatal: string[]; warnings: string[] };

function groupOf(location: unknown): string | null {
  if (typeof location !== "string") return null;
  const [g] = location.split("/");
  return g || null;
}

export async function archiveSubway(
  supabase: SupabaseClient
): Promise<ArchiveOutcome> {
  const fatal: string[] = [];
  const warnings: string[] = [];

  // 1) 현재 판의 원천 데이터 적재
  const stateRes = await supabase
    .from("subway_player_state")
    .select(
      "player_id, exit_number, reset_count, is_finished, finished_rank, updated_at, players(nickname)"
    );
  if (stateRes.error) {
    // 상태 테이블 조회 실패는 보존 불가 → 안전하게 중단
    fatal.push(`subway_player_state 조회 실패: ${stateRes.error.message}`);
    return { fatal, warnings };
  }
  const states = (stateRes.data ?? []) as {
    player_id: string;
    exit_number: number;
    reset_count: number;
    is_finished: boolean;
    finished_rank: number | null;
    updated_at: string;
    players?: { nickname?: string | null } | null;
  }[];

  // 보존할 플레이가 없으면 조용히 종료
  if (states.length === 0) return { fatal, warnings };

  const eventsRes = await supabase
    .from("subway_player_events")
    .select("player_id, event_type, event_value, created_at");
  const events = (eventsRes.error ? [] : (eventsRes.data ?? [])) as SubwayEventRow[];

  const reportsRes = await supabase
    .from("subway_reports")
    .select("player_id");
  const reports = (reportsRes.error ? [] : (reportsRes.data ?? [])) as {
    player_id: string | null;
  }[];

  const gameRes = await supabase
    .from("game_state")
    .select("timer_start_at")
    .eq("id", 1)
    .maybeSingle();
  const timerStartMs = gameRes.data?.timer_start_at
    ? new Date(gameRes.data.timer_start_at as string).getTime()
    : null;

  // 플레이어별 이벤트/신고 인덱싱
  const eventsByPlayer = new Map<string, SubwayEventRow[]>();
  for (const ev of events) {
    if (!ev.player_id) continue;
    const list = eventsByPlayer.get(ev.player_id) ?? [];
    list.push(ev);
    eventsByPlayer.set(ev.player_id, list);
  }
  const reportsByPlayer = new Map<string, number>();
  for (const r of reports) {
    if (!r.player_id) continue;
    reportsByPlayer.set(r.player_id, (reportsByPlayer.get(r.player_id) ?? 0) + 1);
  }

  const sessionId = randomUUID();

  // 2) 플레이어별 지표 계산
  const records = states.map((s) => {
    const evs = eventsByPlayer.get(s.player_id) ?? [];
    const moves = evs.filter((e) => e.event_type === "move");

    let correct = 0;
    let forward = 0;
    let back = 0;
    let tooFast = 0;
    const wrongByReason: Record<string, number> = {};
    const wrongByGroup: Record<string, number> = {};
    for (const m of moves) {
      const v = m.event_value ?? {};
      const result = v.result as string | undefined;
      const direction = v.direction as string | undefined;
      const reason = v.reason as string | undefined;
      const grp = (v.location_group as string | undefined) ?? null;
      if (direction === "forward") forward += 1;
      else if (direction === "back") back += 1;
      if (result === "correct") {
        correct += 1;
      } else {
        if (reason) wrongByReason[reason] = (wrongByReason[reason] ?? 0) + 1;
        if (grp) wrongByGroup[grp] = (wrongByGroup[grp] ?? 0) + 1;
      }
      if (reason === "too_fast") tooFast += 1;
    }

    const visitByGroup: Record<string, number> = {};
    for (const e of evs) {
      if (e.event_type !== "enter_location") continue;
      const g = groupOf((e.event_value ?? {}).location);
      if (g) visitByGroup[g] = (visitByGroup[g] ?? 0) + 1;
    }

    const ruleIds = new Set<number>();
    for (const e of evs) {
      if (e.event_type !== "rule_opened") continue;
      const id = (e.event_value ?? {}).rule_id;
      if (typeof id === "number") ruleIds.add(id);
    }

    // 탈출까지 걸린 시간: 8번 출구 도달 move 시각 - 전역 타이머 시작 시각
    let clearSeconds: number | null = null;
    if (s.is_finished && s.finished_rank != null && timerStartMs != null) {
      const finishMove = moves.find(
        (m) => Number((m.event_value ?? {}).to_exit) >= 8
      );
      const finishMs = finishMove
        ? new Date(finishMove.created_at).getTime()
        : new Date(s.updated_at).getTime();
      if (!Number.isNaN(finishMs)) {
        clearSeconds = Math.max(0, Math.round((finishMs - timerStartMs) / 1000));
      }
    }

    return {
      session_id: sessionId,
      player_id: s.player_id,
      nickname: s.players?.nickname ?? null,
      final_exit: s.exit_number,
      reset_count: s.reset_count,
      is_finished: s.is_finished,
      finished_rank: s.finished_rank,
      clear_seconds: clearSeconds,
      total_moves: moves.length,
      correct_moves: correct,
      wrong_moves: moves.length - correct,
      forward_moves: forward,
      back_moves: back,
      too_fast_count: tooFast,
      rules_discovered: ruleIds.size,
      rules_discovered_ids: [...ruleIds].sort((a, b) => a - b),
      reports_submitted: reportsByPlayer.get(s.player_id) ?? 0,
      wrong_by_reason: wrongByReason,
      wrong_by_group: wrongByGroup,
      visit_by_group: visitByGroup,
    };
  });

  // 3) 영구 테이블에 적재
  const insertRes = await supabase.from("subway_play_records").insert(records);
  if (insertRes.error) {
    if (isMissingTableError(insertRes.error)) {
      warnings.push(
        "subway_play_records 테이블이 없어 플레이 데이터를 보존하지 못했습니다. (DDL 적용 필요)"
      );
    } else {
      fatal.push(`subway_play_records 적재 실패: ${insertRes.error.message}`);
    }
  }

  return { fatal, warnings };
}

export type ResetResult = {
  ok: boolean;
  errors: string[];
  warnings?: string[];
  badRequest?: string; // 잘못된 입력(400) 메시지
};

/**
 * 초기화 실행기.
 *   scope="game"    + game → 해당 게임 런타임만 삭제 + 해당 게임 설정 초기화 (플레이어 유지)
 *   scope="runtime"        → 모든 게임 런타임 삭제 + 전체 설정 초기화 (플레이어 유지)
 *   scope="all"            → 모든 런타임 + 플레이어 전체 삭제 + 전체 설정 초기화 (완전 clean slate)
 */
export async function resetScope(
  supabase: SupabaseClient,
  scope: string | undefined,
  game?: string
): Promise<ResetResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 입력 검증 먼저 (삭제/아카이브 전에)
  if (scope === "game" && (!game || !RUNTIME_TABLES[game])) {
    return {
      ok: false,
      errors,
      badRequest: "game 값이 올바르지 않습니다. (subway|mafia|defense|vote)",
    };
  }
  if (
    scope !== "game" &&
    scope !== "runtime" &&
    scope !== "all"
  ) {
    return {
      ok: false,
      errors,
      badRequest: "scope 가 필요합니다. (game|runtime|all)",
    };
  }

  // 이상교통 런타임을 지우는 모든 경로에서, 삭제 전에 플레이 데이터를 보존한다.
  const wipesSubway =
    scope === "runtime" ||
    scope === "all" ||
    (scope === "game" && game === "subway");
  if (wipesSubway) {
    const arch = await archiveSubway(supabase);
    // 보존이 불가능(예상치 못한 오류)하면 데이터 유실을 막기 위해 삭제를 중단한다.
    if (arch.fatal.length) {
      return { ok: false, errors: arch.fatal };
    }
    warnings.push(...arch.warnings);
  }

  if (scope === "game") {
    // game 값은 위에서 검증됨
    for (const { table, col } of RUNTIME_TABLES[game as string]) {
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
      // GM 메모(gm_memos)도 전체 초기화 시 함께 삭제
      const memoErr = await deleteAllRows(supabase, "gm_memos", "id");
      if (memoErr) errors.push(memoErr);
    }

    // 전체 설정 초기화 (싱글톤/시드 복원)
    errors.push(...(await restoreGlobalConfig(supabase)));
    errors.push(...(await restoreMafiaConfig(supabase)));
    errors.push(...(await restoreDefenseConfig(supabase)));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: warnings.length ? warnings : undefined,
  };
}
