import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  addPlayers,
  createRoom,
  defenseAct,
  defenseAdvance,
  defenseConfigOnly,
  defenseState,
  endRoom,
  primePhone,
} from "./helpers/phone";

// 디펜스 행동 제출 계약 검증 — ITER6(2026-10-18 또니) 낙장불입.
//  같은 라운드에 이미 제출했으면 두 번째(다른 내용) 제출은 409 already_submitted, 같은 내용 재전송은 멱등 200.
//  폰 라운드≠서버 라운드 → 409, 종료된 방 → 409, 처음 제출한 행동만 정산에 들어간다.
//  (ITER5의 "덮어쓰기/다시 고르기" 계약을 대체 — 파일 이름은 이력 유지를 위해 그대로 둔다)
test.describe.configure({ mode: "serial" });

const rooms: string[] = [];

async function setup(request: APIRequestContext, players: string[]): Promise<string> {
  const room = await createRoom(request, "defense");
  rooms.push(room);
  await addPlayers(request, room, players);
  await defenseConfigOnly(request, room, 2); // 종이 연구원(HP5·t5)만 → 결정론적
  await defenseAdvance(request, room, 1); // 튜토리얼 1라운드(행동 가능)
  return room;
}

function card(s: { cards: { cardSlot: number; cardValue: number; isActive: boolean }[] }, slot: number) {
  return s.cards.find((c) => c.cardSlot === slot)!;
}

test.afterAll(async ({ request }) => {
  for (const r of rooms) await endRoom(request, r);
});

test("[낙장불입] 두 번째 다른 제출은 409 already_submitted — 행동·카드 그대로, 같은 내용 재전송은 멱등 200", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const s0 = await defenseState(request, room, "q1");
  const target = s0.monsters[0].instanceId;

  // 1) 전투 slot4
  let r = await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4, round: s0.round });
  expect(r.status(), await r.text()).toBe(200);
  let s = await defenseState(request, room, "q1");
  expect(card(s, 4).isActive).toBe(false);
  expect(s.action?.usedCardValue).toBe(4);

  // 2) 다른 카드로 전투 → 409, 그대로
  r = await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 2, round: s.round });
  expect(r.status()).toBe(409);
  const j = await r.json();
  expect(j.reason).toBe("already_submitted");
  expect(j.error).toBe("이미 제출한 행동은 바꿀 수 없습니다.");
  // 3) 훈련 → 409
  r = await defenseAct(request, room, "q1", { action_type: "training", training_from_slot: 1, training_to_slot: 3, round: s.round });
  expect(r.status()).toBe(409);
  expect((await r.json()).reason).toBe("already_submitted");
  s = await defenseState(request, room, "q1");
  expect(s.action?.actionType).toBe("combat");
  expect(s.action?.usedCardValue).toBe(4);
  expect(card(s, 4).isActive).toBe(false);
  expect(card(s, 2).isActive).toBe(true);
  expect(card(s, 3).cardValue, "훈련 효과 없음").toBe(3);
  expect(s.cards.filter((c) => !c.isActive).length).toBe(1);

  // 4) 같은 내용 재전송(응답 유실 뒤 재시도) → 멱등 200, 아무것도 바뀌지 않음
  r = await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4, round: s.round });
  expect(r.status(), await r.text()).toBe(200);
  expect((await r.json()).idempotent).toBe(true);
  s = await defenseState(request, room, "q1");
  expect(s.cards.filter((c) => !c.isActive).length).toBe(1);
  expect(s.logs.filter((l) => l.log.startsWith("행동 변경:")).length, "변경 로그 없음").toBe(0);
});

test("[409] 폰 라운드가 서버와 다르면 round_mismatch, 행동 없음·카드 그대로", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const s0 = await defenseState(request, room, "q1");
  const r = await defenseAct(request, room, "q1", {
    action_type: "combat",
    target_monster_id: s0.monsters[0].instanceId,
    used_card_slot: 4,
    round: s0.round + 1,
  });
  expect(r.status()).toBe(409);
  expect((await r.json()).reason).toBe("round_mismatch");
  const s = await defenseState(request, room, "q1");
  expect(s.action).toBeNull();
  expect(s.cards.every((c) => c.isActive)).toBe(true);
});

test("[정산] 처음 제출한 행동만 정산에 들어간다(전투 4 뒤 전투 2 는 409 → 피해 4)", async ({ request }) => {
  const room = await setup(request, ["q1", "q2"]);
  const s0 = await defenseState(request, room, "q1");
  const target = s0.monsters[0].instanceId; // HP 5
  expect((await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4 })).status()).toBe(200);
  expect((await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 2 })).status()).toBe(409);
  await defenseAdvance(request, room, 2);
  const s = await defenseState(request, room, "q1");
  const m = s.monsters.find((x) => x.instanceId === target);
  expect(m, "HP5 몬스터는 피해 4 로 살아 있다").toBeTruthy();
  expect(m!.currentHp).toBe(1);
  // 새 라운드: 이전 라운드 행동은 "이번 라운드 행동"이 아니다(폰이 초기화되는 근거)
  expect(s.action?.round).toBe(1);
  expect(s.round).toBe(2);
});

