import { test, expect, type APIRequestContext } from "@playwright/test";
import { recommendedMonsterCounts } from "../lib/defense/composition";

// 디펜스 "규칙" 단위 검증 — 실제 전투/휴식/훈련을 넣어 기대 결과를 단언한다.
// monster-config 로 몬스터 종류를 하나로 고정해 결정론적으로 만든다.
//  id: 1 스컬(HP1·2p·t2) 2 종이(HP5·3p·t5) 3 팩맨(HP9·9p·t5)
//      4 슬렌더(HP11·12p·t3) 5 문어(HP13·16p·t2) 6 서브웨이(HP15·21p·t6)

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

// 특정 종류만 남기고 나머지 0 (풀 넉넉히)
function only(id: number, count = 40): Counts {
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

async function act(
  request: APIRequestContext,
  room: string,
  nick: string,
  body: Record<string, unknown>,
) {
  return request.post("/api/defense/action", {
    data: { room, nickname: nick, ...body },
  });
}

async function combat(
  request: APIRequestContext,
  room: string,
  nick: string,
  instanceId: string,
  cardSlot: number,
) {
  const r = await act(request, room, nick, {
    action_type: "combat",
    target_monster_id: instanceId,
    used_card_slot: cardSlot,
  });
  expect(r.ok(), `${nick} combat slot${cardSlot}`).toBeTruthy();
}

function activeCount(s: State) {
  return s.cards.filter((c) => c.isActive).length;
}
function card(s: State, slot: number) {
  return s.cards.find((c) => c.cardSlot === slot)!;
}
function hasActiveMonster(s: State, id: string) {
  return s.monsters.some((m) => m.instanceId === id);
}

// ── 1. 처치 성공 + 균등 분배 + 나머지 소멸 ───────────────
test("[전투] 2명 3+2로 HP5 처치 → 3점 균등분배(1점씩·1점 소멸)", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 2);
  await config(request, room, only(2)); // 종이연구원만
  await advance(request, room, 1);
  const target = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 2,
  )!;
  await combat(request, room, "q1", target.instanceId, 3); // 3
  await combat(request, room, "q2", target.instanceId, 2); // 2 → 합 5
  await advance(request, room, 2);
  const s1 = await stateOf(request, room, "q1");
  const s2 = await stateOf(request, room, "q2");
  expect(hasActiveMonster(s1, target.instanceId), "몬스터 처치됨").toBe(false);
  expect(s1.score, "q1 점수").toBe(1);
  expect(s2.score, "q2 점수").toBe(1);
});

// ── 2. 오버킬이어도 점수는 동일 ──────────────────────────
test("[전투] 4+4=8로 HP5 오버킬 → 여전히 1점씩(오버킬 무관)", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 2);
  await config(request, room, only(2));
  await advance(request, room, 1);
  const target = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 2,
  )!;
  await combat(request, room, "q1", target.instanceId, 4);
  await combat(request, room, "q2", target.instanceId, 4);
  await advance(request, room, 2);
  expect((await stateOf(request, room, "q1")).score).toBe(1);
  expect((await stateOf(request, room, "q2")).score).toBe(1);
});

// ── 3+4. 처치 실패 → HP 누적 → 다음 라운드 단독 처치 ──────
test("[전투] 카드2로 실패(HP5→3 누적) 후 카드3으로 단독 처치(3점)", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 1);
  await config(request, room, only(2));
  await advance(request, room, 1);
  const t1 = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 2,
  )!;
  await combat(request, room, "q1", t1.instanceId, 2); // 2 < 5 → 실패
  await advance(request, room, 2);
  const mid = await stateOf(request, room, "q1");
  const same = mid.monsters.find((m) => m.instanceId === t1.instanceId)!;
  expect(same, "몬스터 생존").toBeTruthy();
  expect(same.currentHp, "HP 누적 5→3").toBe(3);
  expect(mid.score).toBe(0);
  await combat(request, room, "q1", t1.instanceId, 3); // 3 ≥ 3 → 처치
  await advance(request, room, 3);
  const end = await stateOf(request, room, "q1");
  expect(hasActiveMonster(end, t1.instanceId)).toBe(false);
  expect(end.score, "단독 처치 3점").toBe(3);
});

