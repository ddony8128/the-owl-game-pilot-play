import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// 2026-10-03 GM 운영 스모크에서 나온 5건 회귀 가드.
//  1 탭 직후 제출 무시 · 2 자동 세팅 경쟁 · 3 요약 자동 갱신 · 5 하이드레이션/자산 안내/종료 배지
// 테스트가 만든 방은 끝에 [방 종료] 처리한다.

const created: string[] = [];

async function newRoom(
  request: APIRequestContext,
  game: "mafia" | "defense",
  names: string[],
): Promise<string> {
  const code = (await (await request.post("/api/gm/rooms", { data: { game } })).json()).room
    .code as string;
  created.push(code);
  for (const nickname of names) {
    const r = await request.post("/api/gm/players", { data: { room: code, nickname } });
    expect(r.ok()).toBeTruthy();
  }
  return code;
}

async function endRoom(request: APIRequestContext, code: string) {
  await request.patch("/api/gm/rooms", {
    data: { code, status: "ended", ended_normally: true },
  });
}

test.afterAll(async ({ request }) => {
  for (const code of created) await endRoom(request, code);
});

async function loginAs(page: Page, room: string, nickname: string, game: string) {
  await page.addInitScript(
    ({ r, n, g }) => {
      localStorage.setItem("owlgame:room", r);
      localStorage.setItem("owlgame:nickname", n);
      localStorage.setItem("owlgame:roomGame", g);
    },
    { r: room, n: nickname, g: game },
  );
}

const mafiaAdv = (request: APIRequestContext, room: string, to: string) =>
  request.post("/api/gm/mafia/advance-phase", { data: { room, to } });

async function mafiaMe(request: APIRequestContext, room: string, nickname: string) {
  const params = new URLSearchParams({ room, nickname });
  return (await request.get(`/api/mafia/state?${params.toString()}`)).json();
}

test("[1] 마피아 탭을 연 직후(100ms) 제출해도 조용히 버려지지 않는다 — 경매·거래·투표", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const room = await newRoom(request, "mafia", ["철수", "영희"]);
  await mafiaAdv(request, room, "auction");
  await loginAs(page, room, "철수", "mafia");
  await page.setViewportSize({ width: 430, height: 880 });
  await page.goto("/mafia");

  // 경매: 탭이 나타나면 열고 100ms 뒤 바로 제출
  const auctionTab = page.getByRole("button", { name: "경매", exact: true });
  await auctionTab.waitFor({ timeout: 20_000 });
  await auctionTab.click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "CEO" }).click();
  await page.getByPlaceholder("베팅 금액").fill("2");
  await page.getByRole("button", { name: "베팅 제출" }).click();
  await expect(page.getByText("CEO 직업에 2원을 베팅했습니다.")).toBeVisible({
    timeout: 10_000,
  });
  expect((await mafiaMe(request, room, "철수")).myAuctionBet?.job).toBe("ceo");

  // 거래: 단계 전환 → 폴링으로 탭이 나타나면 열고 100ms 뒤 바로 제출
  await mafiaAdv(request, room, "trade");
  const tradeTab = page.getByRole("button", { name: "거래", exact: true });
  await tradeTab.waitFor({ timeout: 20_000 });
  await tradeTab.click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "매수", exact: true }).first().click();
  await page.getByPlaceholder("수량").fill("1");
  await page.getByRole("button", { name: "거래 제출" }).click();
  await expect(page.getByText(/1개 매수했습니다/)).toBeVisible({ timeout: 10_000 });
  const trades = (await mafiaMe(request, room, "철수")).myTradesThisRound ?? {};
  expect(Object.values(trades).some((t) => (t as { bought: boolean }).bought)).toBeTruthy();

  // 투표
  await mafiaAdv(request, room, "apply");
  await mafiaAdv(request, room, "vote");
  const voteTab = page.getByRole("button", { name: "투표", exact: true });
  await voteTab.waitFor({ timeout: 20_000 });
  await voteTab.click();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "영희", exact: true }).click();
  await page.getByRole("button", { name: "투표 제출" }).click();
  await expect(page.getByText(/영희에게 1표/)).toBeVisible({ timeout: 10_000 });
});

