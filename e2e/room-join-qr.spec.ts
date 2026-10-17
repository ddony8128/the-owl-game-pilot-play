import { test, expect } from "@playwright/test";

// 2026-10-17 또니 요청 — 수산시장처럼 GM 대시보드에 「📲 참가 QR」 버튼. 새 창(/join?code=)에
// 큰 QR + 방 코드가 뜨고, QR 주소(/?code=)로 들어오면 입장 화면의 방 코드가 미리 채워진다.
test("참가 QR — 대시보드 버튼 · /join 화면 · 입장 화면 코드 자동 채움", async ({ page, request }) => {
  const created = await request.post("/api/gm/rooms", { data: { game: "defense" } });
  expect(created.ok()).toBeTruthy();
  const code: string = (await created.json()).room.code;

  // 게임 대시보드에 버튼이 있고 새 창을 연다
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  const btn = page.getByTestId("join-qr-open");
  await expect(btn).toBeVisible();
  const [popup] = await Promise.all([page.waitForEvent("popup"), btn.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toContain(`/join?code=${code}`);
  await expect(popup.getByTestId("join-screen-code")).toHaveText(code);
  const img = popup.getByRole("img", { name: "참가 QR 코드" });
  await expect(img).toBeVisible();
  expect(await img.getAttribute("src")).toMatch(/^data:image\/png/);
  await popup.screenshot({ path: "C:/not_system/project/ai-runner/missions/owl-main/shots/iter4-join-qr.png", fullPage: true });
  await page.screenshot({ path: "C:/not_system/project/ai-runner/missions/owl-main/shots/iter4-dashboard-qr-button.png" });
  await popup.close();

  // QR이 담는 주소로 들어오면 방 코드가 채워져 있다
  await page.goto(`/?code=${code}`);
  await expect(page.getByPlaceholder(/방 코드|코드/).first()).toHaveValue(code);

  await request.patch("/api/gm/rooms", { data: { code, status: "ended", ended_normally: true } });
});
