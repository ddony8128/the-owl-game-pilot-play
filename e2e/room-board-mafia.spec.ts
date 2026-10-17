import { test, expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  PRIVATE_KEY_RE,
  SHOTS,
  VIEWPORTS,
  assertFits,
  endRoom,
  forEachViewport,
  intervalsOf,
  launchBoardBrowser,
  mafiaAdvance,
  mafiaNextRound,
  names,
  newRoom,
  openBoard,
  post,
  recordAttrTimeline,
} from "./board-helpers";

// Iteration 5 WS-C — 마피아 보드(빔): 로비 QR·카운트다운·공개 전 비공개 정보 0(전 페이즈 스윕)·주가 변동 종목별 순차 공개·
// 종료 후 "공개 토글" 전/후(rooms.reveal_result)·포디움 꼴찌부터·마피아 공개 연출·3해상도 넘침 0.

const PHASES = ["auction", "trade", "apply", "vote", "end"] as const;

/** 서비스 키로 rooms.reveal_result 를 바꾼다(GM PATCH 는 WS-A 담당 — 여기서는 DB 직접). 값은 출력하지 않는다. */
function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY 를 셸에 export 하세요.");
  return createClient(url, key, { auth: { persistSession: false } });
}
async function setReveal(room: string, value: boolean) {
  const { error } = await serviceClient().from("rooms").update({ reveal_result: value }).eq("code", room);
  if (error) throw new Error(error.message);
}

const summaryOf = async (req: APIRequestContext, room: string) => {
  const res = await req.get(`/api/mafia/board-summary?room=${room}`);
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  return { text, json: JSON.parse(text) };
};
const bet = (req: APIRequestContext, room: string, nickname: string, job: string, amount: number) =>
  post(req, "/api/mafia/action", { room, nickname, type: "bet", payload: { job, amount } });
const buy = (req: APIRequestContext, room: string, nickname: string, stock_key: string, amount: number) =>
  post(req, "/api/mafia/action", { room, nickname, type: "buy", payload: { stock_key, amount } });

/** 현재 라운드를 prepare → end 까지 돌리고(onPhase 훅으로 중간 제출), 마지막 라운드가 아니면 다음 라운드 prepare 로 */
async function runRound(
  req: APIRequestContext,
  room: string,
  round: number,
  onPhase: (phase: (typeof PHASES)[number]) => Promise<void> = async () => {},
) {
  for (const p of PHASES) {
    await mafiaAdvance(req, room, p);
    await onPhase(p);
  }
  if (round < 5) await mafiaNextRound(req, room, round + 1);
}

test.describe.configure({ mode: "serial" });

