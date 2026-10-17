import { describe, expect, it } from "vitest";
import {
  assignSharedRanks,
  compareDefenseRank,
  rankLabel,
  rankPlayers,
  DEFENSE_RANK_RULE_TEXT,
} from "../rank";
import { rankMafiaPlayers } from "@/lib/mafia/rank";

type P = { playerId: string; nickname: string; points: number; damage: number };
const p = (nickname: string, points: number, damage: number): P => ({
  playerId: `id-${nickname}`,
  nickname,
  points,
  damage,
});

describe("rankPlayers — 디펜스 동점 공동 순위(점수 → 누적 데미지 → 공동)", () => {
  it("점수가 다르면 점수 내림차순", () => {
    const r = rankPlayers([p("a", 3, 0), p("b", 7, 0), p("c", 5, 0)]);
    expect(r.map((x) => [x.nickname, x.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
    expect(r.every((x) => x.tieCount === 1)).toBe(true);
  });

  it("점수 동점은 누적 데미지가 큰 쪽이 앞선다", () => {
    const r = rankPlayers([p("a", 5, 10), p("b", 5, 14)]);
    expect(r.map((x) => [x.nickname, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("2명 동점(점수·데미지 모두 같음) → 공동 1위, 다음은 3위", () => {
    const r = rankPlayers([p("a", 5, 10), p("b", 5, 10), p("c", 4, 20)]);
    expect(r.map((x) => [x.nickname, x.rank, x.tieCount])).toEqual([
      ["a", 1, 2],
      ["b", 1, 2],
      ["c", 3, 1],
    ]);
  });

  it("3명 동점 → 1,1,1 그리고 4위", () => {
    const r = rankPlayers([p("d", 1, 0), p("a", 5, 10), p("b", 5, 10), p("c", 5, 10)]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 1, 4]);
    expect(r[0].tieCount).toBe(3);
  });

  it("전원 동점 → 전원 공동 1위(왕관 N개 사고 금지: tieCount = N)", () => {
    const r = rankPlayers(Array.from({ length: 6 }, (_, i) => p(`u${i}`, 0, 0)));
    expect(r.map((x) => x.rank)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(r.every((x) => x.tieCount === 6)).toBe(true);
  });

  it("인접 동점 전수: 1~12명 × 모든 인접 쌍이 동점인 경우에도 번호가 건너뛰어진다", () => {
    for (let n = 2; n <= 12; n += 1) {
      for (let tieAt = 0; tieAt < n - 1; tieAt += 1) {
        // 점수는 n, n-1, ... 내림차순인데 tieAt 과 tieAt+1 만 같은 점수
        const rows = Array.from({ length: n }, (_, i) => {
          const pts = i <= tieAt ? n - i : n - i + 1;
          return p(`u${i}`, pts, 0);
        });
        const r = rankPlayers(rows);
        const expected = rows.map((_, i) => {
          if (i < tieAt) return i + 1;
          if (i === tieAt || i === tieAt + 1) return tieAt + 1;
          return i + 1;
        });
        expect(r.map((x) => x.rank), `n=${n} tieAt=${tieAt}`).toEqual(expected);
      }
    }
  });

  it("닉네임·ID·입력 순서는 등수에 영향을 주지 않는다(동점끼리는 입력 순서만 유지)", () => {
    const a = rankPlayers([p("가", 5, 5), p("나", 5, 5)]);
    const b = rankPlayers([p("나", 5, 5), p("가", 5, 5)]);
    expect(a.map((x) => x.rank)).toEqual([1, 1]);
    expect(b.map((x) => x.rank)).toEqual([1, 1]);
    expect(a.map((x) => x.nickname)).toEqual(["가", "나"]);
    expect(b.map((x) => x.nickname)).toEqual(["나", "가"]);
  });

  it("damage 가 null/undefined 면 0으로 본다", () => {
    const r = rankPlayers([
      { nickname: "a", points: 5, damage: null },
      { nickname: "b", points: 5, damage: 1 },
      { nickname: "c", points: 5 },
    ]);
    expect(r.map((x) => [x.nickname, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
    ]);
  });

  it("빈 배열 → 빈 배열, 입력 배열은 바꾸지 않는다", () => {
    expect(rankPlayers([])).toEqual([]);
    const rows = [p("a", 1, 0), p("b", 2, 0)];
    rankPlayers(rows);
    expect(rows.map((x) => x.nickname)).toEqual(["a", "b"]);
  });

  it("compareDefenseRank: 튜토리얼 데미지는 호출자가 빼고 넘긴다(함수는 넘어온 값만 비교)", () => {
    expect(compareDefenseRank({ points: 1, damage: 9 }, { points: 2, damage: 0 })).toBeGreaterThan(0);
    expect(compareDefenseRank({ points: 2, damage: 9 }, { points: 2, damage: 9 })).toBe(0);
  });

  it("rankLabel: 공동이면 '공동 N위'", () => {
    expect(rankLabel(1, 1)).toBe("1위");
    expect(rankLabel(1, 2)).toBe("공동 1위");
    expect(rankLabel(3, 1)).toBe("3위");
  });

  it("룰지 문구 상수가 '공동 순위'를 담는다(문서=코드 대조용)", () => {
    expect(DEFENSE_RANK_RULE_TEXT).toContain("공동 순위");
    expect(DEFENSE_RANK_RULE_TEXT).toContain("카드 숫자의 합");
  });
});

describe("assignSharedRanks — 일반형", () => {
  it("비교 함수가 0을 돌려주는 그룹은 같은 등수", () => {
    const r = assignSharedRanks([{ v: 1 }, { v: 3 }, { v: 3 }, { v: 2 }], (a, b) => b.v - a.v);
    expect(r.map((x) => [x.v, x.rank])).toEqual([
      [3, 1],
      [3, 1],
      [2, 3],
      [1, 4],
    ]);
  });
});

describe("rankMafiaPlayers — 총자산 → 현금 → 공동", () => {
  it("총자산 동점은 현금이 많은 쪽, 둘 다 같으면 공동", () => {
    const r = rankMafiaPlayers([
      { name: "a", total_assets: 40, cash: 10 },
      { name: "b", total_assets: 40, cash: 20 },
      { name: "c", total_assets: 40, cash: 20 },
      { name: "d", total_assets: 50, cash: 0 },
    ]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([
      ["d", 1],
      ["b", 2],
      ["c", 2],
      ["a", 4],
    ]);
  });
});
