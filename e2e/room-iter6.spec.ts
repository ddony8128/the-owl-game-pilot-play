import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { addPlayers, createRoom, endRoom, mafiaAdvance, mafiaRound, primePhone, openPanels } from "./helpers/phone";
import { PRIVATE_KEY_RE, launchBoardBrowser, openBoard } from "./board-helpers";

// ITER6(2026-10-18 CBT 피드백) — B3 단계별 탭 자동 이동 · B4 보드 투표 결과 · B5/C5 폰 토글 · C1 첫 접속 · C4 도감.
// (C6 낙장불입은 room-defense-action-change.spec.ts)
test.describe.configure({ mode: "serial" });

const rooms: string[] = [];
const SHOTS = "C:/not_system/project/ai-runner/missions/owl-main/shots";

test.afterAll(async ({ request }) => {
  for (const r of rooms) await endRoom(request, r);
});

async function newRoom(request: APIRequestContext, game: "mafia" | "defense", names: string[]) {
  const room = await createRoom(request, game);
  rooms.push(room);
  const ids = await addPlayers(request, room, names);
  return { room, ids };
}

const selectedTab = (page: Page) => page.locator('[data-testid^="tab-"][aria-selected="true"]');

test("[B3] 마피아 단계가 바뀌면 폰이 그 단계 탭으로 한 번 이동하고, 그 뒤 참가자가 옮긴 탭은 존중한다", async ({ page, request }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { room } = await newRoom(request, "mafia", ["탭1", "탭2", "탭3", "탭4", "탭5"]);
  await primePhone(page, room, "탭1", "mafia");
  await page.goto("/mafia");
  await expect(selectedTab(page)).toHaveAttribute("data-testid", "tab-info", { timeout: 30_000 });

  const expectTab = async (key: string) =>
    expect(selectedTab(page)).toHaveAttribute("data-testid", `tab-${key}`, { timeout: 15_000 });

  await mafiaAdvance(request, room, "auction");
  await expectTab("auction");
  // 참가자가 주가 탭으로 옮기면 폴링이 돌아도 경매 탭으로 끌려가지 않는다(다음 전이까지)
  await page.getByTestId("tab-stocks").click();
  await page.waitForTimeout(3000);
  await expectTab("stocks");

  await mafiaAdvance(request, room, "trade");
  await expectTab("trade");
  await mafiaAdvance(request, room, "apply");
  await expectTab("result");
  await mafiaAdvance(request, room, "vote");
  await expectTab("vote");
  await mafiaAdvance(request, room, "end");
  await expectTab("result");
  await mafiaRound(request, room, 1);
  await expectTab("info");
});

test("[B4] 라운드 종료 때 보드에 경제사범 결과 — 마피아 지목(튜토리얼) · 동점이면 경제사범 없음, 득표수 비공개", async ({ request }) => {
  test.setTimeout(180_000);
  const names = ["보드1", "보드2", "보드3", "보드4", "보드5"];
  const { room, ids } = await newRoom(request, "mafia", names);
  const browser = await launchBoardBrowser();
  const { ctx, page } = await openBoard(browser, `/mafia-board?room=${room}`, { pollMs: 500, holdScale: 0.2 });
  try {
    // 튜토리얼: 보드1 이 강도(마피아) 낙찰 → 나머지가 보드1 에게 투표 → 경제사범 = 마피아
    await mafiaAdvance(request, room, "auction");
    const bet = await request.post("/api/mafia/action", {
      data: { room, nickname: "보드1", type: "bet", payload: { job: "robber", amount: 2 } },
    });
    expect(bet.ok(), await bet.text()).toBeTruthy();
    await mafiaAdvance(request, room, "trade");
    await mafiaAdvance(request, room, "apply");
    await mafiaAdvance(request, room, "vote");
    for (const n of ["보드2", "보드3", "보드4"]) {
      const v = await request.post("/api/mafia/vote", { data: { room, nickname: n, target_id: ids["보드1"], vote_count: 1 } });
      expect(v.ok(), await v.text()).toBeTruthy();
    }
    await mafiaAdvance(request, room, "end");

    const s0 = await (await request.get(`/api/mafia/board-summary?room=${room}`)).json();
    expect(s0.voteResult).toEqual({ round: 0, outcome: "mafia", nickname: "보드1" });
    const raw0 = JSON.stringify(s0);
    expect(raw0, "결과 공개 전 비공개 키 없음").not.toMatch(PRIVATE_KEY_RE);
    expect(raw0, "득표수 비노출").not.toMatch(/vote_count|votes/);

    const box = page.getByTestId("board-vote-result");
    await expect(box).toBeVisible({ timeout: 20_000 });
    await expect(box).toHaveAttribute("data-outcome", "mafia");
    await expect(page.getByTestId("board-vote-nickname")).toHaveText("보드1");
    await expect(page.getByTestId("board-vote-verdict")).toHaveText("마피아였습니다");
    await expect(box).toContainText("튜토리얼 투표 결과");
    await page.screenshot({ path: `${SHOTS}/iter6-b4-board-vote-mafia.png` });

    // 1라운드: 보드2·보드3 동점 → 경제사범 없음
    await mafiaRound(request, room, 1);
    await expect(box).toHaveCount(0, { timeout: 15_000 });
    await mafiaAdvance(request, room, "auction");
    await mafiaAdvance(request, room, "trade");
    await mafiaAdvance(request, room, "apply");
    await mafiaAdvance(request, room, "vote");
    expect((await request.post("/api/mafia/vote", { data: { room, nickname: "보드4", target_id: ids["보드2"], vote_count: 1 } })).ok()).toBeTruthy();
    expect((await request.post("/api/mafia/vote", { data: { room, nickname: "보드5", target_id: ids["보드3"], vote_count: 1 } })).ok()).toBeTruthy();
    await mafiaAdvance(request, room, "end");
    await expect(page.getByTestId("board-vote-result")).toHaveAttribute("data-outcome", "none", { timeout: 20_000 });
    await expect(page.getByTestId("board-vote-none")).toContainText("경제사범 없음");
    await page.screenshot({ path: `${SHOTS}/iter6-b4-board-vote-none.png` });
  } finally {
    await ctx.close();
    await browser.close();
  }
});