test("[동시] 같은 사람이 동시에 두 번 제출해도 행동 1건·카드 상태 일치", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const s0 = await defenseState(request, room, "q1");
  const target = s0.monsters[0].instanceId;
  const [a, b] = await Promise.all([
    defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4 }),
    defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 3 }),
  ]);
  const statuses = [a.status(), b.status()].sort();
  expect(statuses.every((s) => s === 200 || s === 409), `statuses ${statuses}`).toBe(true);
  expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
  const s = await defenseState(request, room, "q1");
  expect(s.action?.actionType).toBe("combat");
  const inactive = s.cards.filter((c) => !c.isActive);
  expect(inactive.length, "비활성 카드는 정확히 1장").toBe(1);
  expect(inactive[0].cardValue, "비활성 카드 = 저장된 행동의 카드").toBe(s.action?.usedCardValue);
});

test("[소프트 타이머] 타이머 상태와 무관하게 라운드가 진행 중이면 제출된다", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  // 타이머를 시작한 뒤 바로 리셋(0 이후와 같은 '타이머가 서 있는' 상태)해도 서버는 막지 않는다
  await request.post("/api/gm/timers/defense", { data: { room, action: "start" } });
  await request.post("/api/gm/timers/defense", { data: { room, action: "pause" } });
  const s0 = await defenseState(request, room, "q1");
  const r = await defenseAct(request, room, "q1", { action_type: "rest", rest_slots: [1], round: s0.round });
  // 전부 활성이라 휴식은 400 이지만, "타이머" 때문이 아니라 검증 때문이어야 한다
  expect(r.status()).toBe(400);
  expect((await r.json()).reason).toBe("invalid_action");
  const r2 = await defenseAct(request, room, "q1", {
    action_type: "combat",
    target_monster_id: s0.monsters[0].instanceId,
    used_card_slot: 1,
    round: s0.round,
  });
  expect(r2.status()).toBe(200);
});

test("[종료된 방] 행동 API 409 room_ended", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const s0 = await defenseState(request, room, "q1");
  await endRoom(request, room);
  const r = await defenseAct(request, room, "q1", {
    action_type: "combat",
    target_monster_id: s0.monsters[0].instanceId,
    used_card_slot: 1,
  });
  expect(r.status()).toBe(409);
  expect((await r.json()).reason).toBe("room_ended");
  const s = await defenseState(request, room, "q1");
  expect(s.roomStatus).toBe("ended");
});

test("[입력] 잘못된 형식은 400/403 이고 500 은 없다", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const bodies: Record<string, unknown>[] = [
    {},
    { room },
    { room, nickname: 123 },
    { room, nickname: "q1" },
    { room, nickname: "q1", action_type: "COMBAT" },
    { room, nickname: "q1", action_type: "combat", target_monster_id: 7, used_card_slot: "4" },
    { room, nickname: "q1", action_type: "combat", target_monster_id: "not-a-uuid", used_card_slot: 4 },
    { room, nickname: "q1", action_type: "training", training_from_slot: 1.5, training_to_slot: 2 },
    { room, nickname: "q1", action_type: "rest", rest_slots: "1" },
    { room, nickname: "q1", action_type: "rest", rest_slots: [1], round: "1" },
    { room, nickname: "없는사람", action_type: "rest", rest_slots: [1] },
  ];
  for (const body of bodies) {
    const r = await request.post("/api/defense/action", { data: body });
    expect(r.status(), JSON.stringify(body)).toBeLessThan(500);
  }
  // 닉네임 변형: 조합형(NFD)·제로폭이 섞여도 같은 사람
  const s = await request.get(`/api/defense/state?room=${room}&nickname=${encodeURIComponent("q1".normalize("NFD") + "​")}`);
  expect(s.status()).toBe(200);
});

test("[폰] 제출 완료 → 다시 고르기 없음(낙장불입) → 라운드가 바뀌면 새로 고른다", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const room = await setup(request, ["q1"]);
  await primePhone(page, room, "q1", "defense");
  await page.goto("/defense");
  await expect(page.getByText("내 점수 및 카드")).toBeVisible({ timeout: 30_000 }); // 첫 컴파일 대기
  await page.getByTestId("tab-action").click();
  await expect(page.getByTestId("action-chooser")).toBeVisible({ timeout: 15_000 });

  // 전투 → 몬스터 1번 → 카드 4 → 확정
  await page.getByRole("button", { name: "전투 선택" }).click();
  await page.getByTestId("monster-0").click();
  await page.getByTestId("card-4").click();
  await page.getByTestId("confirm-combat").click();
  await expect(page.getByTestId("action-submitted")).toBeVisible();
  await expect(page.getByTestId("submitted-label")).toHaveText("제출됨 · 제출한 행동은 바꿀 수 없습니다");
  await expect(page.getByTestId("action-submitted")).toContainText("숫자 4 카드");
  await expect(page.getByTestId("repick-button")).toHaveCount(0);
  await expect(page.getByTestId("repick-banner")).toHaveCount(0);
  await expect(page.getByText("다시 고르기")).toHaveCount(0);
  await page.screenshot({ path: "test-results/iter6-c6-submitted.png" });

  // 서버에도 전투 1건
  const s = await defenseState(request, room, "q1");
  expect(s.action?.actionType).toBe("combat");

  // GM이 라운드를 넘기면 행동 탭이 초기화되어 새 라운드 행동을 고를 수 있다
  await defenseAdvance(request, room, 2);
  await expect(page.getByTestId("action-chooser")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("튜토리얼 2라운드")).toBeVisible();
});
