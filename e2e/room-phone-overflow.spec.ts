import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import {
  addPlayers,
  createRoom,
  defenseAdvance,
  defenseConfigOnly,
  endRoom,
  horizontalOverflow,
  mafiaAct,
  mafiaAdvance,
  primePhone,
} from "./helpers/phone";

// Iteration 5 WS-B 5 — 폰 넘침 검사(360·390·412) + 터치 타깃 44px + aria-label.
// 헤드리스 크로미엄의 기본 --hide-scrollbars 를 꺼야 운영 폰과 같은 치수로 측정된다(반면교사 1-12).
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const WIDTHS = [360, 390, 412] as const;
const LONG_NICK = "아주아주긴닉네임열여덟글자입니다요"; // 18자(상한 20)
const rooms: string[] = [];

test.afterAll(async ({ request }) => {
  for (const r of rooms) await endRoom(request, r);
});

async function expectNoOverflow(page: Page, label: string) {
  expect(await horizontalOverflow(page), `${label} 가로 넘침`).toBeLessThanOrEqual(1);
}

/** 탭 버튼과 aria-label 이 붙은 주 버튼의 높이가 44px 이상인지 */
async function expectTouchTargets(page: Page, label: string) {
  const tabs = page.getByRole("tab");
  const n = await tabs.count();
  expect(n, `${label} 탭 수`).toBeGreaterThan(0);
  for (let i = 0; i < n; i += 1) {
    const box = await tabs.nth(i).boundingBox();
    expect(box?.height ?? 0, `${label} 탭 ${i} 높이`).toBeGreaterThanOrEqual(44);
    expect(await tabs.nth(i).getAttribute("aria-label"), `${label} 탭 ${i} aria-label`).toBeTruthy();
  }
  const mains = page.locator("main button[aria-label]:visible");
  const m = await mains.count();
  for (let i = 0; i < m; i += 1) {
    const box = await mains.nth(i).boundingBox();
    const name = await mains.nth(i).getAttribute("aria-label");
    expect(box?.height ?? 0, `${label} 버튼 '${name}' 높이`).toBeGreaterThanOrEqual(44);
  }
}

async function defenseRoom(request: APIRequestContext): Promise<string> {
  const room = await createRoom(request, "defense");
  rooms.push(room);
  const names = Array.from({ length: 11 }, (_, i) => `m${i + 1}`);
  await addPlayers(request, room, [LONG_NICK, ...names]); // 12명 → 대기열 5칸
  await defenseConfigOnly(request, room, 6, 40); // 서브웨이맨(이름·설명 길이)
  for (let r = 1; r <= 4; r += 1) await defenseAdvance(request, room, r);
  return room;
}

for (const width of WIDTHS) {
  test(`[디펜스 ${width}px] 정보·행동(선택 단계 포함)·규칙·도감·로그 탭 넘침 0 · 터치 44px`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 800 });
    const room = await defenseRoom(request);
    await primePhone(page, room, LONG_NICK, "defense");
    await page.goto("/defense");
    await expect(page.getByText("내 점수 및 카드")).toBeVisible();
    await expectNoOverflow(page, `정보 ${width}`);
    await expectTouchTargets(page, `정보 ${width}`);

    await page.getByTestId("tab-action").click();
    await expect(page.getByTestId("action-chooser")).toBeVisible();
    await expectNoOverflow(page, `행동 ${width}`);
    await expectTouchTargets(page, `행동 ${width}`);
    await page.getByRole("button", { name: "전투 선택" }).click();
    await expect(page.getByTestId("monster-0")).toBeVisible();
    await expectNoOverflow(page, `전투-몬스터 ${width}`);
    await expectTouchTargets(page, `전투-몬스터 ${width}`);
    await page.getByTestId("monster-0").click();
    await expect(page.getByTestId("card-1")).toBeVisible();
    await expectNoOverflow(page, `전투-카드 ${width}`);
    await expectTouchTargets(page, `전투-카드 ${width}`);
    await page.getByTestId("card-1").click();
    await page.getByTestId("confirm-combat").click();
    await expect(page.getByTestId("action-submitted")).toBeVisible();
    await expectNoOverflow(page, `제출됨 ${width}`);
    await expectTouchTargets(page, `제출됨 ${width}`);

    for (const tab of ["rules", "dex", "logs"]) {
      await page.getByTestId(`tab-${tab}`).click();
      await page.waitForTimeout(200);
      await expectNoOverflow(page, `${tab} ${width}`);
    }
    await page.screenshot({ path: `test-results/phone-overflow/defense-${width}.png`, fullPage: true });
  });
}