test("[B4] 마피아가 아닌 사람이 지목되면 '마피아가 아니었습니다'", async ({ request }) => {
  test.setTimeout(120_000);
  const { room, ids } = await newRoom(request, "mafia", ["시민1", "시민2", "시민3", "시민4", "시민5"]);
  await mafiaAdvance(request, room, "auction");
  for (const p of ["trade", "apply", "vote"]) await mafiaAdvance(request, room, p);
  for (const n of ["시민2", "시민3"]) {
    expect((await request.post("/api/mafia/vote", { data: { room, nickname: n, target_id: ids["시민1"], vote_count: 2 } })).ok()).toBeTruthy();
  }
  await mafiaAdvance(request, room, "end");
  const s = await (await request.get(`/api/mafia/board-summary?room=${room}`)).json();
  expect(s.voteResult).toEqual({ round: 0, outcome: "citizen", nickname: "시민1" });
});

test("[B5] 마피아 대시보드 '참가자 폰 로그 탭' 스위치 — 끄면 폰에서 로그 탭이 사라지고(보던 중이면 정보 탭), 켜면 다시 보인다", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const { room } = await newRoom(request, "mafia", ["로그1", "로그2", "로그3", "로그4", "로그5"]);
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await primePhone(phone, room, "로그1", "mafia");
  await phone.goto("/mafia");
  await expect(phone.getByTestId("tab-log")).toBeVisible({ timeout: 30_000 });
  await phone.getByTestId("tab-log").click();
  await expect(selectedTab(phone)).toHaveAttribute("data-testid", "tab-log");

  const gm = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await gm.goto(`/dashboard/x9a2k7/mafia?room=${room}`);
  await openPanels(gm);
  const sw = gm.getByTestId("toggle-phone_logs");
  await expect(sw).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
  await gm.getByTestId("phone-toggles").screenshot({ path: `${SHOTS}/iter6-b5-mafia-toggle-off.png` });

  await expect(phone.getByTestId("tab-log")).toHaveCount(0, { timeout: 15_000 });
  await expect(selectedTab(phone)).toHaveAttribute("data-testid", "tab-info");
  const st = await (await request.get(`/api/mafia/state?room=${room}&nickname=${encodeURIComponent("로그1")}`)).json();
  expect(st.phoneLogs).toBe(false);
  const dash = await (await request.get(`/api/gm/mafia/dashboard?room=${room}`)).json();
  expect(dash.gmLogs.some((l: { content: string }) => l.content.includes("참가자 폰 로그 탭 숨기기"))).toBe(true);

  // 다시 켜기(API) → 로그 탭이 돌아온다
  expect((await request.patch("/api/gm/rooms", { data: { code: room, phone_logs: true } })).ok()).toBeTruthy();
  await expect(phone.getByTestId("tab-log")).toBeVisible({ timeout: 15_000 });
  await expect(sw).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  // 잘못된 값은 400
  expect((await request.patch("/api/gm/rooms", { data: { code: room, phone_logs: "no" } })).status()).toBe(400);
  await phone.close();
  await gm.close();
});

