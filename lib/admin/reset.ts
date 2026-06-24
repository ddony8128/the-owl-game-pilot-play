import { randomUUID } from "crypto";
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  MAFIA_STOCK_SEED,
  DEFENSE_MONSTER_COUNT_SEED,
  RULE_KEYS,
} from "@/lib/rooms";

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
// 멀티룸 모델에서는 모든 런타임 테이블에 room_code 컬럼이 있으므로,
// 해당 방(room)의 행만 지운다. (다른 방의 데이터는 보존)
// 주의: FK 가 있는 테이블은 "참조하는 쪽"을 먼저 지워야 한다.
export const RUNTIME_TABLES: Record<string, string[]> = {
  subway: [
    // 자식(state 를 참조) → 부모(state) 순서로 삭제해야 FK 위반이 없다.
    // events/reports 가 subway_player_state(player_id) 를 참조하므로 먼저 비운다.
    "subway_player_events",
    "subway_reports",
    "subway_player_state",
  ],
  mafia: [
    "mafia_actions",
    "mafia_player_snapshots",
    "mafia_votes",
    "mafia_public_logs",
    "mafia_ability_results",
    "mafia_stock_history",
    "mafia_player_state",
  ],
  defense: [
    // 참조하는 쪽(snapshot/action)을 먼저, 참조되는 monster_instance 를 마지막에 삭제
    "defense_monster_snapshot",
    "defense_action",
    "defense_card_state",
    "defense_score",
    "defense_score_snapshot",
    "defense_player_log",
    "defense_monster_instance",
  ],
  vote: ["player_votes"],
};

// 주어진 방(room)의 행만 삭제한다. (room_code 로 스코핑)
export async function deleteRoomRows(
  supabase: SupabaseClient,
  table: string,
  room: string
): Promise<string | null> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("room_code", room);
  return error ? `${table}: ${error.message}` : null;
}

// 🔴/🟠 게임별 설정/시드 복원 (DELETE 가 아니라 초기값 upsert/update — 행을 지우면 게임이 부팅되지 않음)
// 모든 복원은 해당 방(room)의 행만 대상으로 한다.
export async function restoreSubwayConfig(
  supabase: SupabaseClient,
  room: string
): Promise<string[]> {
  const errors: string[] = [];
  // subway 는 별도 phase 싱글톤이 없고, 전역 타이머만 game_state 에 있다.
  const { error } = await supabase
    .from("game_state")
    .update({ timer_start: false, timer_start_at: null, pause_at: null })
    .eq("room_code", room);
  if (error) errors.push(`game_state(timer): ${error.message}`);
  return errors;
}

export async function restoreMafiaConfig(
  supabase: SupabaseClient,
  room: string
): Promise<string[]> {
  const errors: string[] = [];
  const phase = await supabase
    .from("mafia_phase_state")
    .upsert(
      { room_code: room, round_number: 0, phase: "prepare" },
      { onConflict: "room_code" }
    );
  if (phase.error) errors.push(`mafia_phase_state: ${phase.error.message}`);

  const stocks = await supabase.from("mafia_stock_state").upsert(
    MAFIA_STOCK_SEED.map((s) => ({ ...s, room_code: room })),
    { onConflict: "room_code,stock_key" }
  );
  if (stocks.error) errors.push(`mafia_stock_state: ${stocks.error.message}`);
  return errors;
}

export async function restoreDefenseConfig(
  supabase: SupabaseClient,
  room: string
): Promise<string[]> {
  const errors: string[] = [];
  const phase = await supabase
    .from("defense_phase_state")
    .upsert({ room_code: room, round: 0 }, { onConflict: "room_code" });
  if (phase.error) errors.push(`defense_phase_state: ${phase.error.message}`);

  const counts = DEFENSE_MONSTER_COUNT_SEED.map((m) => ({
    room_code: room,
    id: m.id,
    count: m.count,
    base_count: m.count, // NOT NULL — 시드 기준값
  }));
  const countRes = await supabase
    .from("defense_monster_count")
    .upsert(counts, { onConflict: "room_code,id" });
  if (countRes.error)
    errors.push(`defense_monster_count: ${countRes.error.message}`);
  return errors;
}

export async function restoreGlobalConfig(
  supabase: SupabaseClient,
  room: string
): Promise<string[]> {
  const errors: string[] = [];
  // game_state 는 방별 1행(PK room_code). 초기화 후 'ready' 로 두고
  // GM 이 대시보드의 게임 상태 선택기로 다음 게임을 직접 연다.
  const game = await supabase.from("game_state").upsert(
    {
      room_code: room,
      active_game: "ready",
      timer_start: false,
      timer_start_at: null,
      pause_at: null,
    },
    { onConflict: "room_code" }
  );
  if (game.error) errors.push(`game_state: ${game.error.message}`);

  // rules_state 는 행을 보존하고 전부 닫기만 한다(행을 지우면 규칙 기능이 영구히 깨짐).
  // 누락된 룰 키가 있을 수 있으므로 해당 방의 모든 룰 키를 닫힌 상태로 보장한다.
  const rules = await supabase.from("rules_state").upsert(
    RULE_KEYS.map((rule_key) => ({
      room_code: room,
      rule_key,
      is_open: false,
    })),
    { onConflict: "room_code,rule_key" }
  );
  if (rules.error) errors.push(`rules_state: ${rules.error.message}`);
  return errors;
}

