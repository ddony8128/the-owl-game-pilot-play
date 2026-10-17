import type { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeTimerConfig,
  promotePending,
  type TimerConfig,
} from "@/lib/admin/timerConfig";
import { isMissingRelationError } from "@/lib/admin/gmLog";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export const TIMER_CONFIG_MIGRATION = "supabase/migrations/2026-10-17-iter5-gm.sql";

export type TimerRow = {
  room_code: string;
  timer_start: boolean | null;
  timer_start_at: string | null;
  pause_at: string | null;
  timer_config: unknown;
};

/**
 * game_state 의 타이머 열 + timer_config 를 읽는다. timer_config 컬럼이 없는 DB(마이그레이션 전)면
 * columnMissing=true 로 알리고 기본값 설정으로 동작한다(조회·시작/정지는 막지 않는다).
 */
export async function readTimerRow(
  supabase: SupabaseClient,
  room: string,
): Promise<{ row: TimerRow | null; config: TimerConfig; columnMissing: boolean }> {
  const full = await supabase
    .from("game_state")
    .select("room_code, timer_start, timer_start_at, pause_at, timer_config")
    .eq("room_code", room)
    .maybeSingle();
  if (!full.error) {
    const row = (full.data ?? null) as TimerRow | null;
    return { row, config: normalizeTimerConfig(row?.timer_config), columnMissing: false };
  }
  if (!isMissingRelationError(full.error)) {
    throw new Error(full.error.message);
  }
  const basic = await supabase
    .from("game_state")
    .select("room_code, timer_start, timer_start_at, pause_at")
    .eq("room_code", room)
    .maybeSingle();
  if (basic.error) throw new Error(basic.error.message);
  const row = basic.data ? ({ ...(basic.data as Omit<TimerRow, "timer_config">), timer_config: null } as TimerRow) : null;
  return { row, config: normalizeTimerConfig(null), columnMissing: true };
}

export async function writeTimerConfig(
  supabase: SupabaseClient,
  room: string,
  config: TimerConfig,
): Promise<void> {
  const { error } = await supabase
    .from("game_state")
    .update({ timer_config: config })
    .eq("room_code", room);
  if (error) throw new Error(error.message);
}

/** 예약(pending)된 키를 적용(durations)으로 올린다. 컬럼이 없으면 아무 것도 하지 않는다. */
export async function promoteTimerPending(
  supabase: SupabaseClient,
  room: string,
  key: string,
): Promise<number | null> {
  const { config, columnMissing } = await readTimerRow(supabase, room);
  if (columnMissing) return null;
  const { cfg, promoted } = promotePending(config, key);
  if (promoted == null) return null;
  await writeTimerConfig(supabase, room, cfg);
  return promoted;
}

export const DEFENSE_TIMER_KEY = "defense";

export function promoteDefenseTimerPending(supabase: SupabaseClient, room: string) {
  return promoteTimerPending(supabase, room, DEFENSE_TIMER_KEY);
}