// ── 5. 나머지 0 분배 (팩맨 9점 3명) ──────────────────────
test("[전투] 3명 3+3+3=9로 팩맨(HP9·9점) 처치 → 3점씩(나머지 0)", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 3);
  await config(request, room, only(3)); // 복싱팩맨
  await advance(request, room, 1);
  const target = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 3,
  )!;
  for (const nick of ["q1", "q2", "q3"])
    await combat(request, room, nick, target.instanceId, 3);
  await advance(request, room, 2);
  for (const nick of ["q1", "q2", "q3"])
    expect((await stateOf(request, room, nick)).score, `${nick}`).toBe(3);
});

// ── 6. 큰 나머지 소멸 (서브웨이맨 21점 4명) ───────────────
test("[전투] 4명 4x4=16로 서브웨이맨(HP15·21점) 처치 → 5점씩(1점 소멸)", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 4);
  await config(request, room, only(6)); // 서브웨이맨
  await advance(request, room, 1);
  const target = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 6,
  )!;
  for (const nick of ["q1", "q2", "q3", "q4"])
    await combat(request, room, nick, target.instanceId, 4); // 합 16 ≥ 15
  await advance(request, room, 2);
  for (const nick of ["q1", "q2", "q3", "q4"])
    expect((await stateOf(request, room, nick)).score, `${nick}`).toBe(5); // 21/4=5
});

// ── 7. 휴식: 소진 카드 재활성 ────────────────────────────
test("[휴식] 전투로 비활성된 카드를 휴식으로 재활성", async ({ request }) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 1);
  await config(request, room, only(2));
  await advance(request, room, 1);
  const t = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 2,
  )!;
  await combat(request, room, "q1", t.instanceId, 4); // slot4 비활성(4<5 실패)
  let s = await stateOf(request, room, "q1");
  expect(card(s, 4).isActive, "전투 후 slot4 비활성").toBe(false);
  expect(activeCount(s)).toBe(3);
  await advance(request, room, 2);
  const rest = await act(request, room, "q1", {
    action_type: "rest",
    rest_slots: [4],
  });
  expect(rest.ok(), "휴식").toBeTruthy();
  s = await stateOf(request, room, "q1");
  expect(card(s, 4).isActive, "휴식 후 slot4 활성").toBe(true);
  expect(activeCount(s)).toBe(4);
});

// ── 8+9. 훈련: 영구 +1 + 강화값으로 단독 처치 ─────────────
test("[훈련] card1 희생해 card4→5 강화, 그 5로 HP5 단독 처치(3점)", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 1);
  await config(request, room, only(2));
  await advance(request, room, 1);
  const train = await act(request, room, "q1", {
    action_type: "training",
    training_from_slot: 1,
    training_to_slot: 4,
  });
  expect(train.ok(), "훈련").toBeTruthy();
  let s = await stateOf(request, room, "q1");
  expect(card(s, 1).isActive, "희생 카드 비활성").toBe(false);
  expect(card(s, 4).cardValue, "card4 영구 +1 → 5").toBe(5);
  await advance(request, room, 2);
  const t = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 2,
  )!;
  await combat(request, room, "q1", t.instanceId, 4); // 값 5 ≥ 5 → 단독 처치
  await advance(request, room, 3);
  s = await stateOf(request, room, "q1");
  expect(hasActiveMonster(s, t.instanceId)).toBe(false);
  expect(s.score, "강화값 단독 처치 3점").toBe(3);
});

