import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  addPlayers,
  createRoom,
  defenseAdvance,
  defenseConfigOnly,
  endRoom,
  mafiaAdvance,
  primePhone,
} from "./helpers/phone";

// Iteration 5 WS-B 1·6 — 접속 끊김·강퇴·종료된 방을 **브라우저 레벨**로 확인한다(API 테스트로는 UI 경합을 못 잡는다 — 반면교사 1-5·1-6).
//  - 폴링이 실패해도 마지막 화면이 남고 "다시 연결하는 중…" 배지가 뜬다, 복구되면 배지가 사라진다
//  - GM이 명단에서 지우면(403) 폰이 조용히 굳지 않고 즉시 안내한다; 같은 닉네임을 다시 등록하면 재입장된다
//  - 종료된 방이면 "종료된 방" 배너 + 행동 탭이 닫힌다
test.use({ viewport: { width: 390, height: 844 } });

const rooms: string[] = [];
test.afterAll(async ({ request }) => {
  for (const r of rooms) await endRoom(request, r);
});

async function defenseRoom(request: APIRequestContext): Promise<{ room: string; ids: Record<string, string> }> {
  const room = await createRoom(request, "defense");
  rooms.push(room);
  const ids = await addPlayers(request, room, ["u1", "u2"]);
  await defenseConfigOnly(request, room, 2);
  await defenseAdvance(request, room, 1);
  return { room, ids };
}

async function mafiaRoom(request: APIRequestContext): Promise<{ room: string; ids: Record<string, string> }> {
  const room = await createRoom(request, "mafia");
  rooms.push(room);
  const ids = await addPlayers(request, room, ["m1", "m2", "m3"]);
  await mafiaAdvance(request, room, "auction");
  return { room, ids };
}

test("[디펜스] 폴링 실패 → 화면 유지 + 재연결 배지 → 복구되면 배지 소멸", async ({ page, request }) => {
  const { room } = await defenseRoom(request);
  await primePhone(page, room, "u1", "defense");
  await page.goto("/defense");
  await expect(page.getByText("디펜스 딜레마")).toBeVisible();
  await expect(page.getByText("내 점수 및 카드")).toBeVisible();
  await expect(page.getByTestId("connection-badge")).toHaveCount(0);

  // 서버가 끊긴 상황
  await page.route("**/api/defense/state**", (route) => route.abort("connectionfailed"));
  await expect(page.getByTestId("connection-badge")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-badge")).toContainText("다시 연결");
  // 마지막 화면은 그대로(오류 화면으로 바뀌지 않음)
  await expect(page.getByText("내 점수 및 카드")).toBeVisible();
  await expect(page.getByText("디펜스 상태를 불러오지 못했습니다")).toHaveCount(0);

  // 복구
  await page.unroute("**/api/defense/state**");
  await expect(page.getByTestId("connection-badge")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("내 점수 및 카드")).toBeVisible();
});

test("[디펜스] 강퇴(명단 삭제) → 즉시 안내, 재등록 뒤 같은 닉네임으로 재입장", async ({ page, request }) => {
  const { room, ids } = await defenseRoom(request);
  await primePhone(page, room, "u2", "defense");
  await page.goto("/defense");
  await expect(page.getByText("내 점수 및 카드")).toBeVisible();

  const del = await request.delete("/api/gm/players", { data: { id: ids["u2"] } });
  expect(del.ok()).toBeTruthy();
  await expect(page.getByTestId("kicked-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("kicked-screen")).toContainText("참가자 명단에서 제외");

  // GM이 다시 등록 → [입장 화면으로] → 같은 코드·닉네임으로 다시 들어가면 복귀
  await addPlayers(request, room, ["u2"]);
  await page.getByRole("button", { name: "입장 화면으로 돌아가기" }).click();
  await page.waitForURL(/\/$|\/\?/, { timeout: 10_000 });
  await primePhone(page, room, "u2", "defense");
  await page.goto("/defense");
  await expect(page.getByText("내 점수 및 카드")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("kicked-screen")).toHaveCount(0);
});

test("[디펜스] 종료된 방 → 배너 + 행동 불가 안내", async ({ page, request }) => {
  const { room } = await defenseRoom(request);
  await primePhone(page, room, "u1", "defense");
  await page.goto("/defense");
  await expect(page.getByText("내 점수 및 카드")).toBeVisible();
  await endRoom(request, room);
  await expect(page.getByTestId("room-ended-banner")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("tab-action").click();
  await expect(page.getByText("종료된 방입니다. 행동을 제출할 수 없습니다.")).toBeVisible();
  // 로그·규칙은 그대로 열린다
  await page.getByTestId("tab-logs").click();
  await expect(page.getByText(/로그|기록/).first()).toBeVisible();
});

test("[마피아] 폴링 실패 → 화면 유지 + 배지, 복구 → 소멸", async ({ page, request }) => {
  const { room } = await mafiaRoom(request);
  await primePhone(page, room, "m1", "mafia");
  await page.goto("/mafia");
  await expect(page.getByText("자본주의 마피아")).toBeVisible();
  await expect(page.getByText("보유 현금")).toBeVisible();
  await page.route("**/api/mafia/state**", (route) => route.abort("connectionfailed"));
  await expect(page.getByTestId("connection-badge")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("보유 현금")).toBeVisible();
  await page.unroute("**/api/mafia/state**");
  await expect(page.getByTestId("connection-badge")).toHaveCount(0, { timeout: 15_000 });
});

test("[마피아] 강퇴 → 즉시 안내 · 종료된 방 → 배너 + 경매 탭 닫힘", async ({ page, request }) => {
  const { room, ids } = await mafiaRoom(request);
  await primePhone(page, room, "m3", "mafia");
  await page.goto("/mafia");
  await expect(page.getByText("보유 현금")).toBeVisible();
  const del = await request.delete("/api/gm/players", { data: { id: ids["m3"] } });
  expect(del.ok()).toBeTruthy();
  await expect(page.getByTestId("kicked-screen")).toBeVisible({ timeout: 15_000 });

  // 다른 참가자의 폰: 방 종료 → 배너, 경매 탭은 "종료된 방" 안내
  const page2 = await page.context().newPage();
  await primePhone(page2, room, "m1", "mafia");
  await page2.goto("/mafia");
  await expect(page2.getByText("보유 현금")).toBeVisible();
  await endRoom(request, room);
  await expect(page2.getByTestId("room-ended-banner")).toBeVisible({ timeout: 15_000 });
  await page2.getByTestId("tab-auction").click();
  await expect(page2.getByText("종료된 방입니다. 베팅할 수 없습니다.")).toBeVisible();
  // 로그 탭은 종료 후에도 열린다
  await page2.getByTestId("tab-log").click();
  await expect(page2.getByTestId("mafia-log-empty").or(page2.getByTestId("mafia-log"))).toBeVisible();
});