test("[C5·C4] 디펜스 스위치 2개(로그 탭·도감 남은 수) 켜기/끄기 + 도감에 '전체 n마리' 없음", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const { room } = await newRoom(request, "defense", ["도감1", "도감2", "도감3", "도감4", "도감5", "도감6"]);
  expect((await request.post("/api/gm/defense/round", { data: { room, round: 1 } })).ok()).toBeTruthy();
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await primePhone(phone, room, "도감1", "defense");
  await phone.goto("/defense");
  await expect(phone.getByTestId("tab-dex")).toBeVisible({ timeout: 30_000 });
  await phone.getByTestId("tab-dex").click();
  await expect(phone.getByTestId("dex-remaining").first()).toBeVisible();
  await expect(phone.getByText(/전체 \d+마리/)).toHaveCount(0);
  await expect(phone.getByTestId("tab-logs")).toBeVisible();

  const gm = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await gm.goto(`/dashboard/x9a2k7/defense?room=${room}`);
  await openPanels(gm);
  const swLogs = gm.getByTestId("toggle-phone_logs");
  const swRemain = gm.getByTestId("toggle-phone_remaining_count");
  await expect(swRemain).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
  await swRemain.click();
  await expect(swRemain).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
  await swLogs.click();
  await expect(swLogs).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
  await gm.getByTestId("phone-toggles").screenshot({ path: `${SHOTS}/iter6-c5-defense-toggles-off.png` });

  await expect(phone.getByTestId("dex-remaining")).toHaveCount(0, { timeout: 15_000 });
  await expect(phone.getByTestId("tab-logs")).toHaveCount(0, { timeout: 15_000 });
  await phone.screenshot({ path: `${SHOTS}/iter6-c5-phone-dex-hidden.png` });

  expect((await request.patch("/api/gm/rooms", { data: { code: room, phone_logs: true, phone_remaining_count: true } })).ok()).toBeTruthy();
  await expect(phone.getByTestId("tab-logs")).toBeVisible({ timeout: 15_000 });
  await phone.getByTestId("tab-dex").click();
  await expect(phone.getByTestId("dex-remaining").first()).toBeVisible({ timeout: 15_000 });
  const dash = await (await request.get(`/api/gm/defense/dashboard?room=${room}`)).json();
  expect(dash.phoneToggles).toMatchObject({ phoneLogs: true, phoneRemainingCount: true });
  await phone.close();
  await gm.close();
});

test("[C1-a] 세션 없는 새 브라우저: /defense·/mafia 직접 → 입장 화면, 없는 주소 → 중립 안내 + [입장 화면으로], /join?room= 은 QR 안내", async ({ browser, request }) => {
  test.setTimeout(90_000);
  const { room } = await newRoom(request, "defense", ["입장1"]);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  for (const path of ["/defense", "/mafia"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByPlaceholder("방 코드 (예: A3F82)")).toBeVisible();
    await expect(page.getByText("정상적이지 않은 접근")).toHaveCount(0);
  }
  await page.goto("/no-such-page-iter6");
  await expect(page.getByTestId("not-found")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("주소를 확인해 주세요")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/iter6-c1-not-found.png` });
  await page.getByTestId("address-notice-home").click();
  await expect(page.getByPlaceholder("방 코드 (예: A3F82)")).toBeVisible({ timeout: 15_000 });
  // QR 이 담는 주소(/?code=)와 /join?room=
  await page.goto(`/?code=${room}`);
  await expect(page.getByPlaceholder("방 코드 (예: A3F82)")).toHaveValue(room, { timeout: 15_000 });
  await page.goto(`/join?room=${room}`);
  await expect(page.getByText(room).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("정상적이지 않은 접근")).toHaveCount(0);
  // QR 주소로 입장 → 디펜스 화면
  await page.goto(`/?code=${room}`);
  await page.getByPlaceholder("닉네임을 입력하세요").fill("입장1");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page).toHaveURL(/\/defense$/, { timeout: 20_000 });
  await expect(page.getByText("내 점수 및 카드")).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});

test("[C1-b] 디펜스 방 세션이 남은 폰으로 마피아 방 코드 입장 → 마피아 화면(막힌 화면 없음)", async ({ browser, request }) => {
  test.setTimeout(90_000);
  const def = await newRoom(request, "defense", ["교차1"]);
  const maf = await newRoom(request, "mafia", []);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const visited: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname);
  });
  // 1) 디펜스 방에 들어가 있는 폰
  await page.goto("/");
  await page.getByPlaceholder("방 코드 (예: A3F82)").fill(def.room);
  await page.getByPlaceholder("닉네임을 입력하세요").fill("교차1");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page).toHaveURL(/\/defense$/, { timeout: 20_000 });
  await expect(page.getByText("내 점수 및 카드")).toBeVisible({ timeout: 30_000 });
  // 2) 같은 브라우저로 마피아 방 코드 입장(셀프 입장 — 준비 단계라 새 닉네임도 등록)
  await page.goto("/");
  await page.getByPlaceholder("방 코드 (예: A3F82)").fill(maf.room);
  await page.getByPlaceholder("닉네임을 입력하세요").fill("교차2");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page).toHaveURL(/\/mafia$/, { timeout: 20_000 });
  await expect(page.getByTestId("tab-info")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/\/mafia$/);
  expect(visited, `이동 경로 ${visited.join(" → ")}`).not.toContain("/locked");
  await expect(page.getByText("정상적이지 않은 접근")).toHaveCount(0);
  await ctx.close();
});