// ── 10. 도망 페널티: 12명 전원 최댓값 카드 1장만 비활성 ────
test("[도망] 방치로 몬스터 도망 시 12명 전원 최댓값(4) 카드만 비활성", async ({
  request,
}) => {
  test.setTimeout(120_000);
  const room = await newRoom(request);
  await addPlayers(request, room, 12);
  await config(request, room, only(1)); // 스컬(잔여시간 2)
  await advance(request, room, 1); // 스폰(t2), 카드 4장 활성
  await advance(request, room, 2); // t2→1
  await advance(request, room, 3); // t1→0 도망 → 페널티
  for (let i = 1; i <= 12; i += 1) {
    const s = await stateOf(request, room, `q${i}`);
    expect(activeCount(s), `q${i} 활성 카드 3장(1장만 잠김)`).toBe(3);
    expect(card(s, 4).isActive, `q${i} 최댓값 카드(4) 비활성`).toBe(false);
    expect(card(s, 1).isActive && card(s, 2).isActive && card(s, 3).isActive).toBe(
      true,
    );
  }
});

// ── 11. 자동 세팅 프리셋 = 저장·스폰 일치 ────────────────
test("[프리셋] 12명 권장 조합이 저장되고 스폰/잔여 합이 총량과 일치", async ({
  request,
}) => {
  test.setTimeout(120_000);
  const room = await newRoom(request);
  await addPlayers(request, room, 12);
  const rec = recommendedMonsterCounts(12); // {1:9,2:6,3:7,4:6,5:5,6:3}
  const counts: Counts = Object.fromEntries(
    Object.entries(rec).map(([k, v]) => [k, v]),
  );
  await config(request, room, counts);
  // 저장된 base_count 가 조합과 일치
  const cfg = await (
    await request.get(`/api/gm/defense/monster-config?room=${room}`)
  ).json();
  for (const m of cfg.monsters as { id: number; base_count: number }[]) {
    expect(m.base_count, `id${m.id} base_count`).toBe(rec[m.id]);
  }
  // 본게임 시작 후 잔여풀 + 대기열 = 총량(36), 대기열은 5칸
  await stepTo(request, room, 4);
  const s = await stateOf(request, room, "q1");
  const dexRes = await (
    await request.get(`/api/defense/state?room=${room}&nickname=q1`)
  ).json();
  const remaining = (dexRes.dex as { remainingCount: number }[]).reduce(
    (a, d) => a + d.remainingCount,
    0,
  );
  const queue = s.monsters.length;
  expect(queue, "대기열 5칸").toBe(5);
  expect(remaining + queue, "잔여+대기열 = 총 36").toBe(36);
});

// ── 12+13. 타이브레이크(동점→누적데미지) + 중간 점수 스냅샷 ─
test("[순위] 동점 시 누적 데미지 우선 + 라운드 점수 스냅샷", async ({
  request,
}) => {
  const room = await newRoom(request);
  await addPlayers(request, room, 2);
  await config(request, room, only(2)); // 종이연구원 HP5
  await stepTo(request, room, 4); // 본게임 1라운드(누적 데미지는 round≥4만 집계)
  const target = (await stateOf(request, room, "q1")).monsters.find(
    (m) => m.monsterId === 2,
  )!;
  await combat(request, room, "q1", target.instanceId, 4); // 데미지 4
  await combat(request, room, "q2", target.instanceId, 2); // 데미지 2, 합 6 ≥ 5 처치
  await advance(request, room, 5); // round4 정산 + 스냅샷
  const board = await (
    await request.get(`/api/defense/board-scores?room=${room}&round=4`)
  ).json();
  const scores = board.scores as {
    nickname: string;
    points: number;
    damage: number;
  }[];
  // 둘 다 1점(3/2)인데, 누적 데미지 q1(4) > q2(2) → q1 이 1위
  expect(scores[0].points).toBe(1);
  expect(scores[1].points).toBe(1);
  expect(scores[0].nickname, "동점 시 데미지 큰 q1 우선").toBe("q1");
  expect(scores[0].damage).toBe(4);
  expect(scores[1].damage).toBe(2);
});