test("[2] 디펜스 대시보드 로드 직후 [인원 기준 자동 세팅] → 7명 합계 21", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const room = await newRoom(
    request,
    "defense",
    ["d1", "d2", "d3", "d4", "d5", "d6", "d7"],
  );
  await page.goto(`/dashboard/x9a2k7/defense?room=${room}`);
  await page.getByRole("button", { name: "인원 기준 자동 세팅" }).click();
  // 초기 로드가 끝난 뒤에도 기본값(24)으로 되돌아가지 않아야 한다.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await expect(page.getByText("합계:")).toContainText("21");
  await expect(page.getByText("7명 기준 권장 조합을 불러왔습니다")).toBeVisible();
});

test("[3] 디펜스 라운드별 상황 요약이 진행 중 제출을 자동으로 반영한다", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const room = await newRoom(request, "defense", ["s1"]);
  await request.post("/api/gm/defense/round", { data: { room, round: 1 } });
  await page.goto(`/dashboard/x9a2k7/defense?room=${room}`);
  await expect(page.getByText("이 라운드에는 행동 기록이 없습니다.")).toBeVisible({
    timeout: 20_000,
  });

  const st = await (
    await request.get(`/api/defense/state?${new URLSearchParams({ room, nickname: "s1" })}`)
  ).json();
  const target = st.monsters[0];
  const r = await request.post("/api/defense/action", {
    data: {
      room,
      nickname: "s1",
      action_type: "combat",
      target_monster_id: target.instanceId,
      used_card_slot: 1,
    },
  });
  expect(r.ok()).toBeTruthy();

  // [↻ 새로고침]·라운드 변경 없이 폴링으로 반영
  await expect(page.getByText("이 라운드에는 행동 기록이 없습니다.")).toHaveCount(0, {
    timeout: 12_000,
  });
});

test("[3] 마피아 라운드별 상황 요약도 주기적으로 다시 불러온다", async ({ page, request }) => {
  test.setTimeout(60_000);
  const room = await newRoom(request, "mafia", ["m1", "m2"]);
  let hits = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/gm/mafia/round-state")) hits += 1;
  });
  await page.goto(`/dashboard/x9a2k7/mafia?room=${room}`);
  await expect(page.getByText("라운드별 상황 요약")).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(9_000);
  expect(hits).toBeGreaterThanOrEqual(3);
});

test("[5a·5b] 마피아 대시보드·결과 페이지 하이드레이션 경고 0 + 자산 현황 안내", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const room = await newRoom(request, "mafia", ["h1", "h2", "h3"]);
  const problems: string[] = [];
  page.on("pageerror", (e) => {
    if (/Hydration|did.?n.?t match|hydrat|#418/i.test(e.message)) problems.push(e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && /Hydration|#418|did.?n.?t match/i.test(m.text()))
      problems.push(m.text());
  });

  await page.goto(`/dashboard/x9a2k7/mafia?room=${room}`);
  await expect(page.getByText("자산은 직업 경매가 시작될 때 생성됩니다.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/등록 인원 3명/)).toBeVisible();
  await expect(page.getByText("플레이어 데이터가 없습니다.")).toHaveCount(0);
  await page.waitForTimeout(500);

  await page.goto(`/mafia-board?room=${room}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  expect(problems, `하이드레이션 경고:\n${problems.join("\n")}`).toHaveLength(0);
});

test("[5c] 종료된 방을 코드로 다시 열면 '종료됨' 배지 + 읽기 전용 안내", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const room = await newRoom(request, "defense", ["e1"]);
  await endRoom(request, room);

  await page.goto("/dashboard/x9a2k7");
  await page.evaluate(() => localStorage.removeItem("owlgm:room"));
  await page.reload();
  await page.getByPlaceholder("방 코드 입력").fill(room);
  await page.getByRole("button", { name: "입장", exact: true }).click();
  await expect(page.getByTestId("room-ended-badge")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /대시보드 보기\(읽기 전용\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "방 종료" })).toHaveCount(0);

  await page.getByRole("link", { name: /대시보드 보기/ }).click();
  await expect(page.getByTestId("room-ended-notice")).toBeVisible({ timeout: 20_000 });

  // 진행 중인 방에는 배지가 없다
  const live = await newRoom(request, "mafia", ["l1"]);
  await page.goto(`/dashboard/x9a2k7/mafia?room=${live}`);
  await expect(page.getByText("라운드 / 페이즈")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("room-ended-notice")).toHaveCount(0);
});
