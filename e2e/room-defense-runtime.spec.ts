import { test, expect, type APIRequestContext } from "@playwright/test";

// 런타임 검증: 동시 제출(경합), 카운트다운 타이머 상태 전이.

type Monster = { instanceId: string; monsterId: number };
type State = { round: number; monsters: Monster[]; score: number };

async function newRoom(request: APIRequestContext): Promise<string> {
  return (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
}
async function stateOf(request: APIRequestContext, room: string, nick: string) {
  return (await (
    await request.get(`/api/defense/state?room=${room}&nickname=${nick}`)
  ).json()) as State;
}

// ── 동시성: 12명이 동시에 같은 몬스터를 전투 제출 ──────────
test("[동시성] 12명 동시 전투 제출이 모두 반영되고 정산이 정확", async ({
  request,
}) => {
  test.setTimeout(90_000);
  const room = await newRoom(request);
  for (let i = 1; i <= 12; i += 1)
    await request.post("/api/gm/players", { data: { room, nickname: `u${i}` } });
  await request.post("/api/gm/defense/monster-config", {
    data: { room, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 40 } }, // 서브웨이맨만
  });
  await request.post("/api/gm/defense/round", { data: { room, round: 1 } });
  const target = (await stateOf(request, room, "u1")).monsters.find(
    (m) => m.monsterId === 6,
  )!;

  // 12명 동시 제출(카드2 → 합 24 ≥ HP15 처치)
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      request.post("/api/defense/action", {
        data: {
          room,
          nickname: `u${i + 1}`,
          action_type: "combat",
          target_monster_id: target.instanceId,
          used_card_slot: 2,
        },
      }),
    ),
  );
  for (let i = 0; i < 12; i += 1)
    expect(results[i].ok(), `u${i + 1} 동시 제출 성공`).toBeTruthy();

  await request.post("/api/gm/defense/round", { data: { room, round: 2 } });
  // 21 ÷ 12 = 1점씩, 대상 처치
  for (let i = 1; i <= 12; i += 1) {
    const s = await stateOf(request, room, `u${i}`);
    expect(s.score, `u${i} 점수`).toBe(1);
    expect(
      s.monsters.some((m) => m.instanceId === target.instanceId),
      "대상 처치됨",
    ).toBe(false);
  }
});

// ── 타이머: start / pause / reset 상태 전이 ────────────────
test("[타이머] 5분 카운트다운 start·pause·reset 전이", async ({ request }) => {
  const room = await newRoom(request);
  const url = `/api/gm/timers/defense`;
  const get = async () =>
    (await (await request.get(`${url}?room=${room}`)).json()) as {
      timerStart: boolean;
      timerStartAt: string | null;
      pauseAt: string | null;
      totalSeconds: number;
      serverNow: string;
    };
  const post = (action: string) =>
    request.post(url, { data: { room, action } });

  await post("reset");
  let s = await get();
  expect(s.timerStart, "리셋 후 정지").toBe(false);
  expect(s.totalSeconds, "총 300초").toBe(300);

  await post("start");
  s = await get();
  expect(s.timerStart, "시작 후 구동").toBe(true);
  expect(s.timerStartAt, "시작 시각 기록").toBeTruthy();

  await new Promise((r) => setTimeout(r, 1500));
  s = await get();
  const elapsed =
    (new Date(s.serverNow).getTime() - new Date(s.timerStartAt!).getTime()) /
    1000;
  expect(elapsed, "시간 흐름 반영").toBeGreaterThan(1);

  await post("pause");
  s = await get();
  expect(s.timerStart, "일시정지").toBe(false);
  expect(s.pauseAt, "일시정지 시각 기록").toBeTruthy();

  await post("reset");
  s = await get();
  expect(s.timerStart, "리셋 후 정지").toBe(false);
  expect(s.timerStartAt, "리셋 후 시작시각 제거").toBeFalsy();
});
