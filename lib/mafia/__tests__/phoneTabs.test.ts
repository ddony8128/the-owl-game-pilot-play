import { describe, expect, it } from "vitest";
import { MAFIA_PHASE_TAB, mafiaPhaseKey, mafiaTabForPhase } from "@/lib/mafia/phoneTabs";

describe("ITER6 B3 — 마피아 단계 → 폰 탭", () => {
  it("단계별 이동 탭", () => {
    expect(mafiaTabForPhase("prepare")).toBe("info");
    expect(mafiaTabForPhase("auction")).toBe("auction");
    expect(mafiaTabForPhase("trade")).toBe("trade");
    expect(mafiaTabForPhase("apply")).toBe("result");
    expect(mafiaTabForPhase("vote")).toBe("vote");
    expect(mafiaTabForPhase("end")).toBe("result");
    expect(Object.keys(MAFIA_PHASE_TAB)).toHaveLength(6);
  });
  it("모르는 단계·없음은 이동하지 않는다", () => {
    expect(mafiaTabForPhase(null)).toBeNull();
    expect(mafiaTabForPhase("weird")).toBeNull();
  });
  it("전이 키는 라운드까지 포함한다(다음 라운드의 같은 단계도 새 전이)", () => {
    expect(mafiaPhaseKey(1, "auction")).not.toBe(mafiaPhaseKey(2, "auction"));
    expect(mafiaPhaseKey(1, "auction")).toBe("1:auction");
    expect(mafiaPhaseKey(1, null)).toBeNull();
  });
});
