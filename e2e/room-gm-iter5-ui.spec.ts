import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Iteration 5 WS-A — GM 대시보드 브라우저 E2E: 확인창(미제출 N명·Esc·400ms 잠금) · 409 배너(뒤처진 탭) ·
// 재연결 배지(폴링 차단) · 되돌리기 · 결과 공개 토글 · 현금 보정 · 타이머 조정 · 인원 차단 · 강퇴/방 종료 확인창.
// 폴링 간격은 window.__OWL_POLL__ 로 1초로 당긴다.

const SHOT = "C:/not_system/project/ai-runner/missions/owl-main/shots";
const created: string[] = [];

async function newRoom(request: APIRequestContext, game: "mafia" | "defense", names: string[]) {
  const code = (await (await request.post("/api/gm/rooms", { data: { game } })).json()).room.code as string;
  created.push(code);
  const ids: Record<string, string> = {};
  for (const nickname of names) {
    const r = await request.post("/api/gm/players", { data: { room: code, nickname } });
    expect(r.ok()).toBeTruthy();
    ids[nickname] = (await r.json()).player.id;
  }
  return { code, ids };
}

test.afterAll(async ({ request }) => {
  for (const code of created) {
    await request.patch("/api/gm/rooms", { data: { code, status: "ended", ended_normally: true } });
  }
});

async function fastPoll(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __OWL_POLL__?: number }).__OWL_POLL__ = 1000;
  });
}

const defAdv = (request: APIRequestContext, room: string, round: number) =>
  request.post("/api/gm/defense/round", { data: { room, round, from: round - 1 } });
const mafAdv = (request: APIRequestContext, room: string, to: string) =>
  request.post("/api/gm/mafia/advance-phase", { data: { room, to } });

test("[2] 디펜스 「다음 라운드」확인창 — 미제출 N명(이름)·Esc 닫기·400ms 잠금·확인 뒤 라운드 진행", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { code } = await newRoom(request, "defense", ["가람", "나래", "다온"]);
  await defAdv(request, code, 1);
  // 가람만 제출
  const st = await (await request.get(`/api/defense/state?${new URLSearchParams({ room: code, nickname: "가람" })}`)).json();
  await request.post("/api/defense/action", {
    data: { room: code, nickname: "가람", action_type: "combat", target_monster_id: st.monsters[0].instanceId, used_card_slot: 1 },
  });

  await fastPoll(page);
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  const section = page.getByTestId("defense-round-section");
  await expect(section).toContainText("튜토리얼 1라운드");
  await expect(section.getByTestId("pending-count")).toContainText("미제출 2명", { timeout: 10_000 });

  // 열기 → 본문에 미제출 2명(이름) → Esc 로 닫힘, 라운드 그대로
  await section.getByTestId("advance-round").click();
  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("pending-warning")).toContainText("미제출 2명");
  await expect(dialog.getByTestId("pending-warning")).toContainText("나래");
  await expect(dialog.getByTestId("pending-warning")).toContainText("다온");
  await page.screenshot({ path: `${SHOT}/iter5-a-confirm-advance.png` });
  // 400ms 잠금: 열린 직후엔 확인이 비활성
  await expect(dialog.getByTestId("confirm-ok")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(section).toContainText("튜토리얼 1라운드");

  // 다시 열고 확인(Playwright 는 활성화될 때까지 기다린다) → 2라운드
  await section.getByTestId("advance-round").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("gm-notice")).toContainText("튜토리얼 1라운드 결과 보기", { timeout: 10_000 });
  await expect(section.getByTestId("stage-title")).toHaveText("튜토리얼 1라운드 결과", { timeout: 10_000 });
  await expect(section.getByTestId("advance-round")).toContainText("튜토리얼 2라운드 시작");
  const st2 = await (await request.get(`/api/defense/state?room=${code}`)).json();
  expect(st2.round).toBe(2);
  expect(st2.stage).toBe("result");
});

