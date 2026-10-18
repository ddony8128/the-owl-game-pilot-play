import { test, expect, type APIRequestContext } from "@playwright/test";
import { recommendedMonsterCounts } from "../lib/defense/composition";
import { DEFENSE_MONSTERS_BY_ID } from "../lib/defense/monsters";
import {
  SHOTS,
  VIEWPORTS,
  assertFits,
  defenseStep,
  defenseStepTo,
  endRoom,
  forEachViewport,
  intervalsOf,
  launchBoardBrowser,
  names,
  newRoom,
  openBoard,
  post,
  recordAttrTimeline,
} from "./board-helpers";

// 디펜스 보드(빔) — GM [다음] 버튼 하나로 단계를 넘기고 보드는 그 단계 화면에 머문다(또니 10-18).
//  준비(로비 QR) → 튜토리얼 1라운드(대기열+카운트다운) → 튜토리얼 1라운드 결과(순차 공개, 머무름) → … → 점수 발표 → … → 최종.

type Monster = { instanceId: string; monsterId: number; name?: string };
type State = { round: number; stage: string; monsters: Monster[]; score: number };
const stateOf = async (req: APIRequestContext, room: string, nick: string) =>
  (await (await req.get(`/api/defense/state?room=${room}&nickname=${encodeURIComponent(nick)}`)).json()) as State;
const combat = (req: APIRequestContext, room: string, nickname: string, target: string, slot: number) =>
  post(req, "/api/defense/action", { room, nickname, action_type: "combat", target_monster_id: target, used_card_slot: slot });

test.describe.configure({ mode: "serial" });

