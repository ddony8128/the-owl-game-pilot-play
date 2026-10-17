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

// Iteration 5 WS-B 2 — 디펜스 행동 변경(upsert) 계약 검증.
//  라운드 진행 전까지 같은 라운드 행동을 다시 제출하면 덮어쓴다(이전 행동의 카드 효과는 되돌아간다).
//  폰 라운드≠서버 라운드 → 409, 종료된 방 → 409, 마지막 선택만 정산에 들어간다.
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

test("[변경] 전투→전투(다른 카드)→훈련→전투 로 바꾸면 이전 효과가 되돌아가고 행동은 1건", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const s0 = await defenseState(request, room, "q1");
  const target = s0.monsters[0].instanceId;

  // 1) 전투 slot4
  let r = await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4, round: s0.round });
  expect(r.status(), await r.text()).toBe(200);
  expect((await r.json()).replaced).toBe(false);
  let s = await defenseState(request, room, "q1");
  expect(card(s, 4).isActive).toBe(false);
  expect(s.action?.actionType).toBe("combat");
  expect(s.action?.usedCardValue).toBe(4);

  // 2) 전투 slot2 로 변경 → slot4 되살아나고 slot2 비활성
  r = await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 2, round: s.round });
  expect(r.status(), await r.text()).toBe(200);
  expect((await r.json()).replaced).toBe(true);
  s = await defenseState(request, room, "q1");
  expect(card(s, 4).isActive, "이전 전투 카드 복구").toBe(true);
  expect(card(s, 2).isActive).toBe(false);
  expect(s.action?.usedCardValue).toBe(2);

  // 3) 훈련(1 → 3 강화)으로 변경 → slot2 복구, slot1 비활성, slot3 값 4
  r = await defenseAct(request, room, "q1", { action_type: "training", training_from_slot: 1, training_to_slot: 3, round: s.round });
  expect(r.status(), await r.text()).toBe(200);
  s = await defenseState(request, room, "q1");
  expect(card(s, 2).isActive).toBe(true);
  expect(card(s, 1).isActive).toBe(false);
  expect(card(s, 3).cardValue).toBe(4);
  expect(s.action?.actionType).toBe("training");

  // 4) 다시 전투 slot4 → 훈련 효과(값 +1, 비활성) 모두 되돌아감
  r = await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4, round: s.round });
  expect(r.status(), await r.text()).toBe(200);
  s = await defenseState(request, room, "q1");
  expect(card(s, 1).isActive, "훈련 희생 카드 복구").toBe(true);
  expect(card(s, 3).cardValue, "훈련 +1 되돌림").toBe(3);
  expect(card(s, 4).isActive).toBe(false);
  expect(s.cards.filter((c) => c.isActive).length).toBe(3);
  expect(s.logs.filter((l) => l.log.startsWith("행동 변경:")).length, "변경 로그 3건").toBe(3);
});

test("[변경] 새 선택이 검증에 실패하면 이전 선택이 그대로 남는다", async ({ request }) => {
  const room = await setup(request, ["q1"]);
  const s0 = await defenseState(request, room, "q1");
  const target = s0.monsters[0].instanceId;
  await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4 });
  // 되돌린 상태(전부 활성)에서는 휴식할 비활성 카드가 없다 → 400, 기존 전투 유지
  const r = await defenseAct(request, room, "q1", { action_type: "rest", rest_slots: [4] });
  expect(r.status()).toBe(400);
  const s = await defenseState(request, room, "q1");
  expect(s.action?.actionType).toBe("combat");
  expect(card(s, 4).isActive).toBe(false);
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

test("[정산] 마지막 선택만 정산에 들어간다(전투 4 → 전투 2 로 바꾸면 피해 2)", async ({ request }) => {
  const room = await setup(request, ["q1", "q2"]);
  const s0 = await defenseState(request, room, "q1");
  const target = s0.monsters[0].instanceId; // HP 5
  await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 4 });
  await defenseAct(request, room, "q1", { action_type: "combat", target_monster_id: target, used_card_slot: 2 });
  await defenseAdvance(request, room, 2);
  const s = await defenseState(request, room, "q1");
  const m = s.monsters.find((x) => x.instanceId === target);
  expect(m, "HP5 몬스터는 피해 2 로 살아 있다").toBeTruthy();
  expect(m!.currentHp).toBe(3);
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

test("[폰] 제출됨 → 다시 고르기 → 변경 확정 → 라운드가 바뀌면 초기화", async ({ page, request }) => {
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
  await expect(page.getByTestId("submitted-label")).toContainText("제출됨 · 바꾸려면 다시 고르세요");
  await expect(page.getByTestId("action-submitted")).toContainText("숫자 4 카드");

  // 다시 고르기 → 배너 → 훈련(1 → 2)으로 변경 확정(확인 단계 유지)
  await page.getByTestId("repick-button").click();
  await expect(page.getByTestId("repick-banner")).toBeVisible();
  await page.getByRole("button", { name: "훈련 선택" }).click();
  await page.getByRole("button", { name: "숫자 1 카드를 비활성화" }).click();
  await page.getByRole("button", { name: "숫자 2 카드를 3로 강화" }).click();
  const confirm = page.getByTestId("confirm-training");
  await expect(confirm).toHaveText(/훈련으로 변경 확정/);
  await confirm.click();
  await expect(page.getByTestId("action-submitted")).toBeVisible();
  await expect(page.getByTestId("submitted-label")).toContainText("변경됨");
  await expect(page.getByTestId("action-submitted")).toContainText("훈련");

  // 서버에도 훈련 1건만
  const s = await defenseState(request, room, "q1");
  expect(s.action?.actionType).toBe("training");
  expect(card(s, 4).isActive, "이전 전투 카드가 복구됨").toBe(true);

  // GM이 라운드를 넘기면 행동 탭이 초기화되어 다시 고를 수 있다
  await defenseAdvance(request, room, 2);
  await expect(page.getByTestId("action-chooser")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("튜토리얼 2라운드")).toBeVisible();
});