test("[마피아보드1] 로비 QR·카운트다운 → 진행 중 시세판, 공개 전 보드 요약에 비공개 정보 0(튜토리얼·1라운드 전 페이즈)", async ({
  request,
}) => {
  test.setTimeout(150_000);
  const nicks = names(6);
  const room = await newRoom(request, "mafia", nicks);
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/mafia-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-view", "lobby", { timeout: 15_000 });
    await expect(page.getByTestId("board-room-code")).toHaveText(room);
    const img = page.getByRole("img", { name: "참가 QR 코드" });
    await expect(img).toBeVisible();
    expect(await img.getAttribute("src")).toMatch(/^data:image\/png/);
    await expect(page.getByTestId("board-player-count")).toContainText("6");
    await expect(page.getByTestId("board-bg")).toHaveAttribute("data-bg", "hall-mafia");
    await expect(page.getByTestId("board-countdown")).toHaveAttribute("data-has-timer", "false", { timeout: 10_000 }); // 준비 단계엔 타이머 없음
    await assertFits(page, "마피아 로비 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-mafia-lobby.png` });

    // 튜토리얼(0) + 1라운드 전 페이즈 스윕: 응답에 직업·현금·마피아·자산 키가 없다
    for (const round of [0, 1]) {
      for (const p of PHASES) {
        await mafiaAdvance(request, room, p);
        if (round === 1 && p === "auction") {
          await bet(request, room, "u2", "robber", 2);
          await bet(request, room, "u3", "police", 1);
        }
        const { text, json } = await summaryOf(request, room);
        expect(text, `round ${round} ${p}: 비공개 키 노출`).not.toMatch(PRIVATE_KEY_RE);
        expect(json).toMatchObject({ round, phase: p, finished: false, revealed: false, rounds: [], final: [] });
        expect(json.prices).toHaveLength(4);
        expect(json.playerCount).toBe(6);
      }
      if (round === 0) await mafiaNextRound(request, room, 1);
    }

    // 보드는 진행 중 화면(시세판) — 1라운드 종료
    await expect(root).toHaveAttribute("data-view", "live", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-round", "1");
    await expect(root).toHaveAttribute("data-phase", "end");
    await expect(page.getByTestId("board-stock-card")).toHaveCount(4);
    await expect(page.getByTestId("board-title")).toContainText("1라운드 · 라운드 종료");
    await expect(page.getByTestId("board-mafia-badge")).toHaveCount(0);
    await expect(page.getByTestId("board-podium")).toHaveCount(0);

    // 2라운드 경매로 → 카운트다운 03:00(경매 시간)
    await mafiaNextRound(request, room, 2);
    await mafiaAdvance(request, room, "auction");
    const cd = page.getByTestId("board-countdown");
    await expect(cd).toHaveAttribute("data-has-timer", "true", { timeout: 15_000 });
    await expect(cd).toContainText("03:00");
    await expect(cd).toContainText("경매 시간");
    await expect(page.getByTestId("board-title")).toContainText("2라운드 · 직업 경매");
    await post(request, "/api/gm/timers/mafia", { room, action: "start" });
    await expect(cd).toHaveAttribute("data-running", "true", { timeout: 10_000 });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[마피아보드2] 주가 변동 종목별 순차 공개(1.4초) — 감시를 먼저 걸고 trade→apply, 끝나면 시세판에 변동 배지", async ({
  request,
}) => {
  test.setTimeout(150_000);
  const nicks = names(6);
  const room = await newRoom(request, "mafia", nicks);
  await runRound(request, room, 0);
  await mafiaAdvance(request, room, "auction");
  await mafiaAdvance(request, room, "trade");
  // 4명이 부엉교육 2주(최다 매수 +2), 2명이 번쩍전기 1주(2위 +1)
  for (const n of nicks.slice(0, 4)) await buy(request, room, n, "부엉교육", 2);
  for (const n of nicks.slice(4)) await buy(request, room, n, "번쩍전기", 1);

  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/mafia-board?room=${room}`, { holdScale: 0.3 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-view", "live", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-phase", "trade");
    await expect(page.getByTestId("board-price-reveal")).toHaveCount(0);
    // 열자마자는 옛 변동(튜토리얼)을 다시 틀지 않는다
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("board-price-reveal")).toHaveCount(0);

    // ① 감시 먼저 → ② 거래 마감(apply)
    const timeline = recordAttrTimeline(page, '[data-testid="board-price-reveal"]', "data-shown", (v) => v >= 4, 40_000);
    await mafiaAdvance(request, room, "apply");
    const log = await timeline;
    expect(log.map((l) => l.value)).toEqual([0, 1, 2, 3, 4]);
    for (const g of intervalsOf(log, 1)) {
      expect(g, "공개 간격 1.4초").toBeGreaterThan(1000);
      expect(g).toBeLessThan(1900);
    }
    const reveal = page.getByTestId("board-price-reveal");
    await expect(reveal).toContainText("1라운드 주가 변동");
    // 변동이 큰 종목이 뒤에: 마지막 줄이 부엉교육(+2)
    const stocks = await page.getByTestId("board-price-reveal-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-stock")));
    expect(stocks[stocks.length - 1]).toBe("부엉교육");
    expect(stocks[stocks.length - 2]).toBe("번쩍전기");
    await expect(reveal.locator('[data-stock="부엉교육"] [data-delta]')).toHaveAttribute("data-delta", "2");
    await expect(reveal.locator('[data-stock="번쩍전기"] [data-delta]')).toHaveAttribute("data-delta", "1");
    expect(await reveal.textContent(), "공개 화면에 비공개 정보 없음").not.toMatch(/마피아|현금|직업/);
    await assertFits(page, "주가 변동 공개 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-mafia-reveal.png` });

    // 끝나면 시세판으로 돌아가고 변동 배지가 남는다
    await expect(reveal).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-testid="board-stock-card"][data-stock="부엉교육"]')).toHaveAttribute("data-price", "7");
    await expect(page.locator('[data-testid="board-stock-card"][data-stock="부엉교육"] [data-delta]')).toHaveAttribute("data-delta", "2");
    await expect(root).toHaveAttribute("data-phase", "apply");
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[마피아보드3] 5라운드 종료: 공개 토글 전엔 대기 화면 + 비공개 0 → reveal_result=true 면 포디움(꼴찌부터) → 마피아 공개 → 토글 끄면 다시 대기", async ({
  request,
}) => {
  test.setTimeout(240_000);
  const nicks = names(6);
  const room = await newRoom(request, "mafia", nicks);
  await runRound(request, room, 0);
  for (let r = 1; r <= 5; r += 1) {
    await runRound(request, room, r, async (p) => {
      if (p === "auction") {
        // 직업은 라운드마다 다시 경매하므로 매 라운드 u2 가 강도(마피아)를 가져간다
        await bet(request, room, "u2", "robber", 1).catch(() => {});
        if (r === 1) await bet(request, room, "u3", "ceo", 2);
      }
      if (p === "trade") {
        // 현금이 모자라면(강도 피해·주가 상승) 그 라운드는 건너뛴다 — 결과 화면용 자산 차이만 만들면 된다
        await buy(request, room, "u4", "부엉교육", 1).catch(() => {});
        await buy(request, room, "u5", "이상교통", 1).catch(() => {});
      }
    });
  }
  const before = await summaryOf(request, room);
  expect(before.json).toMatchObject({ round: 5, phase: "end", finished: true, revealResult: false, revealed: false });
  expect(before.text, "종료 후·공개 전: 비공개 키 노출").not.toMatch(PRIVATE_KEY_RE);

  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/mafia-board?room=${room}`, { holdScale: 0.3 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-view", "waiting", { timeout: 15_000 });
    await expect(page.getByTestId("board-waiting-reveal")).toContainText("게임이 끝나면 결과가 공개됩니다");
    await expect(page.getByTestId("board-podium")).toHaveCount(0);
    await expect(page.getByText("마피아", { exact: true })).toHaveCount(0);
    await page.waitForTimeout(2500); // 폴링 몇 번 — 저절로 공개되지 않는다
    await expect(root).toHaveAttribute("data-view", "waiting");
    await assertFits(page, "종료 대기 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-mafia-waiting.png` });

    // GM 공개 토글(rooms.reveal_result = true)
    await setReveal(room, true);
    const after = await summaryOf(request, room);
    expect(after.json).toMatchObject({ finished: true, revealResult: true, revealed: true });
    expect(after.json.final).toHaveLength(6);
    expect(after.json.final.map((p: { rank: number }) => p.rank)[0]).toBe(1);
    for (let i = 1; i < after.json.final.length; i += 1)
      expect(after.json.final[i].total_assets).toBeLessThanOrEqual(after.json.final[i - 1].total_assets);
    expect(after.json.final.some((p: { is_mafia: boolean }) => p.is_mafia), "강도에 베팅한 사람이 마피아").toBe(true);
    expect(after.json.rounds.length).toBeGreaterThan(0);

    // 보드: 포디움 꼴찌부터 → 마피아 배지는 순위가 다 나온 뒤에만
    await expect(root).toHaveAttribute("data-view", "result", { timeout: 15_000 });
    const podium = page.getByTestId("board-podium");
    await expect(podium).toBeVisible();
    const firstShown = await page
      .locator('[data-testid="board-ranking-row"][data-shown="true"]')
      .first()
      .getAttribute("data-rank", { timeout: 10_000 });
    const lastRank = Math.max(...after.json.final.map((p: { rank: number }) => p.rank));
    expect(Number(firstShown), "맨 처음 공개는 꼴찌").toBe(lastRank);
    await expect(page.getByTestId("board-mafia-badge")).toHaveCount(0);
    await expect(page.getByTestId("board-mafia-result")).toHaveAttribute("data-mafia-shown", "false");
    await expect(podium).toHaveAttribute("data-done", "true", { timeout: 20_000 });
    await expect(page.getByTestId("board-mafia-result")).toHaveAttribute("data-mafia-shown", "true", { timeout: 10_000 });
    await expect(page.getByTestId("board-mafia-badge").first()).toBeVisible();
    await expect(page.getByTestId("board-mafia-banner")).toContainText("이번 게임의 마피아: u2");
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="1"]').first()).toBeVisible();
    await assertFits(page, "최종 결과 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-mafia-result.png` });

    // 토글을 끄면 API 도 보드도 다시 비공개
    await setReveal(room, false);
    const off = await summaryOf(request, room);
    expect(off.json.revealed).toBe(false);
    expect(off.text).not.toMatch(PRIVATE_KEY_RE);
    await expect(root).toHaveAttribute("data-view", "waiting", { timeout: 15_000 });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[마피아보드4] 넘침 0 — 12명 × 3해상도 × 로비·진행·주가 공개·종료 대기·최종 포디움·라운드별 추이", async ({ request }) => {
  test.setTimeout(420_000);
  const nicks = names(12);
  const room = await newRoom(request, "mafia", nicks);
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/mafia-board?room=${room}`, { holdScale: 3 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-view", "lobby", { timeout: 15_000 });
    await expect(page.getByTestId("board-player-count")).toContainText("12");
    await forEachViewport(page, "12명 로비", { 720: "iter5-c-mafia-lobby-720" });

    await runRound(request, room, 0);
    // 튜토리얼 변동 공개(보드가 열려 있는 동안 생긴 새 묶음)가 끝날 때까지 기다린 뒤 1라운드로
    await expect(page.locator('[data-testid="board-price-reveal"][data-key="0:apply"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("board-price-reveal")).toHaveCount(0, { timeout: 40_000 });
    await mafiaAdvance(request, room, "auction");
    for (const n of nicks.slice(0, 3)) await bet(request, room, n, "robber", 2);
    await mafiaAdvance(request, room, "trade");
    for (const n of nicks.slice(0, 6)) await buy(request, room, n, "이상교통", 2);
    for (const n of nicks.slice(6, 9)) await buy(request, room, n, "국채", 1);
    await expect(root).toHaveAttribute("data-phase", "trade", { timeout: 15_000 });
    await expect(page.getByTestId("board-stock-card")).toHaveCount(4);
    await forEachViewport(page, "12명 진행(거래)", { 720: "iter5-c-mafia-live-720" });

    await mafiaAdvance(request, room, "apply");
    const reveal = page.locator('[data-testid="board-price-reveal"][data-key="1:apply"]');
    await expect(reveal).toHaveAttribute("data-done", "true", { timeout: 20_000 });
    await forEachViewport(page, "12명 주가 공개", { 768: "iter5-c-mafia-reveal-768" });
    await expect(page.getByTestId("board-price-reveal")).toHaveCount(0, { timeout: 40_000 });
    await mafiaAdvance(request, room, "vote");
    await mafiaAdvance(request, room, "end");
    await mafiaNextRound(request, room, 2);
    for (let r = 2; r <= 5; r += 1) await runRound(request, room, r);

    await expect(root).toHaveAttribute("data-view", "waiting", { timeout: 20_000 });
    // 빠르게 넘긴 지난 라운드(2~4) 변동은 틀지 않는다 — 마지막 라운드(5) 것만 공개하고 끝난다
    await expect(page.locator('[data-testid="board-price-reveal"]:not([data-key^="5:"])')).toHaveCount(0);
    await expect(page.getByTestId("board-price-reveal")).toHaveCount(0, { timeout: 40_000 });
    await forEachViewport(page, "12명 종료 대기", { 768: "iter5-c-mafia-waiting-768" });

    await setReveal(room, true);
    await expect(root).toHaveAttribute("data-view", "result", { timeout: 15_000 });
    const podium = page.getByTestId("board-podium");
    await expect(podium).toHaveAttribute("data-done", "true", { timeout: 30_000 });
    await expect(page.getByTestId("board-mafia-result")).toHaveAttribute("data-mafia-shown", "true", { timeout: 30_000 });
    await forEachViewport(page, "12명 최종 포디움", { 720: "iter5-c-mafia-result-720" });
    await page.getByTestId("board-result-page-toggle").click();
    await expect(page.getByTestId("board-rounds-table")).toBeVisible();
    await forEachViewport(page, "12명 라운드별 추이", { 720: "iter5-c-mafia-rounds-720" });
    await page.setViewportSize(VIEWPORTS[0]);
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});