test("[보드1] 로비(QR·방 코드·인원, 타이머 없음) → [튜토리얼 1라운드 시작] → 대기열 + 타이머 자동 시작", async ({ request }) => {
  test.setTimeout(120_000);
  const room = await newRoom(request, "defense", names(6));
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "ready", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-stage", "ready");
    await expect(page.getByTestId("board-room-code")).toHaveText(room);
    const img = page.getByRole("img", { name: "참가 QR 코드" });
    await expect(img).toBeVisible();
    expect(await img.getAttribute("src")).toMatch(/^data:image\/png/);
    await expect(page.getByTestId("board-player-count")).toContainText("6");
    await expect(page.getByTestId("board-bg")).toHaveAttribute("data-bg", "stage-defense");
    // 준비 단계에는 타이머·안내 문구·수동 모드 버튼이 없다
    await expect(page.getByTestId("board-countdown")).toHaveCount(0);
    await expect(page.getByTestId("board-manual-toggle")).toHaveCount(0);
    await expect(page.getByText("자동 추종")).toHaveCount(0);
    await expect(page.getByText(/QR을 찍/)).toHaveCount(0);
    await assertFits(page, "로비 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-defense-lobby.png` });

    const s1 = await defenseStep(request, room);
    expect(s1).toMatchObject({ label: "튜토리얼 1라운드 시작", round: 1, stage: "action" });
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-round", "1");
    await expect(page.getByTestId("board-monster-card").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("board-title")).toContainText("튜토리얼 1라운드");
    // 행동 단계: 타이머가 자동으로 시작돼 흐른다
    const cd = page.getByTestId("board-countdown");
    await expect(cd).toHaveAttribute("data-running", "true", { timeout: 10_000 });
    const r1 = Number(await cd.getAttribute("data-remaining"));
    await page.waitForTimeout(2200);
    const r2 = Number(await cd.getAttribute("data-remaining"));
    expect(r2, "카운트다운이 줄어든다").toBeLessThan(r1);
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드2] [결과 보기] → 몬스터별 순차 공개(1.4초, 감시를 조작 전에 시작), 처치/피해/무사 → 결과 화면에 머문다 → [2라운드 시작]", async ({
  request,
}) => {
  test.setTimeout(180_000);
  const nicks = names(12);
  const room = await newRoom(request, "defense", nicks);
  await defenseStepTo(request, room, 4, "action"); // 튜토리얼 2라운드 + 점수 + 본게임 준비를 지나 본게임 1라운드 행동
  const monsters = (await stateOf(request, room, "u2")).monsters;
  expect(monsters.length, "12명 → 대기열 5칸").toBe(5);
  // 처치 1 · 피해 1 · 무사 3 을 만들려면 "물리기만 할" 몬스터는 HP 가 2 이상이어야 한다(스컬 스파이더는 HP 1 이라 카드 1 로도 처치됨)
  const bitten = monsters.find((m) => (DEFENSE_MONSTERS_BY_ID[m.monsterId]?.maxHp ?? 0) > 1)!;
  const target = monsters.find((m) => m.instanceId !== bitten.instanceId)!;
  for (const n of nicks) {
    if (n === "u2") await combat(request, room, n, bitten.instanceId, 1);
    else await combat(request, room, n, target.instanceId, 4);
  }

  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-round", "4");
    await expect(page.getByTestId("board-monster-card")).toHaveCount(5);
    await expect(page.getByTestId("board-countdown")).toBeVisible();

    // ① 감시 먼저 → ② GM [1라운드 결과 보기]
    const timeline = recordAttrTimeline(
      page,
      '[data-testid="board-root"][data-kind="result"] [data-testid="board-monster-grid"]',
      "data-shown",
      (v) => v >= 5,
      40_000,
    );
    const s = await defenseStep(request, room);
    expect(s).toMatchObject({ label: "1라운드 결과 보기", round: 5, stage: "result", earlyEnd: false });
    const log = await timeline;
    expect(log.map((l) => l.value), "0→5 로 한 장씩").toEqual([0, 1, 2, 3, 4, 5]);
    for (const g of intervalsOf(log, 1)) {
      expect(g, "공개 간격 1.4초").toBeGreaterThan(1000);
      expect(g).toBeLessThan(1900);
    }
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="defeated"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="defeated"]')).toContainText("처치!");
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="damaged"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="untouched"]')).toHaveCount(3);
    await expect(page.getByTestId("board-title")).toContainText("1라운드 전투 결과");
    // 결과 단계에는 타이머가 없고, 공개가 끝나도 화면이 넘어가지 않는다
    await expect(page.getByTestId("board-countdown")).toHaveCount(0);
    await page.waitForTimeout(5000);
    await expect(root).toHaveAttribute("data-kind", "result");
    await expect(root).toHaveAttribute("data-round", "4");
    await assertFits(page, "전투 결과 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-defense-result.png` });

    // GM [2라운드 시작] → 대기열 + 타이머
    const s2 = await defenseStep(request, room);
    expect(s2).toMatchObject({ label: "2라운드 시작", round: 5, stage: "action" });
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-round", "5");
    await expect(page.getByTestId("board-title")).toContainText("2라운드 · 공격하세요!");
    await expect(page.getByTestId("board-countdown")).toHaveAttribute("data-running", "true", { timeout: 10_000 });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드3] [튜토리얼 점수 발표] — 꼴찌부터 순차 공개, 공동 순위(1,1,1,4,4,4), 닉네임으로 가르지 않음", async ({ request }) => {
  test.setTimeout(150_000);
  const nicks = names(6);
  const room = await newRoom(request, "defense", nicks);
  await defenseStepTo(request, room, 1, "action");
  const monsters = (await stateOf(request, room, "u2")).monsters;
  const prey = monsters
    .map((m) => ({ m, def: DEFENSE_MONSTERS_BY_ID[m.monsterId] }))
    .filter((x) => x.def && x.def.maxHp <= 12 && Math.floor(x.def.points / 3) >= 1)
    .sort((a, b) => b.def.points - a.def.points)[0];
  expect(prey, "튜토리얼 대기열에 3명이 잡을 수 있는 몬스터").toBeTruthy();
  for (const n of nicks.slice(0, 3)) await combat(request, room, n, prey.m.instanceId, 4);
  await defenseStepTo(request, room, 3, "result"); // 1라운드 결과 → 2라운드 → 2라운드 결과

  const api = await (await request.get(`/api/defense/board-scores?room=${room}&round=3`)).json();
  expect(api.scores.map((s: { rank: number }) => s.rank)).toEqual([1, 1, 1, 4, 4, 4]);

  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "result", { timeout: 15_000 });
    const s = await defenseStep(request, room);
    expect(s).toMatchObject({ label: "튜토리얼 점수 발표", round: 3, stage: "score" });
    await expect(root).toHaveAttribute("data-kind", "score", { timeout: 15_000 });
    const appeared: number[][] = [];
    let prev: number[] = [];
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const shown = (
        await page
          .locator('[data-testid="board-ranking-row"][data-shown="true"]')
          .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank"))))
      ).sort((a, b) => a - b);
      if (shown.length > prev.length) {
        const rest = prev.slice();
        appeared.push(
          shown.filter((r) => {
            const i = rest.indexOf(r);
            if (i >= 0) {
              rest.splice(i, 1);
              return false;
            }
            return true;
          }),
        );
        prev = shown;
      }
      if (shown.length >= 6) break;
      await page.waitForTimeout(60);
    }
    expect(prev.length, "6줄 전부 공개").toBe(6);
    expect(appeared[0], "맨 처음 공개된 줄은 꼴찌(4위)").toEqual([4]);
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="1"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="2"]')).toHaveCount(0);
    await expect(page.getByTestId("board-title")).toContainText("튜토리얼 점수 발표");
    await expect(page.getByTestId("board-countdown")).toHaveCount(0);
    await assertFits(page, "점수 발표 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-defense-score.png` });
    // 점수 → [본게임 준비] → 새 대기열(타이머 없음) → [1라운드 시작]
    expect(await defenseStep(request, room)).toMatchObject({ label: "본게임 준비", round: 4, stage: "prep" });
    await expect(root).toHaveAttribute("data-stage", "prep", { timeout: 15_000 });
    await expect(page.getByTestId("board-title")).toContainText("본게임 준비");
    await expect(page.getByTestId("board-countdown")).toHaveCount(0);
    expect(await defenseStep(request, room)).toMatchObject({ label: "1라운드 시작", round: 4, stage: "action" });
    await expect(root).toHaveAttribute("data-stage", "action", { timeout: 15_000 });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드4] 폴링 실패: 마지막 화면 유지 + 재연결 배지, 복구되면 배지 사라짐", async ({ request }) => {
  test.setTimeout(120_000);
  const room = await newRoom(request, "defense", names(6));
  await defenseStep(request, room);
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(page.getByTestId("board-monster-card").first()).toBeVisible({ timeout: 10_000 });
    const cards = await page.getByTestId("board-monster-card").count();
    await expect(page.getByTestId("connection-badge")).toHaveCount(0);
    await page.route("**/api/**", (route) => route.abort());
    await expect(page.getByTestId("connection-badge")).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-kind", "snapshot");
    await expect(page.getByTestId("board-monster-card")).toHaveCount(cards);
    await page.unroute("**/api/**");
    await expect(page.getByTestId("connection-badge")).toHaveCount(0, { timeout: 15_000 });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드5] 넘침 0 — 12명 × 3해상도 × [다음]으로 가는 모든 단계(준비·대기열·결과·점수·본게임 준비·최종), 도망 연출 포함", async ({ request }) => {
  test.setTimeout(600_000);
  const room = await newRoom(request, "defense", names(12));
  await post(request, "/api/gm/defense/monster-config", { room, counts: recommendedMonsterCounts(12) });
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "ready", { timeout: 15_000 });
    let sawExpired = false;
    let steps = 0;
    for (;;) {
      const kind = (await root.getAttribute("data-kind")) ?? "";
      const stage = (await root.getAttribute("data-stage")) ?? "";
      const round = (await root.getAttribute("data-round")) ?? "";
      const label = `step ${steps} ${stage}:${round}`;
      if (kind === "snapshot" || kind === "result") {
        await expect(page.getByTestId("board-monster-grid").or(page.getByTestId("board-monster-empty"))).toBeVisible({ timeout: 15_000 });
        if ((await page.getByTestId("board-monster-grid").count()) > 0) {
          const grid = page.getByTestId("board-monster-grid");
          const total = Number(await grid.getAttribute("data-total"));
          await expect(grid).toHaveAttribute("data-shown", String(total), { timeout: 20_000 });
          if (kind === "result" && (await page.locator('[data-testid="board-monster-card"][data-cue="expired"]').count()) > 0) sawExpired = true;
        }
      } else if (kind === "score") {
        await expect(page.getByTestId("board-ranking")).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId("board-ranking")).toHaveAttribute("data-done", "true", { timeout: 30_000 });
      } else {
        await expect(page.getByTestId("board-lobby")).toBeVisible({ timeout: 15_000 });
      }
      const shots: Record<number, string> = {};
      if (stage === "action" && round === "4") shots[720] = "iter5-c-defense-snapshot-720";
      if (kind === "result" && round === "4") shots[768] = "iter5-c-defense-result-flee-768";
      if (kind === "score" && round === "16") shots[720] = "iter5-c-defense-final-720";
      await forEachViewport(page, label, shots);
      if (kind === "score" && round === "16") break;
      const res = await request.post("/api/gm/defense/step", { data: { room } });
      if (res.status() === 409) break;
      expect(res.ok(), `step ${steps}: ${await res.text()}`).toBeTruthy();
      const json = await res.json();
      await expect(root).toHaveAttribute("data-stage-key", `${json.round}:${json.stage}:${json.stage === "result" ? json.prevRound : json.round}`, {
        timeout: 15_000,
      });
      steps += 1;
      if (steps > 40) throw new Error("단계가 끝나지 않음");
    }
    expect(steps, "최소 10단계는 지나야 한다").toBeGreaterThanOrEqual(10);
    expect(sawExpired, "도망(expired) 연출을 한 번 이상 봤다").toBe(true);
    await expect(root).toHaveAttribute("data-kind", "score");
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="1"]')).toHaveCount(12);
    await page.setViewportSize(VIEWPORTS[0]);
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});
