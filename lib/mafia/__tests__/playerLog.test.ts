import { describe, expect, it } from "vitest";
import { buildMafiaPlayerLog, mafiaJobLabel } from "@/lib/mafia/playerLog";

// Iteration 5 WS-B — 마피아 로그 탭. 핵심은 "비공개 정보가 절대 섞이지 않는다".
const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const THIRD = "33333333-3333-3333-3333-333333333333";
const names = new Map([
  [ME, "나"],
  [OTHER, "남"],
  [THIRD, "셋"],
]);

function fixture() {
  return {
    playerId: ME,
    actions: [
      { player_id: ME, round_number: 1, phase: "auction", action_type: "bet", payload: { job: "police", amount: 7 }, created_at: "2026-10-17T01:00:00Z" },
      { player_id: OTHER, round_number: 1, phase: "auction", action_type: "bet", payload: { job: "robber", amount: 9 }, created_at: "2026-10-17T01:00:01Z" },
      { player_id: ME, round_number: 1, phase: "trade", action_type: "buy", payload: { stock_key: "부엉교육", amount: 2, price: 5 }, created_at: "2026-10-17T01:01:00Z" },
      { player_id: ME, round_number: 1, phase: "trade", action_type: "sell", payload: { stock_key: "국채", amount: 1 }, created_at: "2026-10-17T01:02:00Z" },
      { player_id: OTHER, round_number: 1, phase: "trade", action_type: "ability", payload: { job: "robber", targets: ["나", "셋"] }, created_at: "2026-10-17T01:03:00Z" },
      { player_id: ME, round_number: 1, phase: "trade", action_type: "ability", payload: { job: "police", targets: ["남", "셋"] }, created_at: "2026-10-17T01:03:30Z" },
      { player_id: ME, round_number: 2, phase: "auction", action_type: "bet", payload: { job: null, give_up: true }, created_at: "2026-10-17T02:00:00Z" },
    ],
    votes: [
      { voter_id: ME, round_number: 1, target_id: OTHER, vote_count: 2, unit_price: 1 },
      { voter_id: ME, round_number: 1, target_id: OTHER, vote_count: 1, unit_price: 1 },
      { voter_id: OTHER, round_number: 1, target_id: ME, vote_count: 5, unit_price: 1 },
      { voter_id: THIRD, round_number: 1, target_id: ME, vote_count: 3, unit_price: 1 },
    ],
    abilityResults: [
      { player_id: ME, round_number: 1, phase: "apply", category: "salary", message: "이번 라운드 월급으로 5원을 얻었습니다." },
      { player_id: ME, round_number: 1, phase: "apply", category: "robber_victim", message: "이번 라운드에 강도로부터 1원을 빼앗겼습니다." },
      { player_id: OTHER, round_number: 1, phase: "apply", category: "robber_gain", message: "강도로 총 3원을 빼앗았습니다. (나에게 1원, 셋에게 2원)" },
      { player_id: ME, round_number: 1, phase: "vote", category: "econ_mafia", message: "경제사범으로 지목되었던 남은(는) 마피아였습니다. 국채 가격이 1 오르고, 모든 시민에게 국채가 지급되었습니다." },
    ],
    snapshots: [
      { player_id: ME, round_number: 1, phase: "auction", job: null, cash: 30 },
      { player_id: ME, round_number: 1, phase: "trade", job: "police", cash: 23 },
      { player_id: ME, round_number: 1, phase: "vote", job: "police", cash: 28 },
      { player_id: OTHER, round_number: 1, phase: "trade", job: "robber", cash: 21 },
      { player_id: ME, round_number: 2, phase: "trade", job: "salaryman", cash: 28 },
    ],
    nicknameById: names,
  };
}

describe("buildMafiaPlayerLog", () => {
  it("라운드 내림차순으로 내 기록을 모은다", () => {
    const log = buildMafiaPlayerLog(fixture());
    expect(log.map((r) => r.round)).toEqual([2, 1]);
    const r1 = log.find((r) => r.round === 1)!;
    const texts = r1.entries.map((e) => e.text);
    expect(texts).toContain("경매: 경찰에 7원 베팅 → 낙찰(경찰, 7원 지불)");
    expect(texts).toContain("거래: 부엉교육 2주 매수 (주당 5원, 총 10원)");
    expect(texts).toContain("거래: 국채 1주 매도"); // 옛 행(price 없음)도 깨지지 않는다
    expect(texts).toContain("능력 사용: 경찰 — 대상: 남, 셋");
    expect(texts).toContain("정산: 이번 라운드 월급으로 5원을 얻었습니다.");
    expect(texts).toContain("정산: 이번 라운드에 강도로부터 1원을 빼앗겼습니다.");
    expect(texts).toContain("투표: 남에게 3표 (3원 사용)"); // 2+1 합산
    expect(texts.some((t) => t.startsWith("라운드 종료: 경제사범으로 지목되었던"))).toBe(true);
  });

  it("포기 라운드는 '포기 → 월급쟁이'", () => {
    const r2 = buildMafiaPlayerLog(fixture()).find((r) => r.round === 2)!;
    expect(r2.entries.map((e) => e.text)).toContain("경매: 베팅을 포기했습니다. → 낙찰 실패, 이번 라운드 직업: 월급쟁이");
  });

  it("베팅을 안 한 라운드도 직업이 정해졌으면 한 줄 남긴다", () => {
    const f = fixture();
    f.actions = f.actions.filter((a) => !(a.player_id === ME && a.round_number === 2));
    const r2 = buildMafiaPlayerLog(f).find((r) => r.round === 2)!;
    expect(r2.entries[0].text).toBe("경매: 베팅하지 않음 → 이번 라운드 직업: 월급쟁이");
  });

  it("비공개 정보(남의 직업·남의 표·남의 강도 대상·남의 능력결과)는 절대 들어가지 않는다", () => {
    const log = buildMafiaPlayerLog(fixture());
    const all = JSON.stringify(log);
    // 남(OTHER)의 직업이 강도라는 사실: 내 로그 어디에도 '강도' 직업 배정/능력 사용이 없어야 한다
    expect(all).not.toContain("능력 사용: 강도");
    expect(all).not.toContain("낙찰(강도");
    expect(all).not.toContain("강도로 총 3원"); // 남의 능력결과
    // 남이 나에게 던진 표(5표)·셋이 던진 표(3표)는 보이지 않는다
    expect(all).not.toMatch(/나에게 \d+표/);
    expect(all).not.toContain("5표");
    // 내부 id 노출 없음
    expect(all).not.toContain(OTHER);
    expect(all).not.toContain(THIRD);
  });

  it("남의 행만 들어오면 빈 로그", () => {
    const f = fixture();
    f.playerId = "99999999-9999-9999-9999-999999999999";
    expect(buildMafiaPlayerLog(f)).toEqual([]);
  });

  it("직업 라벨", () => {
    expect(mafiaJobLabel("robber")).toBe("강도");
    expect(mafiaJobLabel(null)).toBe("없음");
    expect(mafiaJobLabel("unknown_job")).toBe("unknown_job");
  });
});