async function mafiaRoom(request: APIRequestContext): Promise<string> {
  const room = await createRoom(request, "mafia");
  rooms.push(room);
  await addPlayers(request, room, [LONG_NICK, "둘", "셋", "넷", "다섯"]);
  await mafiaAdvance(request, room, "auction");
  return room;
}

for (const width of WIDTHS) {
  test(`[마피아 ${width}px] 경매·거래·능력·투표·로그 탭 넘침 0 · 터치 44px`, async ({ page, request }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height: 800 });
    const room = await mafiaRoom(request);
    await primePhone(page, room, LONG_NICK, "mafia");
    await page.goto("/mafia");
    // ITER6 B3 — 경매 단계에 열면 경매 탭으로 간다. 정보 탭을 보는 검사는 먼저 정보 탭으로.
    await page.getByTestId("tab-info").click();
    await expect(page.getByText("보유 현금")).toBeVisible();
    await expectNoOverflow(page, `정보 ${width}`);
    await expectTouchTargets(page, `정보 ${width}`);

    for (const tab of ["rules", "stocks", "result", "log"]) {
      await page.getByTestId(`tab-${tab}`).click();
      await page.waitForTimeout(200);
      await expectNoOverflow(page, `${tab} ${width}`);
    }
    await page.getByTestId("tab-auction").click();
    await expect(page.getByTestId("auction-job-robber")).toBeVisible();
    await expectNoOverflow(page, `경매 ${width}`);
    await expectTouchTargets(page, `경매 ${width}`);
    await page.getByTestId("auction-job-robber").click();
    await expectNoOverflow(page, `경매-금액 ${width}`);
    await expectTouchTargets(page, `경매-금액 ${width}`);

    // 거래 페이즈(강도 낙찰 → 능력 탭에 대상 버튼이 뜬다)
    await mafiaAct(request, room, LONG_NICK, "bet", { job: "robber", amount: 3 });
    await mafiaAdvance(request, room, "trade");
    await expect(page.getByTestId("tab-trade")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("tab-trade").click();
    await expect(page.getByTestId("buy-국채")).toBeVisible();
    await expectNoOverflow(page, `거래 ${width}`);
    await expectTouchTargets(page, `거래 ${width}`);
    await page.getByTestId("buy-국채").click();
    await expectNoOverflow(page, `거래-수량 ${width}`);
    await page.getByTestId("tab-ability").click();
    await expect(page.getByRole("button", { name: "능력 사용 제출" })).toBeVisible();
    await expectNoOverflow(page, `능력 ${width}`);
    await expectTouchTargets(page, `능력 ${width}`);

    // 투표 페이즈
    await mafiaAdvance(request, room, "apply");
    await mafiaAdvance(request, room, "vote");
    await expect(page.getByTestId("tab-vote")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("tab-vote").click();
    await expect(page.getByTestId("vote-target-둘")).toBeVisible();
    await expectNoOverflow(page, `투표 ${width}`);
    await expectTouchTargets(page, `투표 ${width}`);
    await page.getByTestId("vote-target-둘").click();
    await expect(page.getByTestId("vote-submit")).toBeVisible();
    await expectNoOverflow(page, `투표-제출 ${width}`);
    await expectTouchTargets(page, `투표-제출 ${width}`);

    await page.getByTestId("tab-log").click();
    await expect(page.getByTestId("mafia-log")).toBeVisible();
    await expectNoOverflow(page, `로그 ${width}`);
    await page.screenshot({ path: `test-results/phone-overflow/mafia-${width}.png`, fullPage: true });
  });
}
