import { test, expect, type APIRequestContext } from "@playwright/test";
import { computeQueueSize } from "../lib/defense/queue";
import { recommendedMonsterCounts } from "../lib/defense/composition";

// 7~11명 전 구간에 대해 "인원수에 민감한 규칙"을 같은 방식으로 검증한다.
//  - 대기열 칸 수
//  - 도망 페널티가 N명 "전원"에게 정확히 최댓값 카드 1장씩
//  - 자동 세팅 프리셋 총량(N×3) 저장·스폰 일치
//  - N명 동시 처치 시 점수 = floor(보상 / N) (실제 인원수로 분배)

type Counts = Record<string, number>;
type Monster = { instanceId: string; monsterId: number; currentHp: number };
type Card = { cardSlot: number; cardValue: number; isActive: boolean };
type State = { round: number; monsters: Monster[]; cards: Card[]; score: number };

async function newRoom(request: APIRequestContext): Promise<string> {
  return (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
}
async function addPlayers(request: APIRequestContext, room: string, n: number) {
  for (let i = 1; i <= n; i += 1) {
    const r = await request.post("/api/gm/players", {
      data: { room, nickname: `q${i}` },
    });
    expect(r.ok(), `q${i} 등록`).toBeTruthy();
  }
}
async function config(request: APIRequestContext, room: string, counts: Counts) {
  const r = await request.post("/api/gm/defense/monster-config", {
    data: { room, counts },
  });
  expect(r.ok(), "monster-config").toBeTruthy();
}
function only(id: number, count = 60): Counts {
  const c: Counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  c[id] = count;
  return c;
}
async function advance(request: APIRequestContext, room: string, to: number) {
  const r = await request.post("/api/gm/defense/round", {
    data: { room, round: to },
  });
  expect(r.ok(), `round→${to}`).toBeTruthy();
}
async function stepTo(request: APIRequestContext, room: string, target: number) {
  for (let r = 1; r <= target; r += 1) await advance(request, room, r);
}
async function stateOf(
  request: APIRequestContext,
  room: string,
  nick: string,
): Promise<State> {
  const res = await request.get(
    `/api/defense/state?room=${room}&nickname=${nick}`,
  );
  expect(res.ok(), `state ${nick}`).toBeTruthy();
  return (await res.json()) as State;
}
async function combat(
  request: APIRequestContext,
  room: string,
  nick: string,
  instanceId: string,
  cardSlot: number,
) {
  const r = await request.post("/api/defense/action", {
    data: {
      room,
      nickname: nick,
      action_type: "combat",
      target_monster_id: instanceId,
      used_card_slot: cardSlot,
    },
  });
  expect(r.ok(), `${nick} combat`).toBeTruthy();
}
const activeCount = (s: State) => s.cards.filter((c) => c.isActive).length;
const card = (s: State, slot: number) =>
  s.cards.find((c) => c.cardSlot === slot)!;

for (const N of [7, 8, 9, 10, 11]) {
  const Q = computeQueueSize(N);

  test.describe(`${N}명`, () => {
    test(`대기열 ${Q}칸`, async ({ request }) => {
      const room = await newRoom(request);
      await addPlayers(request, room, N);
      await advance(request, room, 1);
      const res = await request.get(
        `/api/defense/board-state?room=${room}&round=1`,
      );
      expect(res.ok()).toBeTruthy();
      expect(((await res.json()).monsters as unknown[]).length).toBe(Q);
    });

    test(`도망 페널티: ${N}명 전원 최댓값 카드 1장만 비활성`, async ({
      request,
    }) => {
      test.setTimeout(120_000);
      const room = await newRoom(request);
      await addPlayers(request, room, N);
      await config(request, room, only(1)); // 스컬 스파이더(잔여시간 2)
      await advance(request, room, 1); // 스폰(t2), 카드 4장 활성
      await advance(request, room, 2); // t2→1
      await advance(request, room, 3); // t1→0 도망 → 페널티
      for (let i = 1; i <= N; i += 1) {
        const s = await stateOf(request, room, `q${i}`);
        expect(activeCount(s), `q${i} 활성 3장`).toBe(3);
        expect(card(s, 4).isActive, `q${i} 카드4 비활성`).toBe(false);
        expect(
          card(s, 1).isActive && card(s, 2).isActive && card(s, 3).isActive,
          `q${i} 나머지 활성`,
        ).toBe(true);
      }
    });

    test(`프리셋 총 ${N * 3}마리 저장·스폰 일치(대기열 ${Q})`, async ({
      request,
    }) => {
      test.setTimeout(120_000);
      const room = await newRoom(request);
      await addPlayers(request, room, N);
      const rec = recommendedMonsterCounts(N);
      await config(
        request,
        room,
        Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v])),
      );
      const cfg = await (
        await request.get(`/api/gm/defense/monster-config?room=${room}`)
      ).json();
      let baseTotal = 0;
      for (const m of cfg.monsters as { id: number; base_count: number }[]) {
        expect(m.base_count, `id${m.id}`).toBe(rec[m.id]);
        baseTotal += m.base_count;
      }
      expect(baseTotal, "총량 = N×3").toBe(N * 3);
      await stepTo(request, room, 4); // 본게임 시작
      const s = await stateOf(request, room, "q1");
      const dex = (await (
        await request.get(`/api/defense/state?room=${room}&nickname=q1`)
      ).json()).dex as { remainingCount: number }[];
      const remaining = dex.reduce((a, d) => a + d.remainingCount, 0);
      expect(s.monsters.length, `대기열 ${Q}`).toBe(Q);
      expect(remaining + s.monsters.length, "잔여+대기열 = N×3").toBe(N * 3);
    });

    test(`${N}명 동시 처치 → 21점 ÷ ${N} = ${Math.floor(21 / N)}점씩`, async ({
      request,
    }) => {
      test.setTimeout(120_000);
      const room = await newRoom(request);
      await addPlayers(request, room, N);
      await config(request, room, only(6)); // 서브웨이맨(HP15·21점·t6)
      await advance(request, room, 1);
      const target = (await stateOf(request, room, "q1")).monsters.find(
        (m) => m.monsterId === 6,
      )!;
      // N명이 각자 카드3 제출 → 합 3N ≥ 15 (N≥7) → 처치
      for (let i = 1; i <= N; i += 1)
        await combat(request, room, `q${i}`, target.instanceId, 3);
      await advance(request, room, 2);
      const expected = Math.floor(21 / N);
      for (let i = 1; i <= N; i += 1)
        expect((await stateOf(request, room, `q${i}`)).score, `q${i}`).toBe(
          expected,
        );
    });
  });
}