test("[1·7] 뒤처진 탭의 옛 버튼 → 409 배너(사유 구분) · 폴링 차단 시 화면 유지 + 재연결 배지", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { code } = await newRoom(request, "defense", ["s1"]);
  await defAdv(request, code, 1);
  await defAdv(request, code, 2);

  await fastPoll(page);
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  const section = page.getByTestId("defense-round-section");
  await expect(section.getByTestId("stage-title")).toHaveText("튜토리얼 2라운드");
  await expect(page.getByTestId("connection-badge")).toHaveCount(0);

  // 폴링을 끊는다 → 화면은 남고 재연결 배지가 뜬다(1-5)
  await page.route("**/api/gm/defense/dashboard**", (route) => route.abort());
  await expect(page.getByTestId("connection-badge")).toBeVisible({ timeout: 15_000 });
  await expect(section.getByTestId("stage-title")).toHaveText("튜토리얼 2라운드");
  await expect(page.getByText("진행", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/iter5-a-connection-badge.png` });

  // 그 사이 다른 창이 되돌렸다(2 → 1). 뒤처진 화면은 2를 보고 3으로 가려 한다 → 409 stale_from
  const rw = await request.post("/api/gm/defense/rewind", { data: { room: code, from: 2 } });
  expect(rw.ok(), await rw.text()).toBeTruthy();
  await section.getByTestId("advance-round").click();
  await page.getByTestId("confirm-ok").click();
  const banner = page.getByTestId("gm-error");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(banner).toContainText("이미 넘어갔습니다");
  await expect(banner).toContainText("다른 창");
  await page.screenshot({ path: `${SHOT}/iter5-a-409-banner.png` });
  // 서버는 1라운드 그대로(건너뛰지 않았다)
  expect((await (await request.get(`/api/defense/state?room=${code}`)).json()).round).toBe(1);

  // 폴링을 복구하면 배지가 사라지고 화면이 서버와 맞는다
  await page.unroute("**/api/gm/defense/dashboard**");
  await expect(page.getByTestId("connection-badge")).toHaveCount(0, { timeout: 15_000 });
  await expect(section.getByTestId("stage-title")).toHaveText("튜토리얼 1라운드", { timeout: 10_000 });
  await banner.getByRole("button", { name: "닫기" }).click();
  await expect(banner).toHaveCount(0);
});

test("[3] 디펜스 되돌리기 버튼 — 확인창 → 준비로 복원 · 제출이 있으면 409 배너", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { code } = await newRoom(request, "defense", ["r1"]);
  await defAdv(request, code, 1);
  await fastPoll(page);
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  const section = page.getByTestId("defense-round-section");
  await expect(section).toContainText("튜토리얼 1라운드");
  await section.getByTestId("rewind-round").click();
  await expect(page.getByTestId("confirm-dialog")).toContainText("되돌리기: 튜토리얼 1라운드 → 준비");
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("gm-notice")).toContainText("준비로 되돌렸습니다", { timeout: 10_000 });
  await expect(section.getByTestId("stage-title")).toHaveText("준비", { timeout: 10_000 });
  await expect(section.getByTestId("rewind-round")).toBeDisabled();
  await expect(page.getByTestId("gm-log-section")).toContainText("되돌리기", { timeout: 10_000 });

  // 다시 1라운드로 가서 제출을 넣으면 되돌리기는 409
  await section.getByTestId("advance-round").click();
  await expect(page.getByTestId("confirm-dialog").getByTestId("headcount-warning")).toContainText("1명");
  await page.getByTestId("confirm-ok").click();
  await expect(section.getByTestId("stage-title")).toHaveText("튜토리얼 1라운드", { timeout: 10_000 });
  const st = await (await request.get(`/api/defense/state?${new URLSearchParams({ room: code, nickname: "r1" })}`)).json();
  await request.post("/api/defense/action", {
    data: { room: code, nickname: "r1", action_type: "combat", target_monster_id: st.monsters[0].instanceId, used_card_slot: 1 },
  });
  await section.getByTestId("rewind-round").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("gm-error")).toContainText("되돌릴 수 없습니다", { timeout: 10_000 });
  expect((await (await request.get(`/api/defense/state?room=${code}`)).json()).round).toBe(1);
});

test("[6] 타이머 조정 UI — 프리셋 3분·+30초·다음 라운드부터 예약 표시", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { code } = await newRoom(request, "defense", ["t1"]);
  await fastPoll(page);
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  const panel = page.getByTestId("defense-countdown").getByTestId("timer-adjust");
  await expect(panel.getByTestId("timer-total")).toHaveText("05:00", { timeout: 10_000 });
  await panel.getByTestId("timer-preset-3").click();
  await expect(panel.getByTestId("timer-total")).toHaveText("03:00", { timeout: 10_000 });
  await panel.getByTestId("timer-plus-30").click();
  await expect(panel.getByTestId("timer-total")).toHaveText("03:30", { timeout: 10_000 });
  await panel.getByText("다음 라운드부터").click();
  await panel.getByTestId("timer-preset-10").click();
  await expect(panel.getByTestId("timer-pending")).toContainText("10:00", { timeout: 10_000 });
  await expect(panel.getByTestId("timer-total")).toHaveText("03:30");
  // 분 입력 1~30 밖은 화면에서 막는다
  await panel.getByText("현재 라운드 즉시 적용").click();
  await panel.getByTestId("timer-minutes-input").fill("45");
  await panel.getByTestId("timer-minutes-apply").click();
  await expect(panel).toContainText("1~30 사이의 정수");
  await panel.getByTestId("timer-minutes-input").fill("7");
  await panel.getByTestId("timer-minutes-apply").click();
  await expect(panel.getByTestId("timer-total")).toHaveText("07:00", { timeout: 10_000 });
  await page.screenshot({ path: `${SHOT}/iter5-a-timer-adjust.png` });
  const g = await (await request.get(`/api/gm/timers/defense?room=${code}`)).json();
  expect(g.totalSeconds).toBe(420);
  expect(g.pendingTotalSeconds).toBe(600);
});

test("[4·5] 마피아 대시보드 — 결과 공개 토글·현금 ±1·페이즈 확인창(미제출)·인원 4명 차단 표시", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { code } = await newRoom(request, "mafia", ["m1", "m2", "m3", "m4"]);
  await mafAdv(request, code, "auction");
  await request.post("/api/mafia/action", { data: { room: code, nickname: "m1", type: "bet", payload: { job: "ceo", amount: 2 } } });

  await fastPoll(page);
  await page.goto(`/dashboard/x9a2k7/mafia?room=${code}`);
  const phaseSection = page.getByTestId("mafia-phase-section");
  await expect(phaseSection).toContainText("직업 경매");
  await expect(phaseSection.getByTestId("pending-count")).toContainText("미제출 3명", { timeout: 10_000 });

  // 결과 공개 토글
  await expect(page.getByTestId("reveal-state")).toHaveText("비공개");
  await page.getByTestId("reveal-toggle").click();
  await expect(page.getByTestId("confirm-dialog")).toContainText("결과를 공개할까요?");
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("reveal-state")).toHaveText("공개 ON", { timeout: 10_000 });
  expect((await (await request.get(`/api/gm/rooms?code=${code}`)).json()).room.reveal_result).toBe(true);
  await page.getByTestId("reveal-toggle").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("reveal-state")).toHaveText("비공개", { timeout: 10_000 });

  // 현금 +1 → 31원
  const card = page.getByTestId("asset-card-m1");
  await expect(card.getByTestId("asset-cash")).toHaveText("30원", { timeout: 10_000 });
  await card.getByRole("button", { name: "m1 현금 +1" }).click();
  await expect(card.getByTestId("asset-cash")).toHaveText("31원", { timeout: 10_000 });
  await card.getByRole("combobox", { name: "m1 보정 종목" }).selectOption("부엉교육");
  await card.getByRole("button", { name: "m1 부엉교육 +1주" }).click();
  await expect(card.getByTestId("asset-stock-부엉교육")).toHaveText("1", { timeout: 10_000 });
  await page.screenshot({ path: `${SHOT}/iter5-a-mafia-adjust.png`, fullPage: true });

  // 경매 마감 확인창: 미제출 3명 → 전환
  await phaseSection.getByTestId("advance-phase").click();
  const dialog = page.getByTestId("confirm-dialog");
  await expect(dialog).toContainText("경매 마감 → 주식 거래");
  await expect(dialog.getByTestId("pending-warning")).toContainText("미제출 3명");
  await page.getByTestId("confirm-ok").click();
  await expect(phaseSection).toContainText("페이즈: 주식 거래", { timeout: 10_000 });

  // end 까지 API 로 → 라운드 선택에서 4명이라 1라운드 차단 표시
  for (const to of ["apply", "vote", "end"]) expect((await mafAdv(request, code, to)).ok()).toBeTruthy();
  await expect(phaseSection).toContainText("페이즈: 라운드 종료", { timeout: 10_000 });
  await expect(phaseSection.getByTestId("headcount-block")).toContainText("5명 이상");
  await expect(phaseSection.getByTestId("round-select-1")).toBeDisabled();
  await page.screenshot({ path: `${SHOT}/iter5-a-mafia-headcount-block.png` });
  // 5명째 등록 → 차단 해제, 확인창에 권장 미만 경고 → 1라운드 시작
  await request.post("/api/gm/players", { data: { room: code, nickname: "m5" } });
  await expect(phaseSection.getByTestId("round-select-1")).toBeEnabled({ timeout: 10_000 });
  await phaseSection.getByTestId("round-select-1").click();
  await expect(page.getByTestId("confirm-dialog").getByTestId("headcount-warning")).toContainText("권장 인원");
  await page.getByTestId("confirm-ok").click();
  await expect(phaseSection).toContainText("현재 라운드: 1라운드", { timeout: 10_000 });
});

test("[3] 마피아 되돌리기 버튼 — 경매 마감 취소(trade→auction) · apply 에서는 비활성", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { code } = await newRoom(request, "mafia", ["w1", "w2", "w3", "w4", "w5"]);
  await mafAdv(request, code, "auction");
  await mafAdv(request, code, "trade");
  await fastPoll(page);
  await page.goto(`/dashboard/x9a2k7/mafia?room=${code}`);
  const phaseSection = page.getByTestId("mafia-phase-section");
  await expect(phaseSection).toContainText("페이즈: 주식 거래");
  await phaseSection.getByTestId("rewind-phase").click();
  await expect(page.getByTestId("confirm-dialog")).toContainText("되돌리기: 주식 거래 → 직업 경매");
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("gm-notice")).toContainText("직업 경매 단계로 되돌렸습니다", { timeout: 10_000 });
  await expect(phaseSection).toContainText("페이즈: 직업 경매", { timeout: 10_000 });
  await mafAdv(request, code, "trade");
  await mafAdv(request, code, "apply");
  await expect(phaseSection).toContainText("페이즈: 주가 변동", { timeout: 10_000 });
  await expect(phaseSection.getByTestId("rewind-phase")).toBeDisabled();
});

test("[2] 방 관리 — 방 종료·강퇴 확인창(취소하면 그대로, 확인하면 실행) · 종료 방 등록 409 배너", async ({ page, request }) => {
  test.setTimeout(90_000);
  const { code } = await newRoom(request, "defense", ["k1", "k2"]);
  await page.addInitScript(
    ({ c }) => localStorage.setItem("owlgm:room", JSON.stringify({ code: c, game: "defense" })),
    { c: code },
  );
  await page.goto("/dashboard/x9a2k7");
  const roster = page.getByTestId("roster");
  await expect(roster).toContainText("총 2명");

  // 강퇴: 취소 → 유지, 확인 → 삭제
  await roster.getByRole("button", { name: "k1 삭제" }).click();
  await expect(page.getByTestId("confirm-dialog")).toContainText("k1 삭제(강퇴)");
  await page.getByTestId("confirm-cancel").click();
  await expect(roster).toContainText("총 2명");
  await roster.getByRole("button", { name: "k1 삭제" }).click();
  await page.getByTestId("confirm-ok").click();
  await expect(roster).toContainText("총 1명", { timeout: 10_000 });
  await expect(roster).not.toContainText("k1 ");

  // 방 종료: 취소 → 패널 유지, 확인 → 떠남 + 서버 ended
  await page.getByTestId("end-room").click();
  await expect(page.getByTestId("confirm-dialog")).toContainText(`방 ${code} 종료`);
  await page.getByTestId("confirm-cancel").click();
  await expect(page.getByTestId("end-room")).toBeVisible();
  await page.getByTestId("end-room").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByRole("button", { name: "+ 디펜스 방" })).toBeVisible({ timeout: 10_000 });
  expect((await (await request.get(`/api/gm/rooms?code=${code}`)).json()).room.status).toBe("ended");

  // 종료 방에 다시 들어가면 등록 입력이 막혀 있고, API 로 등록하면 409
  await page.getByPlaceholder("방 코드 입력").fill(code);
  await page.getByRole("button", { name: "입장", exact: true }).click();
  await expect(page.getByTestId("room-ended-badge")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder("참가자 닉네임")).toBeDisabled();
  const late = await request.post("/api/gm/players", { data: { room: code, nickname: "late" } });
  expect(late.status()).toBe(409);
});
