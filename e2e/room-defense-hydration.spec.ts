import { test, expect, type APIRequestContext } from "@playwright/test";

// 하이드레이션 회귀 가드: 보드/대시보드/플레이어 화면에서 SSR↔CSR 불일치가 없어야 한다.
async function room(request: APIRequestContext): Promise<string> {
  const r = (
    await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()
  ).room.code;
  await request.post("/api/gm/players", { data: { room: r, nickname: "u1" } });
  await request.post("/api/gm/defense/round", { data: { room: r, round: 1 } });
  return r;
}

test("[하이드레이션] 보드·대시보드·플레이어 화면에 하이드레이션 불일치 없음", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const hydrationErrors: string[] = [];
  page.on("pageerror", (e) => {
    if (/Hydration|did.?n.?t match|hydrat/i.test(e.message))
      hydrationErrors.push(e.message);
  });

  const code = await room(request);

  // 결과중계 보드
  await page.goto(`/defense-board?room=${code}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // GM 대시보드
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // 플레이어 화면
  await page.addInitScript(
    ({ r }) => {
      localStorage.setItem("owlgame:room", r as string);
      localStorage.setItem("owlgame:nickname", "u1");
      localStorage.setItem("owlgame:roomGame", "defense");
    },
    { r: code },
  );
  await page.goto(`/defense`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  expect(
    hydrationErrors,
    `하이드레이션 에러:\n${hydrationErrors.join("\n")}`,
  ).toHaveLength(0);
});
