import { test, expect, type APIRequestContext } from "@playwright/test";

// 대기열 칸 수가 참가 인원에 따라 유동적으로 정해지는지 검증.
//  - 7~9명  → 4칸
//  - 10~12명 → 5칸
// board-state(round=1)의 몬스터 수 = 그 라운드 대기열에 채워진 몬스터 수.

async function makeRoomWithPlayers(
  request: APIRequestContext,
  count: number,
): Promise<string> {
  const room = (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
  for (let i = 1; i <= count; i += 1) {
    const r = await request.post("/api/gm/players", {
      data: { room, nickname: `q${i}` },
    });
    expect(r.ok()).toBeTruthy();
  }
  return room;
}

async function queueSizeAfterStart(
  request: APIRequestContext,
  room: string,
): Promise<number> {
  // 0 → 1 (튜토리얼 시작 = 대기열 초기 생성)
  const adv = await request.post("/api/gm/defense/round", {
    data: { round: 1, room },
  });
  expect(adv.ok()).toBeTruthy();

  const res = await request.get(`/api/defense/board-state?room=${room}&round=1`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return (json.monsters as unknown[]).length;
}

test("9명 방은 대기열 4칸", async ({ request }) => {
  const room = await makeRoomWithPlayers(request, 9);
  expect(await queueSizeAfterStart(request, room)).toBe(4);
});

test("12명 방은 대기열 5칸", async ({ request }) => {
  const room = await makeRoomWithPlayers(request, 12);
  expect(await queueSizeAfterStart(request, room)).toBe(5);
});

test("10명 방은 대기열 5칸(경계)", async ({ request }) => {
  const room = await makeRoomWithPlayers(request, 10);
  expect(await queueSizeAfterStart(request, room)).toBe(5);
});
