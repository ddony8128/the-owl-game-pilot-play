import { describe, expect, it } from "vitest";
import {
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  TIMER_PRESET_MINUTES,
  applyTimerChange,
  computeNewTotal,
  formatSeconds,
  normalizeTimerConfig,
  parseApplyWhen,
  pendingDuration,
  promotePending,
  resolveDuration,
} from "@/lib/admin/timerConfig";

// Iteration 5 WS-A 6: 1~30분 정수, ±30초, 프리셋 3/5/8/10분, 즉시 적용 / 다음 라운드부터.
describe("computeNewTotal", () => {
  it("분 입력은 1~30 정수만", () => {
    expect(computeNewTotal(300, { minutes: 5 })).toEqual({ ok: true, total: 300 });
    expect(computeNewTotal(300, { minutes: 30 })).toEqual({ ok: true, total: 1800 });
    expect(computeNewTotal(300, { minutes: 0 }).ok).toBe(false);
    expect(computeNewTotal(300, { minutes: 31 }).ok).toBe(false);
    expect(computeNewTotal(300, { minutes: 2.5 }).ok).toBe(false);
    expect(computeNewTotal(300, { minutes: "5" }).ok).toBe(false);
  });

  it("프리셋 3/5/8/10분은 모두 유효", () => {
    for (const m of TIMER_PRESET_MINUTES) {
      expect(computeNewTotal(0, { minutes: m })).toEqual({ ok: true, total: m * 60 });
    }
  });

  it("±30초는 범위 안에서만", () => {
    expect(computeNewTotal(300, { delta: 30 })).toEqual({ ok: true, total: 330 });
    expect(computeNewTotal(300, { delta: -30 })).toEqual({ ok: true, total: 270 });
    expect(computeNewTotal(TIMER_MIN_SECONDS, { delta: -30 }).ok).toBe(false);
    expect(computeNewTotal(TIMER_MAX_SECONDS, { delta: 30 }).ok).toBe(false);
    expect(computeNewTotal(300, { delta: 15 }).ok).toBe(false);
    expect(computeNewTotal(300, { delta: 0 }).ok).toBe(false);
  });

  it("초 입력은 30초 단위·범위 검사", () => {
    expect(computeNewTotal(0, { seconds: 90 })).toEqual({ ok: true, total: 90 });
    expect(computeNewTotal(0, { seconds: 100 }).ok).toBe(false);
    expect(computeNewTotal(0, { seconds: 0 }).ok).toBe(false);
    expect(computeNewTotal(0, { seconds: 1830 }).ok).toBe(false);
  });

  it("minutes·seconds·delta 를 둘 이상 주면 거부(1-17 입력 검증)", () => {
    expect(computeNewTotal(300, { minutes: 5, delta: 30 }).ok).toBe(false);
    expect(computeNewTotal(300, {}).ok).toBe(false);
  });
});

describe("applyTimerChange / promotePending", () => {
  const base = normalizeTimerConfig({ durations: { defense: 300 }, pending: { defense: 600, trade: 480 } });

  it("즉시 적용은 durations 만 바꾸고 다음 라운드 예약은 그대로 둔다", () => {
    const next = applyTimerChange(base, "defense", 240, "now");
    expect(next.durations.defense).toBe(240);
    expect(next.pending.defense).toBe(600);
    expect(next.pending.trade).toBe(480);
    // 불변
    expect(base.durations.defense).toBe(300);
  });

  it("다음 라운드부터는 pending 에만 쌓이고 durations 는 그대로", () => {
    const next = applyTimerChange(base, "defense", 180, "next");
    expect(next.durations.defense).toBe(300);
    expect(next.pending.defense).toBe(180);
    expect(resolveDuration(next, "defense", 999)).toBe(300);
    expect(pendingDuration(next, "defense")).toBe(180);
  });

  it("리셋/새 시작 때 pending 이 durations 로 승격된다", () => {
    const { cfg, promoted } = promotePending(base, "defense");
    expect(promoted).toBe(600);
    expect(cfg.durations.defense).toBe(600);
    expect(cfg.pending.defense).toBeUndefined();
    const again = promotePending(cfg, "defense");
    expect(again.promoted).toBeNull();
    expect(again.cfg).toBe(cfg);
  });

  it("없는 키는 기본값으로", () => {
    expect(resolveDuration(base, "auction", 180)).toBe(180);
    expect(pendingDuration(base, "auction")).toBeNull();
  });
});

describe("normalizeTimerConfig", () => {
  it("null·깨진 값·범위 밖 값을 걸러낸다", () => {
    expect(normalizeTimerConfig(null)).toEqual({ durations: {}, pending: {} });
    expect(normalizeTimerConfig("x")).toEqual({ durations: {}, pending: {} });
    expect(
      normalizeTimerConfig({ durations: { defense: 10, trade: 600, bad: "600" }, pending: { vote: 99999 } }),
    ).toEqual({ durations: { trade: 600 }, pending: {} });
  });
});

describe("parseApplyWhen / formatSeconds", () => {
  it("now 기본, next 허용, 그 외 null", () => {
    expect(parseApplyWhen(undefined)).toBe("now");
    expect(parseApplyWhen("now")).toBe("now");
    expect(parseApplyWhen("next")).toBe("next");
    expect(parseApplyWhen("later")).toBeNull();
  });
  it("mm:ss", () => {
    expect(formatSeconds(300)).toBe("05:00");
    expect(formatSeconds(90)).toBe("01:30");
    expect(formatSeconds(-5)).toBe("00:00");
  });
});
