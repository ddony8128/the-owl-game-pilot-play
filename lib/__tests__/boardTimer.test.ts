import { describe, expect, it } from "vitest";
import { clockSkewMs, computeBoardTimer, formatClock } from "../boardTimer";

const T0 = Date.parse("2026-10-17T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("computeBoardTimer — 보드 카운트다운", () => {
  it("응답 없음 / 타이머 없는 단계(totalSeconds 0) → hasTimer false", () => {
    expect(computeBoardTimer(null, T0).hasTimer).toBe(false);
    expect(
      computeBoardTimer({ timerStart: false, timerStartAt: null, pauseAt: null, totalSeconds: 0 }, T0),
    ).toMatchObject({ hasTimer: false, remainingSeconds: 0, isRunning: false });
  });

  it("시작 전 → 총 시간 그대로, notStarted", () => {
    const s = computeBoardTimer(
      { timerStart: false, timerStartAt: null, pauseAt: null, totalSeconds: 300 },
      T0,
    );
    expect(s).toMatchObject({ hasTimer: true, remainingSeconds: 300, isRunning: false, notStarted: true });
  });

  it("실행 중 → 경과한 만큼 줄고, 0이 되면 isRunning false", () => {
    const api = { timerStart: true, timerStartAt: iso(T0), pauseAt: null, totalSeconds: 300 };
    expect(computeBoardTimer(api, T0 + 65_000)).toMatchObject({ remainingSeconds: 235, isRunning: true });
    expect(computeBoardTimer(api, T0 + 300_000)).toMatchObject({ remainingSeconds: 0, isRunning: false });
    expect(computeBoardTimer(api, T0 + 999_000).remainingSeconds).toBe(0);
  });

  it("일시정지 → pause 시점까지의 경과만 반영, isPaused", () => {
    const api = {
      timerStart: false,
      timerStartAt: iso(T0),
      pauseAt: iso(T0 + 40_000),
      totalSeconds: 300,
    };
    expect(computeBoardTimer(api, T0 + 500_000)).toMatchObject({
      remainingSeconds: 260,
      isRunning: false,
      isPaused: true,
      notStarted: false,
    });
  });

  it("보드 PC 시계가 서버보다 2분 느려도 skew 보정으로 같은 숫자", () => {
    const api = { timerStart: true, timerStartAt: iso(T0), pauseAt: null, totalSeconds: 300, serverNow: iso(T0 + 60_000) };
    const boardClockAtReceipt = T0 + 60_000 - 120_000; // 2분 느린 PC
    const skew = clockSkewMs(api, boardClockAtReceipt);
    expect(skew).toBe(120_000);
    expect(computeBoardTimer(api, boardClockAtReceipt, skew).remainingSeconds).toBe(240);
    // 보정 없이 계산하면 틀린 값(300)이 나온다 — 음성 대조
    expect(computeBoardTimer(api, boardClockAtReceipt, 0).remainingSeconds).toBe(300);
  });

  it("serverNow 가 없거나 깨지면 skew 0", () => {
    expect(clockSkewMs(null, T0)).toBe(0);
    expect(clockSkewMs({ timerStart: false, timerStartAt: null, pauseAt: null, totalSeconds: 1 }, T0)).toBe(0);
    expect(
      clockSkewMs({ timerStart: false, timerStartAt: null, pauseAt: null, totalSeconds: 1, serverNow: "x" }, T0),
    ).toBe(0);
  });

  it("깨진 시각 문자열 → 시작 전 취급(예외 없음)", () => {
    expect(
      computeBoardTimer({ timerStart: true, timerStartAt: "not-a-date", pauseAt: null, totalSeconds: 60 }, T0),
    ).toMatchObject({ remainingSeconds: 60, isRunning: false });
  });
});

describe("formatClock", () => {
  it("MM:SS, 한 시간 넘으면 H:MM:SS, 음수는 00:00", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(5)).toBe("00:05");
    expect(formatClock(300)).toBe("05:00");
    expect(formatClock(3661)).toBe("1:01:01");
    expect(formatClock(-3)).toBe("00:00");
  });
});
