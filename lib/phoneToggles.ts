import { isMissingColumnError } from "@/lib/boardVideo";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 참가자 폰 편의 기능 토글(ITER6 B5·C5, 2026-10-18 또니).
 *  - phone_logs            : 폰 로그 탭 보이기(마피아·디펜스). 초보 참가자면 켜고, 숙련자 판이면 끈다.
 *  - phone_remaining_count : 디펜스 몬스터 도감의 "남은 수: n마리" 보이기.
 * 기본값은 둘 다 켜짐(true). 컬럼이 없는 DB(마이그레이션 전)에서 조회가 실패하면 true 로 본다 — 500 금지.
 */
export type PhoneToggles = { phoneLogs: boolean; phoneRemainingCount: boolean };
export const PHONE_TOGGLE_DEFAULTS: PhoneToggles = { phoneLogs: true, phoneRemainingCount: true };
export const PHONE_TOGGLES_MIGRATION = "supabase/migrations/2026-10-18-iter6-phone-toggles.sql";

/** DB 행(일부 컬럼이 없거나 null 일 수 있음) → 토글 값. false 로 명시된 것만 끈다. */
export function phoneTogglesFromRow(row: { phone_logs?: unknown; phone_remaining_count?: unknown } | null | undefined): PhoneToggles {
  return {
    phoneLogs: row?.phone_logs === false ? false : true,
    phoneRemainingCount: row?.phone_remaining_count === false ? false : true,
  };
}

type Supabase = ReturnType<typeof createServerSupabaseClient>;

/** 방의 토글 값을 읽는다. 컬럼이 없거나 조회가 실패하면 기본값(둘 다 true) + columnMissing 표시. */
export async function readPhoneToggles(
  supabase: Supabase,
  code: string,
): Promise<PhoneToggles & { columnMissing: boolean }> {
  try {
    const res = await supabase.from("rooms").select("phone_logs, phone_remaining_count").eq("code", code).maybeSingle();
    if (res.error) return { ...PHONE_TOGGLE_DEFAULTS, columnMissing: isMissingColumnError(res.error) || /phone_/.test(res.error.message ?? "") };
    return { ...phoneTogglesFromRow(res.data as Record<string, unknown> | null), columnMissing: false };
  } catch {
    return { ...PHONE_TOGGLE_DEFAULTS, columnMissing: false };
  }
}
