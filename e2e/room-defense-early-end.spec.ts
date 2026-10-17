import { test, expect, type APIRequestContext } from "@playwright/test";

// 디펜스 조기 종료(룰지 §7): 본게임에서 모든 몬스터가 처치·도망해 대기열과 풀이 비면 [다음 라운드]가 다음 라운드 대신
// 16(최종 결과)으로 간다. 보드 phase 는 prevRound=마지막 정산 라운드, 최종 점수는 그 라운드 스냅샷, 되돌리기는 409.
const created: string[] = [];
async function newRoom(request: APIRequestContext, names: string[]) {
  const res = await request.post("/api/gm/rooms", { data: { game: "defense" } });
  const code = (await res.json()).room.code as string;
  created.push(code);
  for (const nickname of names) expect((await request.post("/api/gm/players", { data: { room: code, nickname } })).ok()).toBeTruthy();
  return code;
}
test.afterAll(async ({ request }) => {
  for (const code of created) await request.patch("/api/gm/rooms", { data: { code, status: "ended", ended_normally: true } });
});
const adv = (request: APIRequestContext, room: string, round: number, from: number) =>
  request.post("/api/gm/defense/round", { data: { room, round, from } });
const state = async (request: APIRequestContext, room: string, nickname: string) =>
  (await request.get(`/api/defense/state?${new URLSearchParams({ room, nickname })}`)).json();

test("[조기 종료] 스컬 스파이더 1마리만 있는 방: 본게임 1라운드에 처치 → 다음 라운드가 16(최종 결과)로", async ({ request }) => {
  test.setTimeout(120_000);
  const nicks = ["끝1", "끝2", "끝3", "끝4", "끝5", "끝6"];
  const room = await newRoom(request, nicks);
  // 풀: 스컬 스파이더(HP 1) 1마리만
  const cfg = await request.post("/api/gm/defense/monster-config", { data: { room, counts: { "1": 1, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 } } });
  expect(cfg.ok()).toBeTruthy();
  // 튜토리얼(1·2·3)은 전투 없이 넘긴다 — 튜토리얼에서는 조기 종료가 발동하지 않아야 한다
  for (let r = 1; r <= 3; r += 1) expect((await adv(request, room, r, r - 1)).ok(), `→${r}`).toBeTruthy();
  expect((await state(request, room, "끝1")).round).toBe(3);
  // 본게임 시작(4): 풀이 다시 1마리로 리셋되고 대기열에 스컬 스파이더 1마리
  expect((await adv(request, room, 4, 3)).ok()).toBeTruthy();
  const s4 = await state(request, room, "끝1");
  expect(s4.round).toBe(4);
  expect(s4.monsters.length).toBe(1);
  // 끝1이 카드 1로 처치(HP 1)
  const act = await request.post("/api/defense/action", {
    data: { room, nickname: "끝1", action_type: "combat", target_monster_id: s4.monsters[0].instanceId, used_card_slot: 1, round: 4 },
  });
  expect(act.ok()).toBeTruthy();
  // [다음 라운드](5) → 정산 후 대기열·풀 0 → 16
  const res = await adv(request, room, 5, 4);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.earlyEnd).toBe(true);
  expect(json.phase.round).toBe(16);

  const s16 = await state(request, room, "끝1");
  expect(s16.round).toBe(16);
  expect(s16.score, "스컬 스파이더 2점 독식").toBe(2);

  // 보드 phase: prevRound = 4(마지막 정산 라운드), endedEarlyFrom = 4
  const phase = await (await request.get(`/api/defense/board-phase?room=${room}`)).json();
  expect(phase).toMatchObject({ round: 16, prevRound: 4, endedEarlyFrom: 4 });
  // 최종 점수: 4라운드 스냅샷 기준 — 끝1 2점 1위, 나머지 0점 공동 2위
  const scores = await (await request.get(`/api/defense/board-scores?room=${room}&round=16`)).json();
  const top = scores.scores.find((s: { nickname: string }) => s.nickname === "끝1");
  expect(top.points).toBe(2);
  expect(top.rank).toBe(1);
  expect(scores.scores.filter((s: { rank: number }) => s.rank === 2).length).toBe(5);
  // 조기 종료 뒤 되돌리기 409
  const rw = await request.post("/api/gm/defense/rewind", { data: { room, from: 16 } });
  expect(rw.status()).toBe(409);
  expect((await rw.json()).reason).toBe("not_rewindable");
  // GM 로그
  const dash = await (await request.get(`/api/gm/defense/dashboard?room=${room}`)).json();
  expect(dash.gmLogs.some((l: { content: string }) => l.content.includes("조기 종료"))).toBe(true);
});

test("[조기 종료 아님] 풀이 남아 있으면 평소처럼 다음 라운드로 간다", async ({ request }) => {
  test.setTimeout(90_000);
  const room = await newRoom(request, ["남1", "남2", "남3", "남4", "남5", "남6"]);
  expect((await request.post("/api/gm/defense/monster-config", { data: { room, counts: { "1": 5, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 } } })).ok()).toBeTruthy();
  for (let r = 1; r <= 4; r += 1) expect((await adv(request, room, r, r - 1)).ok()).toBeTruthy();
  const s4 = await state(request, room, "남1");
  expect(s4.monsters.length).toBe(4); // 6명 4칸 → 대기열 4마리, 풀 1마리 남음
  await request.post("/api/defense/action", {
    data: { room, nickname: "남1", action_type: "combat", target_monster_id: s4.monsters[0].instanceId, used_card_slot: 1, round: 4 },
  });
  const res = await adv(request, room, 5, 4);
  const json = await res.json();
  expect(json.earlyEnd).toBe(false);
  expect(json.phase.round).toBe(5);
  expect((await state(request, room, "남1")).monsters.length, "남은 3마리 + 풀에서 1마리 보충").toBe(4);
});