// ───────────────────────────────────────────────────────────────────────────
// 이상교통(8번 출구) 플레이 데이터 아카이브 (방 단위)
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
  supabase: SupabaseClient,
  room: string
): Promise<ArchiveOutcome> {
  const fatal: string[] = [];
  const warnings: string[] = [];

  // 1) 현재 판의 원천 데이터 적재 (해당 방만)
  const stateRes = await supabase
    .from("subway_player_state")
    .select(
      "player_id, exit_number, reset_count, is_finished, finished_rank, updated_at, players(nickname)"
    )
    .eq("room_code", room);
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
    .select("player_id, event_type, event_value, created_at")
    .eq("room_code", room);
  const events = (eventsRes.error ? [] : (eventsRes.data ?? [])) as SubwayEventRow[];

  const reportsRes = await supabase
    .from("subway_reports")
    .select("player_id")
    .eq("room_code", room);
  const reports = (reportsRes.error ? [] : (reportsRes.data ?? [])) as {
    player_id: string | null;
  }[];

  const gameRes = await supabase
    .from("game_state")
    .select("timer_start_at")
    .eq("room_code", room)
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
      room_code: room,
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

// ───────────────────────────────────────────────────────────────────────────
// 마피아 / 디펜스 — 원본 행 전체 보존 아카이브 (방 단위)
//
// 리플레이·밸런스 패치 분석을 위해, reset 으로 런타임이 지워지기 전에 해당 방/게임의
// 모든 런타임/설정 테이블 행을 "원본 그대로(JSONB)" 한 판(session) 단위로 적재한다.
// 두 테이블 모두 RUNTIME_TABLES 에 없으므로 어떤 reset 으로도 삭제되지 않는다(=영구 보존).
// DDL 미적용 환경에서는 경고만 남기고 reset 자체는 진행한다.
// ───────────────────────────────────────────────────────────────────────────

// 게임별로 보존할 테이블 목록. 런타임(RUNTIME_TABLES)에 더해 리플레이에 필요한
// 설정/상태 행(주가·페이즈·몬스터 수 등)까지 포함한다.
const ARCHIVE_TABLES: Record<string, string[]> = {
  mafia: [...RUNTIME_TABLES.mafia, "mafia_phase_state", "mafia_stock_state"],
  defense: [
    ...RUNTIME_TABLES.defense,
    "defense_phase_state",
    "defense_monster_count",
  ],
};

type ArchiveRow = {
  session_id: string;
  room_code: string;
  game: string;
  source_table: string;
  row_data: Record<string, unknown>;
};

async function archiveGameRuntime(
  supabase: SupabaseClient,
  game: string,
  room: string,
  tables: string[]
): Promise<ArchiveOutcome> {
  const fatal: string[] = [];
  const warnings: string[] = [];

  const sessionId = randomUUID();
  const rows: ArchiveRow[] = [];
  let playerCount = 0;

  for (const table of tables) {
    const res = await supabase.from(table).select("*").eq("room_code", room);
    if (res.error) {
      // 아직 없는 테이블(미적용 게임)은 보존에서 제외하고 계속 진행한다.
      if (isMissingTableError(res.error)) {
        warnings.push(`${table} 테이블이 없어 보존에서 제외했습니다.`);
        continue;
      }
      // 그 외 조회 실패는 데이터 유실 위험 → 안전하게 중단
      fatal.push(`${table} 조회 실패: ${res.error.message}`);
      return { fatal, warnings };
    }
    const data = (res.data ?? []) as Record<string, unknown>[];
    if (table.endsWith("player_state")) playerCount = data.length;
    for (const row of data) {
      rows.push({
        session_id: sessionId,
        room_code: room,
        game,
        source_table: table,
        row_data: row,
      });
    }
  }

  // 보존할 데이터가 전혀 없으면 조용히 종료
  if (rows.length === 0) return { fatal, warnings };

  // 대량 insert 는 청크로 나눠 적재(요청 크기 한계 회피)
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const insertRes = await supabase
      .from("game_runtime_archive")
      .insert(rows.slice(i, i + CHUNK));
    if (insertRes.error) {
      if (isMissingTableError(insertRes.error)) {
        warnings.push(
          "game_runtime_archive 테이블이 없어 플레이 데이터를 보존하지 못했습니다. (DDL 적용 필요)"
        );
        return { fatal, warnings };
      }
      fatal.push(`game_runtime_archive 적재 실패: ${insertRes.error.message}`);
      return { fatal, warnings };
    }
  }

  // 세션 헤더(빠른 목록/요약 조회용). 없거나 실패해도 본문은 이미 보존됐으므로 경고만.
  const sessionRes = await supabase.from("game_play_sessions").insert({
    session_id: sessionId,
    room_code: room,
    game,
    player_count: playerCount,
  });
  if (sessionRes.error && !isMissingTableError(sessionRes.error)) {
    warnings.push(`game_play_sessions 적재 경고: ${sessionRes.error.message}`);
  }

  return { fatal, warnings };
}

