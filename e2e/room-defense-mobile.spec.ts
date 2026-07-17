import { test, expect, type APIRequestContext } from "@playwright/test";
import { recommendedMonsterCounts } from "../lib/defense/composition";

// 모바일 뷰포트 렌더 검증 — 플레이어는 휴대폰으로 플레이한다.
// 대기열 5칸(12명) 상태에서 가로 오버플로가 없어야 한다.
const SHOT = "test-results/defense-mobile";

test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12/13/14 논리 해상도

async function setup12ToMain(request: APIRequestContext): Promise<string> {
  const room = (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
  for (let i = 1; i <= 12; i += 1)
    await request.post("/api/gm/players", { data: { room, nickname: `m${i}` } });
  await request.post("/api/gm/defense/monster-config", {
    data: { room, counts: recommendedMonsterCounts(12) },
  });
  for (let r = 1; r <= 4; r += 1)
    await request.post("/api/gm/defense/round", { data: { room, round: r } });
  return room;
}

async function noHOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("[모바일] 플레이어 화면(대기열 5칸) 가로 오버플로 없음", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const room = await setup12ToMain(request);

  await page.addInitScript(
    ({ r }) => {
      localStorage.setItem("owlgame:room", r as string);
      localStorage.setItem("owlgame:nickname", "m1");
      localStorage.setItem("owlgame:roomGame", "defense");
    },
    { r: room },
  );
  await page.goto(`/defense`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/player-info.png`, fullPage: true });
  expect(await noHOverflow(page), "정보 탭 가로 오버플로 없음").toBeLessThanOrEqual(2);

  // 행동 탭도 확인(몬스터/카드 선택 UI)
  await page.getByRole("button", { name: "행동" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT}/player-action.png`, fullPage: true });
  expect(await noHOverflow(page), "행동 탭 가로 오버플로 없음").toBeLessThanOrEqual(2);
});

test("[모바일] 결과중계 보드(대기열 5칸) 렌더", async ({ page, request }) => {
  test.setTimeout(120_000);
  const room = await setup12ToMain(request);
  await page.goto(`/defense-board?room=${room}`);
  await page.waitForLoadState("networkidle");
  let badges = 0;
  for (let i = 0; i < 14 && badges === 0; i += 1) {
    await page.getByRole("button", { name: "다음" }).click();
    await page.waitForTimeout(500);
    badges = await page.getByText(/\+\d+점/).count();
  }
  await page.screenshot({ path: `${SHOT}/board.png`, fullPage: true });
  expect(badges, "대기열 카드 5장").toBe(5);
  expect(await noHOverflow(page), "보드 가로 오버플로 없음").toBeLessThanOrEqual(2);
});
