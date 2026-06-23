import { describe, it, expect } from "vitest";
import {
  normalizeRoomCode,
  randomRoomCode,
  MAFIA_STOCK_SEED,
  DEFENSE_MONSTER_COUNT_SEED,
  RULE_KEYS,
} from "@/lib/rooms";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";

describe("방 코드 헬퍼", () => {
  it("normalizeRoomCode: 공백 제거 + 대문자", () => {
    expect(normalizeRoomCode("  a3f82 ")).toBe("A3F82");
    expect(normalizeRoomCode("abcde")).toBe("ABCDE");
    expect(normalizeRoomCode("")).toBe("");
  });

  it("randomRoomCode: 길이 5", () => {
    const code = randomRoomCode([0, 1, 2, 3, 4]);
    expect(code).toHaveLength(5);
  });

  it("randomRoomCode: 혼동되는 글자(0,O,1,I) 미포함", () => {
    // 모든 seed 인덱스를 훑어 생성 가능한 글자 집합을 검사
    const produced = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (const ch of randomRoomCode([i, i, i, i, i])) produced.add(ch);
    }
    for (const bad of ["0", "O", "1", "I"]) {
      expect(produced.has(bad)).toBe(false);
    }
  });

  it("randomRoomCode: seed 가 같으면 동일 코드(결정성)", () => {
    expect(randomRoomCode([5, 6, 7, 8, 9])).toBe(randomRoomCode([5, 6, 7, 8, 9]));
  });
});

describe("방 생성 시드 (기획 일치)", () => {
  it("마피아 종목 4개가 모두 5원에서 시작", () => {
    expect(MAFIA_STOCK_SEED).toHaveLength(4);
    expect(MAFIA_STOCK_SEED.map((s) => s.stock_key).sort()).toEqual(
      ["국채", "번쩍전기", "부엉교육", "이상교통"].sort(),
    );
    expect(MAFIA_STOCK_SEED.every((s) => s.price === 5)).toBe(true);
  });

  it("디펜스 몬스터 수 시드가 몬스터 정의의 baseCount 와 일치", () => {
    const seedById = new Map(
      DEFENSE_MONSTER_COUNT_SEED.map((m) => [m.id, m.count]),
    );
    for (const m of DEFENSE_MONSTERS) {
      expect(seedById.get(m.id)).toBe(m.baseCount);
    }
    const total = DEFENSE_MONSTER_COUNT_SEED.reduce((s, m) => s + m.count, 0);
    expect(total).toBe(24);
  });

  it("규칙 키는 intro/subway/mafia/defense", () => {
    expect([...RULE_KEYS]).toEqual(["intro", "subway", "mafia", "defense"]);
  });
});
