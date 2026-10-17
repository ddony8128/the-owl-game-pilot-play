import { test, expect } from "@playwright/test";
import { addPlayers, createRoom, endRoom, primePhone } from "./helpers/phone";

// Iteration 5 WS-B 3 — 룰지 링크: /rules 는 rules_state 와 무관하게 두 룰지를 항상 보여 주고,
// 폰 규칙 탭 하단의 「룰지 PDF 열기」가 정본 PDF 를 새 탭으로 연다.
const DEFENSE_PDF = "/rulebook/rulesheet-2026-10-16_defense.pdf";
const MAFIA_PDF = "/rulebook/rulesheet-2026-10-14_mafia.pdf";
const rooms: string[] = [];

test.afterAll(async ({ request }) => {
  for (const r of rooms) await endRoom(request, r);
});

test("룰지 PDF 두 개가 실제로 서빙된다", async ({ request }) => {
  for (const p of [DEFENSE_PDF, MAFIA_PDF]) {
    const r = await request.get(p);
    expect(r.status(), p).toBe(200);
    expect(r.headers()["content-type"] ?? "", p).toContain("pdf");
  }
});

test("/rules 는 공개 토글 없이 두 룰지 링크를 항상 보여 준다(새 탭)", async ({ page }) => {
  await page.goto("/rules");
  const d = page.getByTestId("rules-defense");
  const m = page.getByTestId("rules-mafia");
  await expect(d).toBeVisible();
  await expect(m).toBeVisible();
  await expect(d).toHaveAttribute("href", DEFENSE_PDF);
  await expect(m).toHaveAttribute("href", MAFIA_PDF);
  await expect(d).toHaveAttribute("target", "_blank");
  await expect(m).toHaveAttribute("target", "_blank");
  await expect(page.getByText("아직 공개된 규칙이 없습니다.")).toHaveCount(0);
});

test("디펜스 규칙 탭: 변경 가능 문구 + 룰지 링크", async ({ page, request }) => {
  const room = await createRoom(request, "defense");
  rooms.push(room);
  await addPlayers(request, room, ["r1"]);
  await primePhone(page, room, "r1", "defense");
  await page.goto("/defense");
  await page.getByTestId("tab-rules").click();
  await expect(page.getByTestId("rules-change-note")).toContainText("다시 고르기");
  const link = page.getByTestId("rulesheet-link");
  await expect(link).toHaveAttribute("href", DEFENSE_PDF);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  // (헤드리스 크로미엄은 PDF 를 새 탭에 렌더하지 않아 팝업 URL 을 볼 수 없다 — PDF 서빙은 위 테스트에서 200 으로 확인)
});

test("마피아 규칙 탭: 룰지 링크 + 로그 탭 안내", async ({ page, request }) => {
  const room = await createRoom(request, "mafia");
  rooms.push(room);
  await addPlayers(request, room, ["r1"]);
  await primePhone(page, room, "r1", "mafia");
  await page.goto("/mafia");
  await page.getByTestId("tab-rules").click();
  const link = page.getByTestId("rulesheet-link");
  await expect(link).toHaveAttribute("href", MAFIA_PDF);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText("내 기록")).toBeVisible();
});
