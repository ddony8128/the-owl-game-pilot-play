import { test, expect, type APIRequestContext } from "@playwright/test";
import { recommendedMonsterCounts } from "../lib/defense/composition";

// 브라우저 실제 렌더 검증: 12명·대기열 5칸 상태의 결과중계/플레이어/대시보드 화면.
// 스크린샷은 gitignore되는 test-results/ 아래에 저장(머신 독립).
const SHOT = "test-results/defense-ui";

async function setup(request: APIRequestContext, players: number): Promise<string> {
  const room = (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
  for (let i = 1; i <= players; i += 1) {
    await request.post("/api/gm/players", {
      data: { room, nickname: `u${i}` },
    });
  }
  return room;
}

async function toMainRound4(request: APIRequestContext, room: string) {
  await request.post("/api/gm/defense/monster-config", {
    data: { room, counts: recommendedMonsterCounts(12) },
  });
  for (let r = 1; r <= 4; r += 1)
    await request.post("/api/gm/defense/round", { data: { room, round: r } });
}

test("[UI] 12명·5칸: 결과중계 & 플레이어 화면 렌더, 가로 오버플로 없음", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const room = await setup(request, 12);
  await toMainRound4(request, room);

  // ── 결과중계 보드 (준비 화면에서 [다음]으로 대기열 뷰까지 스텝) ──
  await page.goto(`/defense-board?room=${room}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  let badges = 0;
  for (let i = 0; i < 14 && badges === 0; i += 1) {
    await page.getByRole("button", { name: "다음" }).click();
    await page.waitForTimeout(600);
    badges = await page.getByText(/\+\d+점/).count();
  }
  await page.screenshot({ path: `${SHOT}/board.png`, fullPage: true });
  // 대기열 5마리 → 보상 배지(+N점)가 5개, 가로 오버플로 없음
  expect(badges, "대기열 카드 5장 렌더").toBe(5);
  const boardOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(boardOverflow, "보드 가로 오버플로 없음").toBeLessThanOrEqual(2);

  // ── 플레이어 화면 (localStorage 시딩 로그인) ──
  await page.addInitScript(
    ({ r }) => {
      localStorage.setItem("owlgame:room", r as string);
      localStorage.setItem("owlgame:nickname", "u1");
      localStorage.setItem("owlgame:roomGame", "defense");
    },
    { r: room },
  );
  await page.goto(`/defense`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/player.png`, fullPage: true });
  const playerOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(playerOverflow, "플레이어 가로 오버플로 없음").toBeLessThanOrEqual(2);
});

test("[UI] GM 대시보드: 대기열 표시 + [인원 기준 자동 세팅] 버튼 동작", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const room = await setup(request, 12);

  await page.goto(`/dashboard/x9a2k7/defense?room=${room}`);
  await page.waitForLoadState("networkidle");

  const section = page.locator('section:has-text("몬스터 수 조절")');
  await expect(section).toBeVisible();
  await expect(section.getByText(/대기열\s*5\s*칸/)).toBeVisible(); // 유동 표시

  const preset = section.getByRole("button", { name: "인원 기준 자동 세팅" });
  await expect(preset).toBeEnabled();
  await page.screenshot({ path: `${SHOT}/dash-before.png`, fullPage: true });

  await preset.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT}/dash-after.png`, fullPage: true });

  // 6개 몬스터 입력값 = 12명 프리셋 [9,6,7,6,5,3]
  const vals = await section
    .locator('input[type="number"]')
    .evaluateAll((els) =>
      els.map((e) => Number((e as HTMLInputElement).value)),
    );
  expect(vals, "프리셋 입력값").toEqual([9, 6, 7, 6, 5, 3]);
});
