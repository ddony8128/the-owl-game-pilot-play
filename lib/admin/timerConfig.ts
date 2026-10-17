// 라운드/단계별 타이머 시간 조정 — Iteration 5 WS-A 6(수산시장 DealerTimer 참고).
//
// 저장: game_state.timer_config (jsonb)
//   { durations: { [key]: seconds }, pending: { [key]: seconds } }
//   key = 디펜스 "defense" / 마피아 페이즈 이름("auction" | "trade" | "vote")
//   durations = 지금 적용 중인 전체 시간, pending = "다음 라운드부터" 적용될 시간(리셋/새 시작 시 승격).
// 범위: 1~30분 정수 입력 + ±30초 조정 → 최종 30초 이상 1800초 이하, 30초 단위.
export type TimerConfig = {
  durations: Record<string, number>;
  pending: Record<string, number>;
};

export const TIMER_MIN_SECONDS = 30;
export const TIMER_MAX_SECONDS = 30 * 60;
export const TIMER_STEP_SECONDS = 30;
export const TIMER_MIN_MINUTES = 1;
export const TIMER_MAX_MINUTES = 30;
export const TIMER_PRESET_MINUTES = [3, 5, 8, 10] as const;

export type TimerApplyWhen = "now" | "next";

function cleanMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= TIMER_MIN_SECONDS && v <= TIMER_MAX_SECONDS) {
      out[k] = Math.floor(v);
    }
  }
  return out;
}

/** DB jsonb(또는 null·깨진 값)를 안전한 TimerConfig 로 */
export function normalizeTimerConfig(raw: unknown): TimerConfig {
  if (!raw || typeof raw !== "object") return { durations: {}, pending: {} };
  const r = raw as { durations?: unknown; pending?: unknown };
  return { durations: cleanMap(r.durations), pending: cleanMap(r.pending) };
}

/** 현재 적용 중인 전체 시간(없으면 기본값) */
export function resolveDuration(cfg: TimerConfig, key: string, fallback: number): number {
  const v = cfg.durations[key];
  return typeof v === "number" ? v : fallback;
}

/** 다음 라운드부터 적용될 값(없으면 null) */
export function pendingDuration(cfg: TimerConfig, key: string): number | null {
  const v = cfg.pending[key];
  return typeof v === "number" ? v : null;
}

export type TimerChangeInput = {
  /** 분(정수 1~30) — 프리셋·직접 입력 */
  minutes?: unknown;
  /** 초(30초 단위) — 분 대신 직접 지정 */
  seconds?: unknown;
  /** 현재 전체 시간에 더할 초(±30 의 배수) */
  delta?: unknown;
};

export type TimerChangeResult = { ok: true; total: number } | { ok: false; error: string };

/** 입력(분/초/증감)을 검증해 새 전체 시간을 계산한다. 셋 중 정확히 하나만 받는다. */
export function computeNewTotal(currentTotal: number, input: TimerChangeInput): TimerChangeResult {
  const given = [input.minutes, input.seconds, input.delta].filter((v) => v !== undefined && v !== null);
  if (given.length !== 1) {
    return { ok: false, error: "minutes·seconds·delta 중 하나만 지정하세요." };
  }
  if (input.minutes !== undefined && input.minutes !== null) {
    const m = input.minutes;
    if (typeof m !== "number" || !Number.isInteger(m) || m < TIMER_MIN_MINUTES || m > TIMER_MAX_MINUTES) {
      return { ok: false, error: `분은 ${TIMER_MIN_MINUTES}~${TIMER_MAX_MINUTES} 사이의 정수여야 합니다.` };
    }
    return { ok: true, total: m * 60 };
  }
  if (input.seconds !== undefined && input.seconds !== null) {
    const s = input.seconds;
    if (typeof s !== "number" || !Number.isInteger(s) || s % TIMER_STEP_SECONDS !== 0) {
      return { ok: false, error: `초는 ${TIMER_STEP_SECONDS}초 단위의 정수여야 합니다.` };
    }
    if (s < TIMER_MIN_SECONDS || s > TIMER_MAX_SECONDS) {
      return { ok: false, error: `시간은 ${TIMER_MIN_SECONDS}초 이상 ${TIMER_MAX_SECONDS / 60}분 이하여야 합니다.` };
    }
    return { ok: true, total: s };
  }
  const d = input.delta;
  if (typeof d !== "number" || !Number.isInteger(d) || d === 0 || d % TIMER_STEP_SECONDS !== 0) {
    return { ok: false, error: `증감은 ±${TIMER_STEP_SECONDS}초 단위여야 합니다.` };
  }
  const base = Number.isFinite(currentTotal) ? currentTotal : 0;
  const next = base + d;
  if (next < TIMER_MIN_SECONDS) {
    return { ok: false, error: `${TIMER_MIN_SECONDS}초보다 짧게 줄일 수 없습니다.` };
  }
  if (next > TIMER_MAX_SECONDS) {
    return { ok: false, error: `${TIMER_MAX_SECONDS / 60}분보다 길게 늘릴 수 없습니다.` };
  }
  return { ok: true, total: next };
}

/** 새 전체 시간을 지금(durations) 또는 다음 라운드(pending)에 기록한 새 설정을 돌려준다(불변). */
export function applyTimerChange(
  cfg: TimerConfig,
  key: string,
  total: number,
  when: TimerApplyWhen,
): TimerConfig {
  if (when === "now") {
    // 즉시 적용은 현재 라운드만 바꾼다. "다음 라운드부터" 예약은 별개의 결정이므로 그대로 둔다.
    return { durations: { ...cfg.durations, [key]: total }, pending: { ...cfg.pending } };
  }
  return { durations: { ...cfg.durations }, pending: { ...cfg.pending, [key]: total } };
}

/** 리셋/새 라운드 시작 시 pending[key] 를 durations[key] 로 승격한다. */
export function promotePending(cfg: TimerConfig, key: string): { cfg: TimerConfig; promoted: number | null } {
  const p = cfg.pending[key];
  if (typeof p !== "number") return { cfg, promoted: null };
  const pending = { ...cfg.pending };
  delete pending[key];
  return { cfg: { durations: { ...cfg.durations, [key]: p }, pending }, promoted: p };
}

export function parseApplyWhen(raw: unknown): TimerApplyWhen | null {
  if (raw === undefined || raw === null || raw === "now") return "now";
  if (raw === "next") return "next";
  return null;
}

/** mm:ss 표시 */
export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = (t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
