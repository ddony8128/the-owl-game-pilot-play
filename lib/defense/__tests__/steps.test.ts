import { describe, expect, it } from "vitest";
import { defenseStageTitle, nextDefenseStep, normalizeStage, stageAfterRewind, stageAfterRoundChange } from "@/lib/defense/steps";

// GM [다음] 버튼 한 개로 가는 단계 순서(또니 10-18) — 전체를 처음부터 끝까지 걸어 본다.
describe("nextDefenseStep — 준비 → 최종 결과까지", () => {
  it("전체 순서와 버튼 이름", () => {
    const labels: string[] = [];
    let round = 0;
    let stage: string = "ready";
    for (let guard = 0; guard < 80; guard += 1) {
      const step = nextDefenseStep(round, stage);
      if (!step) break;
      labels.push(step.label);
      if (step.kind === "round") {
        round = step.nextRound;
        stage = step.stage;
      } else {
        stage = step.stage;
      }
    }
    expect(round).toBe(16);
    expect(stage).toBe("score");
    expect(labels.slice(0, 8)).toEqual([
      "튜토리얼 1라운드 시작",
      "튜토리얼 1라운드 결과 보기",
      "튜토리얼 2라운드 시작",
      "튜토리얼 2라운드 결과 보기",
      "튜토리얼 점수 발표",
      "본게임 준비",
      "1라운드 시작",
      "1라운드 결과 보기",
    ]);
    expect(labels).toContain("중간 점수 발표");
    expect(labels.filter((l) => l === "중간 점수 발표")).toHaveLength(2);
    expect(labels[labels.length - 1]).toBe("최종 결과 발표");
    // 4라운드 결과 → 중간 점수 → 5라운드 시작
    const i = labels.indexOf("4라운드 결과 보기");
    expect(labels.slice(i, i + 3)).toEqual(["4라운드 결과 보기", "중간 점수 발표", "5라운드 시작"]);
    const j = labels.indexOf("8라운드 결과 보기");
    expect(labels.slice(j, j + 3)).toEqual(["8라운드 결과 보기", "중간 점수 발표", "9라운드 시작"]);
    expect(labels.slice(-2)).toEqual(["12라운드 결과 보기", "최종 결과 발표"]);
    expect(labels).toHaveLength(33);
  });
  it("조기 종료: 결과 단계에서 round 가 16 이면 다음 버튼은 최종 결과 발표", () => {
    expect(nextDefenseStep(16, "result")).toMatchObject({ kind: "stage", stage: "score", label: "최종 결과 발표" });
    expect(nextDefenseStep(16, "score")).toBeNull();
  });
  it("round 전환은 정산 여부를 구분한다", () => {
    expect(nextDefenseStep(0, "ready")).toMatchObject({ kind: "round", nextRound: 1, settles: false });
    expect(nextDefenseStep(3, "score")).toMatchObject({ kind: "round", nextRound: 4, stage: "prep", settles: false });
    expect(nextDefenseStep(4, "action")).toMatchObject({ kind: "round", nextRound: 5, stage: "result", settles: true });
  });
});

describe("stage 보조 함수", () => {
  it("normalizeStage: 옛 행(stage 없음)은 round 로 추정", () => {
    expect(normalizeStage(0, null)).toBe("ready");
    expect(normalizeStage(1, null)).toBe("action");
    expect(normalizeStage(3, null)).toBe("score");
    expect(normalizeStage(16, "garbage")).toBe("score");
    expect(normalizeStage(5, "result")).toBe("result");
  });
  it("stageAfterRoundChange / stageAfterRewind", () => {
    expect(stageAfterRoundChange(0, 1)).toBe("action");
    expect(stageAfterRoundChange(3, 4)).toBe("prep");
    expect(stageAfterRoundChange(4, 5)).toBe("result");
    expect(stageAfterRoundChange(9, 16)).toBe("result");
    expect(stageAfterRewind(0)).toBe("ready");
    expect(stageAfterRewind(3)).toBe("score");
    expect(stageAfterRewind(7)).toBe("action");
  });
  it("defenseStageTitle", () => {
    expect(defenseStageTitle(0, "ready")).toBe("준비");
    expect(defenseStageTitle(4, "action")).toBe("1라운드");
    expect(defenseStageTitle(5, "result")).toBe("1라운드 결과");
    expect(defenseStageTitle(16, "result", 9)).toBe("6라운드 결과");
    expect(defenseStageTitle(8, "score")).toBe("중간 점수");
    expect(defenseStageTitle(16, "score")).toBe("최종 결과");
    expect(defenseStageTitle(4, "prep")).toBe("본게임 준비");
  });
});
