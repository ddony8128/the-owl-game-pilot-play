import { describe, expect, it } from "vitest";
import { earlyEndSentence, finalSummaryFor } from "@/lib/defense/finalSummary";

const rows = [
  { playerId: "a", nickname: "하늘", points: 12, rank: 1, tieCount: 1 },
  { playerId: "b", nickname: "바다", points: 9, rank: 2, tieCount: 2 },
  { playerId: "c", nickname: "구름", points: 9, rank: 2, tieCount: 2 },
  { playerId: "d", nickname: "바람", points: 0, rank: 4, tieCount: 1 },
];

describe("finalSummaryFor", () => {
  it("내 행의 점수·등수·공동 여부·전체 인원을 돌려준다", () => {
    expect(finalSummaryFor(rows, "a")).toEqual({ points: 12, rank: 1, tieCount: 1, total: 4, rankText: "1위" });
    expect(finalSummaryFor(rows, "c")).toEqual({ points: 9, rank: 2, tieCount: 2, total: 4, rankText: "공동 2위" });
    expect(finalSummaryFor(rows, "d")?.rankText).toBe("4위");
  });
  it("내 행이 없으면 null", () => {
    expect(finalSummaryFor(rows, "zzz")).toBeNull();
    expect(finalSummaryFor([], "a")).toBeNull();
  });
});

describe("earlyEndSentence", () => {
  it("DB 라운드 4~15 → 본게임 1~12라운드 문장", () => {
    expect(earlyEndSentence(4)).toBe("대기열과 남은 몬스터가 모두 사라져 본게임 1라운드에서 게임이 끝났습니다.");
    expect(earlyEndSentence(15)).toContain("본게임 12라운드");
  });
  it("조기 종료가 아니면 null", () => {
    expect(earlyEndSentence(null)).toBeNull();
    expect(earlyEndSentence(undefined)).toBeNull();
    expect(earlyEndSentence(16)).toBeNull();
    expect(earlyEndSentence(3)).toBeNull();
  });
});