export function archiveMafia(
  supabase: SupabaseClient,
  room: string
): Promise<ArchiveOutcome> {
  return archiveGameRuntime(supabase, "mafia", room, ARCHIVE_TABLES.mafia);
}

export function archiveDefense(
  supabase: SupabaseClient,
  room: string
): Promise<ArchiveOutcome> {
  return archiveGameRuntime(supabase, "defense", room, ARCHIVE_TABLES.defense);
}

export type ResetResult = {
  ok: boolean;
  errors: string[];
  warnings?: string[];
  badRequest?: string; // 잘못된 입력(400) 메시지
};

/**
 * 초기화 실행기. 항상 주어진 방(room) 단위로만 동작한다.
 *   scope="game"    + game → 해당 방의 게임 런타임만 삭제 + 해당 게임 설정 초기화 (플레이어 유지)
 *   scope="runtime"        → 해당 방의 모든 게임 런타임 삭제 + 전체 설정 초기화 (플레이어 유지)
 *   scope="all"            → 위 + 해당 방의 플레이어 전체 삭제 (그 방만 clean slate)
 * 다른 방의 플레이어/룸/데이터는 절대 건드리지 않는다.
 */
export async function resetScope(
  supabase: SupabaseClient,
  scope: string | undefined,
  game: string | undefined,
  room: string
): Promise<ResetResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!room) {
    return { ok: false, errors, badRequest: "room 이 필요합니다." };
  }

  // 입력 검증 먼저 (삭제/아카이브 전에)
  if (scope === "game" && (!game || !RUNTIME_TABLES[game])) {
    return {
      ok: false,
      errors,
      badRequest: "game 값이 올바르지 않습니다. (subway|mafia|defense|vote)",
    };
  }
  if (scope !== "game" && scope !== "runtime" && scope !== "all") {
    return {
      ok: false,
      errors,
      badRequest: "scope 가 필요합니다. (game|runtime|all)",
    };
  }

  // 런타임을 지우는 모든 경로에서, 삭제 전에 해당 방/게임의 플레이 데이터를 보존한다.
  // 보존이 불가능(예상치 못한 오류)하면 데이터 유실을 막기 위해 삭제를 중단한다.
  const wipes = (g: string) =>
    scope === "runtime" || scope === "all" || (scope === "game" && game === g);

  if (wipes("subway")) {
    const arch = await archiveSubway(supabase, room);
    if (arch.fatal.length) return { ok: false, errors: arch.fatal };
    warnings.push(...arch.warnings);
  }
  if (wipes("mafia")) {
    const arch = await archiveMafia(supabase, room);
    if (arch.fatal.length) return { ok: false, errors: arch.fatal };
    warnings.push(...arch.warnings);
  }
  if (wipes("defense")) {
    const arch = await archiveDefense(supabase, room);
    if (arch.fatal.length) return { ok: false, errors: arch.fatal };
    warnings.push(...arch.warnings);
  }

  if (scope === "game") {
    // game 값은 위에서 검증됨
    for (const table of RUNTIME_TABLES[game as string]) {
      const err = await deleteRoomRows(supabase, table, room);
      if (err) errors.push(err);
    }
    if (game === "subway")
      errors.push(...(await restoreSubwayConfig(supabase, room)));
    if (game === "mafia")
      errors.push(...(await restoreMafiaConfig(supabase, room)));
    if (game === "defense")
      errors.push(...(await restoreDefenseConfig(supabase, room)));
    // vote 는 별도 설정 없음
  } else if (scope === "runtime" || scope === "all") {
    // 이 방의 모든 게임 런타임 삭제
    for (const tables of Object.values(RUNTIME_TABLES)) {
      for (const table of tables) {
        const err = await deleteRoomRows(supabase, table, room);
        if (err) errors.push(err);
      }
    }

    if (scope === "all") {
      // 자식 런타임을 모두 지운 뒤 이 방의 플레이어만 삭제 (FK 안전, 다른 방 보존)
      const err = await deleteRoomRows(supabase, "players", room);
      if (err) errors.push(err);
      // 이 방의 GM 메모(gm_memos)도 함께 삭제
      const memoErr = await deleteRoomRows(supabase, "gm_memos", room);
      if (memoErr) errors.push(memoErr);
    }

    // 이 방의 설정 초기화 (상태/시드 복원)
    errors.push(...(await restoreGlobalConfig(supabase, room)));
    errors.push(...(await restoreMafiaConfig(supabase, room)));
    errors.push(...(await restoreDefenseConfig(supabase, room)));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: warnings.length ? warnings : undefined,
  };
}
