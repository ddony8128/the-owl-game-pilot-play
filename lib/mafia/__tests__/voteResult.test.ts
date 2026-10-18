import { describe, expect, it } from "vitest";
import { voteResultFromAbilityRows, voteResultFromVotes } from "@/lib/mafia/boardSummary";

describe("ITER6 B4 — 보드 투표 결과", () => {
  it("능력 결과 category 로 판정(econ_mafia / econ_not_mafia / vote_no_econ)", () => {
    expect(
      voteResultFromAbilityRows([{ category: "econ_mafia", payload: { econ_target_nickname: "철수" } }], 2),
    ).toEqual({ round: 2, outcome: "mafia", nickname: "철수" });
    expect(
      voteResultFromAbilityRows([{ category: "econ_not_mafia", payload: null, message: "경제사범으로 지목되었던 영희은(는) 마피아가 아니었습니다." }], 0),
    ).toEqual({ round: 0, outcome: "citizen", nickname: "영희" });
    expect(voteResultFromAbilityRows([{ category: "vote_no_econ", payload: null }], 1)).toEqual({ round: 1, outcome: "none", nickname: null });
    expect(voteResultFromAbilityRows([], 1)).toBeNull();
  });
  it("기록이 없으면 투표 집계로 — 단독 최다만 지목, 동점·무투표는 없음", () => {
    const nick = (id: string) => ({ a: "가", b: "나" })[id] ?? null;
    const isMafia = (id: string) => id === "a";
    expect(voteResultFromVotes([{ target_id: "a", vote_count: 3 }, { target_id: "b", vote_count: 1 }], 1, nick, isMafia)).toEqual({
      round: 1,
      outcome: "mafia",
      nickname: "가",
    });
    expect(voteResultFromVotes([{ target_id: "b", vote_count: 2 }], 1, nick, isMafia).outcome).toBe("citizen");
    expect(voteResultFromVotes([{ target_id: "a", vote_count: 2 }, { target_id: "b", vote_count: 2 }], 1, nick, isMafia).outcome).toBe("none");
    expect(voteResultFromVotes([], 1, nick, isMafia).outcome).toBe("none");
  });
  it("결과에는 표 수가 없다(지목자·마피아 여부만)", () => {
    const r = voteResultFromVotes([{ target_id: "a", vote_count: 5 }], 3, () => "가", () => true);
    expect(Object.keys(r).sort()).toEqual(["nickname", "outcome", "round"]);
    expect(JSON.stringify(r)).not.toContain("5");
  });
});
