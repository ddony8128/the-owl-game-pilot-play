import { describe, expect, it } from "vitest";
import {
  RULE_VIDEOS,
  chapterAt,
  chaptersOf,
  durationOf,
  isRuleVideoId,
  jumpChaptersOf,
} from "@/lib/ruleVideos";
import { isMissingColumnError, validateVideoPatch } from "@/lib/boardVideo";

describe("룰 영상 정의", () => {
  it("영상 id는 defense · mafia 두 개", () => {
    expect(RULE_VIDEOS.map((v) => v.id)).toEqual(["defense", "mafia"]);
    expect(isRuleVideoId("defense")).toBe(true);
    expect(isRuleVideoId("mafia")).toBe(true);
    expect(isRuleVideoId("rules")).toBe(false);
    expect(isRuleVideoId(null)).toBe(false);
  });

  it("장 목록 = 정본 1.3 (+ 끝)", () => {
    expect(jumpChaptersOf("defense").map((c) => c.label)).toEqual([
      "목표",
      "카드와 행동",
      "몬스터와 대기열",
      "전투 처리",
      "라운드 종료와 도망",
      "종료와 순위",
      "정리",
    ]);
    expect(jumpChaptersOf("mafia").map((c) => c.label)).toEqual([
      "목표",
      "라운드 흐름",
      "직업 경매",
      "직업 9종",
      "주식 거래와 주가 변동",
      "투표와 경제사범",
      "종료와 순위",
      "정리",
    ]);
    expect(chaptersOf("mafia").at(-1)?.label).toBe("끝");
  });

  it("장 시작 초는 증가하고 길이는 목표 범위", () => {
    for (const id of ["defense", "mafia"] as const) {
      const xs = chaptersOf(id).map((c) => c.atSec);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    }
    expect(durationOf("defense")).toBeGreaterThan(192);
    expect(durationOf("defense")).toBeLessThan(288);
    expect(durationOf("mafia")).toBeGreaterThan(330);
    expect(durationOf("mafia")).toBeLessThan(360);
  });

  it("chapterAt은 그 초가 속한 장", () => {
    const second = jumpChaptersOf("mafia")[1]!;
    expect(chapterAt("mafia", second.atSec + 1)).toBe(second.label);
    expect(chapterAt("mafia", 0)).toBe(null);
  });
});

describe("validateVideoPatch", () => {
  const defenseRoom = { game: "defense", status: "active" };
  it("게임과 다른 영상은 400", () => {
    expect(validateVideoPatch(defenseRoom, { video: "mafia" })).toMatchObject({ ok: false, status: 400 });
  });
  it("알 수 없는 영상은 400", () => {
    expect(validateVideoPatch(defenseRoom, { video: "rules" })).toMatchObject({ ok: false, status: 400 });
  });
  it("종료된 방은 409", () => {
    expect(validateVideoPatch({ game: "defense", status: "ended" }, { video: "defense" })).toMatchObject({
      ok: false,
      status: 409,
    });
  });
  it("같은 게임 영상 + seek", () => {
    expect(validateVideoPatch(defenseRoom, { video: "defense", seekSec: 23.7 })).toEqual({
      ok: true,
      video: "defense",
      seekSec: 23,
    });
  });
  it("seek 범위 밖은 400, null은 정지", () => {
    expect(validateVideoPatch(defenseRoom, { video: "defense", seekSec: 99999 })).toMatchObject({ ok: false });
    expect(validateVideoPatch(defenseRoom, { video: "defense", seekSec: -1 })).toMatchObject({ ok: false });
    expect(validateVideoPatch(defenseRoom, { video: null })).toEqual({ ok: true, video: null, seekSec: null });
  });
  it("컬럼 없음 오류 판별", () => {
    expect(isMissingColumnError({ code: "42703", message: "column rooms.board_video does not exist" })).toBe(true);
    expect(isMissingColumnError({ code: "23505", message: "duplicate" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});
