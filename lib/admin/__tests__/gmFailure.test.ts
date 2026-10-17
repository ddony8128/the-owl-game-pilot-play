import { describe, expect, it } from "vitest";
import { GM_NETWORK_ERROR_TEXT, describeGmFailure } from "@/lib/admin/gmFailure";

// Iteration 5 WS-A 1: 409 는 사유를 구분해 보여 준다("이미 넘어갔습니다(다른 창?)" 등).
describe("describeGmFailure", () => {
  it("네트워크 오류(status null)", () => {
    expect(describeGmFailure({ status: null })).toBe(GM_NETWORK_ERROR_TEXT);
  });
  it("409 이미 넘어감 / 뒤처진 화면", () => {
    expect(describeGmFailure({ status: 409, reason: "already_advanced", error: "x" })).toContain("이미 넘어갔습니다");
    expect(describeGmFailure({ status: 409, reason: "stale_from" })).toContain("다른 창");
  });
  it("409 종료된 방", () => {
    expect(describeGmFailure({ status: 409, reason: "room_ended" })).toContain("종료된 방");
  });
  it("409 되돌리기 불가는 서버 사유를 붙인다", () => {
    expect(describeGmFailure({ status: 409, reason: "not_rewindable", error: "제출이 2건 있어" })).toBe(
      "되돌릴 수 없습니다: 제출이 2건 있어",
    );
  });
  it("409 인원 부족은 서버 문구 그대로", () => {
    expect(describeGmFailure({ status: 409, reason: "too_few_players", error: "5명 이상" })).toBe("5명 이상");
  });
  it("400·5xx 는 상태별 접두", () => {
    expect(describeGmFailure({ status: 400, error: "round is required" })).toBe("잘못된 요청: round is required");
    expect(describeGmFailure({ status: 500, error: "boom" })).toContain("서버 오류 (500): boom");
    expect(describeGmFailure({ status: 503 })).toContain("마이그레이션");
  });
});
