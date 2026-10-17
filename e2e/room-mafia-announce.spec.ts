import { test, expect, type APIRequestContext } from "@playwright/test";
import { endRoom, mafiaAdvance, mafiaNextRound, newRoom } from "./board-helpers";

// 마피아가 0명인 라운드에도 "마피아에게 주식 보상이 지급되었습니다" 공지가 전원에게 간다 — 공지 유무로 마피아 존재가 새지 않게(또니 10-17).
// 라운드 1: 아무도 입찰 안 함(마피아 0명, 경제사범 없음). 라운드 2: 한 명이 강도 낙찰(마피아 1명), 투표 없음 → 경제사범 없음.
// 두 라운드 모두 전원이 같은 공지를 받아야 한다.
const ANNOUNCE = "마피아에게 주식 보상이 지급되었습니다.";

async function runRound(req: APIRequestContext, room: string, round: number, onAuction?: () => Promise<void>) {
  await mafiaAdvance(req, room, "auction");
  if (onAuction) await onAuction();
  for (const p of ["trade", "apply", "vote", "end"]) await mafiaAdvance(req, room, p);
  if (round < 5) await mafiaNextRound(req, room, round + 1);
}

const resultsOf = async (req: APIRequestContext, room: string, nickname: string) => {
  const res = await req.get(`/api/mafia/state?${new URLSearchParams({ room, nickname })}`);
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { abilityResults?: { round_number: number; category: string; message: string }[] };
  return json.abilityResults ?? [];
};

test("[공지] 마피아 0명 라운드와 1명 라운드 모두 전원에게 주식 보상 공지가 간다", async ({ request }) => {
  test.setTimeout(120_000);
  const nicks = ["안내1", "안내2", "안내3", "안내4", "안내5"];
  const room = await newRoom(request, "mafia", nicks);
  try {
    await runRound(request, room, 0);
    await runRound(request, room, 1); // 마피아 0명
    await runRound(request, room, 2, async () => {
      const r = await request.post("/api/mafia/action", {
        data: { room, nickname: "안내1", type: "bet", payload: { job: "robber", amount: 2 } },
      });
      expect(r.ok()).toBeTruthy();
    }); // 마피아 1명
    for (const n of nicks) {
      const rows = await resultsOf(request, room, n);
      for (const round of [1, 2]) {
        const hit = rows.filter((r) => r.round_number === round && r.category === "mafia_stock_reward_announce");
        expect(hit.length, `${n} ${round}라운드 공지`).toBe(1);
        expect(hit[0].message).toBe(ANNOUNCE);
      }
    }
    // 1라운드엔 마피아가 없었으니 개인 지급 메시지는 아무에게도 없고, 2라운드엔 강도(안내1)에게만 있다
    const r1 = await resultsOf(request, room, "안내1");
    expect(r1.some((r) => r.round_number === 1 && r.category === "mafia_stock_reward")).toBe(false);
    expect(r1.some((r) => r.round_number === 2 && r.category === "mafia_stock_reward")).toBe(true);
    const r2 = await resultsOf(request, room, "안내2");
    expect(r2.some((r) => r.category === "mafia_stock_reward")).toBe(false);
  } finally {
    await endRoom(request, room);
  }
});
