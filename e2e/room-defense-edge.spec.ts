import { test, expect, type APIRequestContext } from "@playwright/test";

// 디펜스 대기열 유동화(7~12명) + 12명 안정성 엣지 케이스 10종.
// 라이브 Supabase 대상. 각 테스트는 독립 방을 생성한다.

type Counts = Record<string, number>;

async function makeRoom(
  request: APIRequestContext,
  players: number,
): Promise<string> {
  const room = (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
  for (let i = 1; i <= players; i += 1) {
    const r = await request.post("/api/gm/players", {
      data: { room, nickname: `q${i}` },
    });
    expect(r.ok(), `player q${i} 등록`).toBeTruthy();
  }
  return room;
}

async function setConfig(
  request: APIRequestContext,
  room: string,
  counts: Counts,
): Promise<void> {
  const res = await request.post("/api/gm/defense/monster-config", {
    data: { room, counts },
  });
  expect(res.ok(), "monster-config 저장").toBeTruthy();
}

// 현재 라운드 → nextRound 로 전환.
async function advance(
  request: APIRequestContext,
  room: string,
  nextRound: number,
): Promise<boolean> {
  const res = await request.post("/api/gm/defense/round", {
    data: { room, round: nextRound },
  });
  return res.ok();
}

// board-state(round=N)의 대기열 몬스터 수.
async function queueCount(
  request: APIRequestContext,
  room: string,
  round: number,
): Promise<number> {
  const res = await request.get(
    `/api/defense/board-state?room=${room}&round=${round}`,
  );
  expect(res.ok(), `board-state round=${round}`).toBeTruthy();
  return ((await res.json()).monsters as unknown[]).length;
}

async function activeCardCount(
  request: APIRequestContext,
  room: string,
  nickname: string,
): Promise<number> {
  const res = await request.get(
    `/api/defense/state?room=${room}&nickname=${nickname}`,
  );
  expect(res.ok(), "player state").toBeTruthy();
  const json = await res.json();
  const cards = (json.cards ?? []) as { isActive: boolean }[];
  return cards.filter((c) => c.isActive).length;
}

// ── 1~5: 인원별 대기열 칸 수 ──────────────────────────────
for (const [players, expected] of [
  [7, 4],
  [9, 4],
  [10, 5],
  [12, 5],
  [13, 5],
] as const) {
  test(`[${players}명] 시작 시 대기열 ${expected}칸`, async ({ request }) => {
    const room = await makeRoom(request, players);
    expect(await advance(request, room, 1)).toBeTruthy();
    expect(await queueCount(request, room, 1)).toBe(expected);
  });
}

// ── 6: 플레이어 0명이어도 시작이 크래시 없이 처리 ─────────
test("[0명] 플레이어 없이 시작해도 크래시 없음(대기열 4칸, 카드 없음)", async ({
  request,
}) => {
  const room = (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
  expect(await advance(request, room, 1)).toBeTruthy();
  expect(await queueCount(request, room, 1)).toBe(4);
});

// ── 7: 덱 소진 — 총 3마리면 대기열도 3칸까지만 ────────────
test("[덱 소진] 몬스터 총 3마리면 12명이어도 대기열 3칸", async ({ request }) => {
  const room = await makeRoom(request, 12);
  await setConfig(request, room, { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  expect(await advance(request, room, 1)).toBeTruthy();
  expect(await queueCount(request, room, 1)).toBe(3);
});

// ── 8: 소수 몬스터 전멸 후에도 라운드 전환이 안정적 ────────
test("[전멸 안정성] 스파이더 2마리로 12명 방을 종료까지 안전 진행", async ({
  request,
}) => {
  const room = await makeRoom(request, 12);
  await setConfig(request, room, { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  // 0→1→...→16 까지 모두 성공해야 한다(중간에 대기열이 비어도 크래시 없음).
  for (let r = 1; r <= 16; r += 1) {
    expect(await advance(request, room, r), `round ${r} 전환`).toBeTruthy();
  }
  const round = (await (await request.get(`/api/defense/state?room=${room}`)).json())
    .round;
  expect(round).toBe(16);
});

// ── 9: 도망 페널티 — 몬스터가 도망치면 12명 전원 카드 1장 비활성화 ─
test("[도망 페널티] 방치로 몬스터 도망 시 플레이어 카드가 비활성화된다", async ({
  request,
}) => {
  const room = await makeRoom(request, 12);
  // 잔여시간 2인 스파이더를 넉넉히(풀 유지) 채운다.
  await setConfig(request, room, { 1: 40, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  // 본게임까지: 0→1→2→3→4 (round 4 에서 카드 4장 활성 재세팅)
  for (let r = 1; r <= 4; r += 1) {
    expect(await advance(request, room, r)).toBeTruthy();
  }
  expect(await activeCardCount(request, room, "q1")).toBe(4); // 시작은 4장 활성
  // 4→5(시간 2→1), 5→6(시간 1→0 → 도망 → 전원 최대 카드 비활성화)
  expect(await advance(request, room, 5)).toBeTruthy();
  expect(await advance(request, room, 6)).toBeTruthy();
  // 아무도 공격하지 않았으므로 도망 페널티로 카드가 줄어야 한다.
  expect(await activeCardCount(request, room, "q1")).toBeLessThan(4);
});

// ── 10: 12명 풀 플레이스루 — 전 라운드 대기열 ≤5, 종료(16) 도달 ─
test("[12명 풀 플레이] 튜토리얼~12라운드~종료까지 대기열 항상 ≤5", async ({
  request,
}) => {
  // 12명 × 기본 조합 × 16라운드는 라이브 DB 쓰기가 많아 기본 60초를 넘길 수 있다.
  test.setTimeout(180_000);
  const room = await makeRoom(request, 12);
  for (let r = 1; r <= 16; r += 1) {
    expect(await advance(request, room, r), `round ${r} 전환`).toBeTruthy();
    if (r <= 15) {
      const q = await queueCount(request, room, r);
      expect(q, `round ${r} 대기열`).toBeLessThanOrEqual(5);
    }
  }
  const round = (await (await request.get(`/api/defense/state?room=${room}`)).json())
    .round;
  expect(round).toBe(16);
});
