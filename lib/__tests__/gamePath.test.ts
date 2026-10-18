import { describe, expect, it } from "vitest";
import { gamePath, guardRedirect } from "@/lib/gamePath";

describe("ITER6 C1 — 참가자 화면 가드 이동", () => {
  it("게임 → 경로", () => {
    expect(gamePath("mafia")).toBe("/mafia");
    expect(gamePath("defense")).toBe("/defense");
    expect(gamePath("mafia_tutorial")).toBeNull();
    expect(gamePath(null)).toBeNull();
  });
  it("세션 없음 → 입장 화면(막힌 화면 아님)", () => {
    expect(guardRedirect({ isLoggedIn: false, roomGame: null, allowGames: ["defense"] })).toBe("/");
    expect(guardRedirect({ isLoggedIn: false, roomGame: "defense", allowGames: ["defense"] })).toBe("/");
  });
  it("다른 게임 방 세션 → 그 방의 게임 화면", () => {
    expect(guardRedirect({ isLoggedIn: true, roomGame: "mafia", allowGames: ["defense"] })).toBe("/mafia");
    expect(guardRedirect({ isLoggedIn: true, roomGame: "defense", allowGames: ["mafia", "mafia_tutorial"] })).toBe("/defense");
  });
  it("게임을 모르면 입장 화면", () => {
    expect(guardRedirect({ isLoggedIn: true, roomGame: null, allowGames: ["defense"] })).toBe("/");
  });
  it("가드는 /locked 를 반환하지 않는다", () => {
    for (const isLoggedIn of [true, false])
      for (const g of [null, "mafia", "defense", "subway", "x"])
        expect(guardRedirect({ isLoggedIn, roomGame: g, allowGames: ["defense"] })).not.toBe("/locked");
  });
});
