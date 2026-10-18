import { describe, expect, it } from "vitest";
import { PHONE_TOGGLE_DEFAULTS, phoneTogglesFromRow } from "@/lib/phoneToggles";

describe("ITER6 B5·C5 — 참가자 폰 토글", () => {
  it("기본값은 둘 다 켜짐", () => {
    expect(PHONE_TOGGLE_DEFAULTS).toEqual({ phoneLogs: true, phoneRemainingCount: true });
  });
  it("false 로 명시된 것만 끈다(null·없음·이상한 값은 켜짐 — 컬럼 없는 DB에서도 500 없이 기본값)", () => {
    expect(phoneTogglesFromRow(null)).toEqual({ phoneLogs: true, phoneRemainingCount: true });
    expect(phoneTogglesFromRow({})).toEqual({ phoneLogs: true, phoneRemainingCount: true });
    expect(phoneTogglesFromRow({ phone_logs: null, phone_remaining_count: "no" })).toEqual({ phoneLogs: true, phoneRemainingCount: true });
    expect(phoneTogglesFromRow({ phone_logs: false, phone_remaining_count: true })).toEqual({ phoneLogs: false, phoneRemainingCount: true });
    expect(phoneTogglesFromRow({ phone_logs: true, phone_remaining_count: false })).toEqual({ phoneLogs: true, phoneRemainingCount: false });
  });
});
