import { describe, expect, it } from "vitest";
import { TIMELINE, getRoundLabel, isBattleRound, stageTitle, stagesForRound, timelineIndexOf } from "../stages";

describe("stagesForRound — GM 라운드 → 보드 단계", () => {
  it("0: 준비 화면만", () => {
    expect(stagesForRound(0)).toEqual([{ kind: "ready", round: 0, gmRound: 0 }]);
  });
  it("1: 튜토리얼 1라운드 대기열(앞 라운드 결과 없음)", () => {
    expect(stagesForRound(1).map((s) => s.kind)).toEqual(["snapshot"]);
  });
  it("2: 1라운드 결과 → 2라운드 대기열", () => {
    expect(stagesForRound(2).map((s) => `${s.kind}:${s.round}`)).toEqual(["result:1", "snapshot:2"]);
  });
  it("3: 2라운드 결과 → 튜토리얼 점수(board-scores round=3), 대기열 없음", () => {
    const s = stagesForRound(3);
    expect(s.map((x) => x.kind)).toEqual(["result", "score"]);
    expect(s[1].scoreRound).toBe(3);
  });
  it("4: 본게임 초기화 — 3 은 전투 라운드가 아니므로 결과 없이 대기열만", () => {
    expect(stagesForRound(4).map((s) => `${s.kind}:${s.round}`)).toEqual(["snapshot:4"]);
  });
  it("8·12: 결과 → 점수(7·11) → 대기열", () => {
    expect(stagesForRound(8).map((s) => `${s.kind}:${s.round}:${s.scoreRound ?? ""}`)).toEqual([
      "result:7:",
      "score:8:7",
      "snapshot:8:",
    ]);
    expect(stagesForRound(12).map((s) => `${s.kind}:${s.round}:${s.scoreRound ?? ""}`)).toEqual([
      "result:11:",
      "score:12:11",
      "snapshot:12:",
    ]);
  });
  it("16: 15라운드 결과 → 최종 점수(round=16), 대기열 없음", () => {
    expect(stagesForRound(16).map((s) => `${s.kind}:${s.round}:${s.scoreRound ?? ""}`)).toEqual([
      "result:15:",
      "score:16:16",
    ]);
  });
  it("16 조기 종료(prevRound=9): 9라운드(본게임 6) 결과 → 최종 점수, 15 결과는 없음", () => {
    expect(stagesForRound(16, 9).map((s) => `${s.kind}:${s.round}:${s.scoreRound ?? ""}`)).toEqual([
      "result:9:",
      "score:16:16",
    ]);
  });
  it("5~7·9~11·13~15: 결과 → 대기열", () => {
    for (const r of [5, 6, 7, 9, 10, 11, 13, 14, 15]) {
      expect(stagesForRound(r).map((s) => `${s.kind}:${s.round}`), `round ${r}`).toEqual([
        `result:${r - 1}`,
        `snapshot:${r}`,
      ]);
    }
  });
});

describe("TIMELINE(수동 모드)", () => {
  it("옛 수동 타임라인과 같은 33단계", () => {
    expect(TIMELINE).toHaveLength(33);
    expect(TIMELINE[0].kind).toBe("ready");
    expect(TIMELINE[5]).toMatchObject({ kind: "score", scoreRound: 3 });
    expect(TIMELINE[14]).toMatchObject({ kind: "score", scoreRound: 7 });
    expect(TIMELINE[23]).toMatchObject({ kind: "score", scoreRound: 11 });
    expect(TIMELINE[32]).toMatchObject({ kind: "score", scoreRound: 16 });
  });
  it("timelineIndexOf 는 자동 단계와 같은 화면을 찾는다", () => {
    const [result7] = stagesForRound(8);
    expect(timelineIndexOf(result7)).toBe(13);
    expect(timelineIndexOf({ kind: "ready", round: 0, gmRound: 0 })).toBe(0);
  });
});

describe("라벨", () => {
  it("라운드 라벨·단계 제목", () => {
    expect(getRoundLabel(0)).toBe("준비");
    expect(getRoundLabel(2)).toBe("튜토리얼 2라운드");
    expect(getRoundLabel(4)).toBe("1라운드");
    expect(getRoundLabel(15)).toBe("12라운드");
    expect(getRoundLabel(16)).toBe("최종 결과");
    expect(isBattleRound(3)).toBe(false);
    expect(stageTitle({ kind: "result", round: 7, gmRound: 8 })).toBe("4라운드 전투 결과");
    expect(stageTitle({ kind: "score", round: 8, scoreRound: 7, gmRound: 8 })).toBe("4라운드까지 점수 발표");
    expect(stageTitle({ kind: "score", round: 16, scoreRound: 16, gmRound: 16 })).toBe("최종 점수 발표");
    expect(stageTitle({ kind: "snapshot", round: 4, gmRound: 4 })).toBe("1라운드 · 공격하세요!");
  });
});
