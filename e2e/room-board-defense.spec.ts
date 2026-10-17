import { test, expect, type APIRequestContext } from "@playwright/test";
import { recommendedMonsterCounts } from "../lib/defense/composition";
import { DEFENSE_MONSTERS_BY_ID } from "../lib/defense/monsters";
import {
  SHOTS,
  VIEWPORTS,
  assertFits,
  defenseRound,
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

// Iteration 5 WS-C — 디펜스 보드(빔): 로비 QR·카운트다운·GM 자동 추종·전투 결과 순차 공개·점수 꼴찌부터·수동 모드·
// 폴링 실패 유지·3해상도 넘침 0.

type Monster = { instanceId: string; monsterId: number; name?: string };
type State = { round: number; monsters: Monster[]; score: number };
const stateOf = async (req: APIRequestContext, room: string, nick: string) =>
  (await (await req.get(`/api/defense/state?room=${room}&nickname=${encodeURIComponent(nick)}`)).json()) as State;
const combat = (req: APIRequestContext, room: string, nickname: string, target: string, slot: number) =>
  post(req, "/api/defense/action", {
    room,
    nickname,
    action_type: "combat",
    target_monster_id: target,
    used_card_slot: slot,
  });

test.describe.configure({ mode: "serial" });

test("[보드1] 로비: 큰 QR·방 코드·인원·카운트다운 → GM 라운드 0→1 자동 추종(클릭 없음)", async ({ request }) => {
  test.setTimeout(120_000);
  const room = await newRoom(request, "defense", names(6));
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "ready", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-mode", "auto");
    await expect(page.getByTestId("board-room-code")).toHaveText(room);
    const img = page.getByRole("img", { name: "참가 QR 코드" });
    await expect(img).toBeVisible();
    expect(await img.getAttribute("src")).toMatch(/^data:image\/png/);
    await expect(page.getByTestId("board-player-count")).toContainText("6");
    // 테마 배경(어둡게) + QR 가독성: 배경 레이어와 흰 QR 바탕이 함께 있다
    await expect(page.getByTestId("board-bg")).toHaveAttribute("data-bg", "stage-defense");

    // 카운트다운: 시작 전 05:00 → GM 이 시작하면 흐른다
    const cd = page.getByTestId("board-countdown");
    await expect(cd).toHaveAttribute("data-has-timer", "true", { timeout: 10_000 });
    await expect(cd).toContainText("05:00");
    await assertFits(page, "로비 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-defense-lobby.png` });

    await post(request, "/api/gm/timers/defense", { room, action: "start" });
    await expect(cd).toHaveAttribute("data-running", "true", { timeout: 10_000 });
    const r1 = Number(await cd.getAttribute("data-remaining"));
    await page.waitForTimeout(2200);
    const r2 = Number(await cd.getAttribute("data-remaining"));
    expect(r2, "카운트다운이 줄어든다").toBeLessThan(r1);
    expect(r2).toBeGreaterThan(280);

    // GM 라운드 0→1: 보드가 스스로 튜토리얼 1라운드 대기열로
    await defenseRound(request, room, 1);
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-round", "1");
    await expect(page.getByTestId("board-monster-card").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("board-title")).toContainText("튜토리얼 1라운드");
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드2] 전투 결과 몬스터별 순차 공개(1.4초) — 감시를 조작 전에 시작, 처치/피해/무사 연출 → 다음 대기열 자동", async ({
  request,
}) => {
  test.setTimeout(180_000);
  const room = await newRoom(request, "defense", names(12));
  await post(request, "/api/gm/defense/monster-config", { room, counts: recommendedMonsterCounts(12) });
  for (let r = 1; r <= 4; r += 1) await defenseRound(request, room, r);
  const monsters = (await stateOf(request, room, "u2")).monsters;
  expect(monsters.length, "본게임 1라운드 대기열 5칸").toBe(5);
  const [target, bitten] = monsters;
  // 12명 전원이 target 에 카드4 → 합 48 ≥ 모든 몬스터 HP → 처치. u2 만 bitten 에 카드1 → 피해.
  const nicks = names(12);
  for (const n of nicks) {
    if (n === "u2") await combat(request, room, n, bitten.instanceId, 1);
    else await combat(request, room, n, target.instanceId, 4);
  }

  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`, { holdScale: 0.5 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(root).toHaveAttribute("data-round", "4");
    await expect(page.getByTestId("board-monster-card")).toHaveCount(5);

    // ① 감시를 먼저 건다(그리드의 data-shown 이 5가 될 때까지 기록) → ② 그 다음 GM 이 라운드를 넘긴다
    const timeline = recordAttrTimeline(
      page,
      '[data-testid="board-root"][data-kind="result"] [data-testid="board-monster-grid"]',
      "data-shown",
      (v) => v >= 5,
      40_000,
    );
    await defenseRound(request, room, 5);
    const log = await timeline;
    expect(log.map((l) => l.value), "0→5 로 한 장씩").toEqual([0, 1, 2, 3, 4, 5]);
    const gaps = intervalsOf(log, 1);
    for (const g of gaps) {
      expect(g, `공개 간격 ${gaps.map((x) => Math.round(x)).join(", ")}`).toBeGreaterThan(1000);
      expect(g).toBeLessThan(1900);
    }

    // 연출: 처치 / 피해 / 무사
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="defeated"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="defeated"]')).toContainText("처치!");
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="damaged"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="damaged"]')).toContainText(/\d+ 피해/);
    await expect(page.locator('[data-testid="board-monster-card"][data-cue="untouched"]')).toHaveCount(3);
    await expect(page.getByTestId("board-title")).toContainText("1라운드 전투 결과");
    await assertFits(page, "전투 결과 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-defense-result.png` });

    // 공개가 끝나면 (hold 뒤) 2라운드 대기열로 자동 전환
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 20_000 });
    await expect(root).toHaveAttribute("data-round", "5");
    await expect(page.getByTestId("board-title")).toContainText("2라운드 · 공격하세요!");
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드3] 점수 발표 — 꼴찌부터 순차 공개, 공동 순위 표기(1,1,1,4,4,4), 닉네임으로 가르지 않음", async ({ request }) => {
  test.setTimeout(150_000);
  const nicks = names(6);
  const room = await newRoom(request, "defense", nicks);
  await defenseRound(request, room, 1);
  const monsters = (await stateOf(request, room, "u2")).monsters;
  // 세 명이 같은 몬스터에 카드4(합 12) → 처치, 점수 균등 분배(동점). 1/3 해도 1점 이상 남는 몬스터를 고른다.
  const prey = monsters
    .map((m) => ({ m, def: DEFENSE_MONSTERS_BY_ID[m.monsterId] }))
    .filter((x) => x.def && x.def.maxHp <= 12 && Math.floor(x.def.points / 3) >= 1)
    .sort((a, b) => b.def.points - a.def.points)[0];
  expect(prey, "튜토리얼 대기열에 3명이 잡을 수 있는 몬스터").toBeTruthy();
  for (const n of nicks.slice(0, 3)) await combat(request, room, n, prey.m.instanceId, 4);
  // 나머지 셋은 미제출(0점)
  await defenseRound(request, room, 2);
  await defenseRound(request, room, 3);

  // API: rank·tieCount 가 lib/defense/rank.ts 규칙대로
  const api = await (await request.get(`/api/defense/board-scores?room=${room}&round=3`)).json();
  const ranks = api.scores.map((s: { rank: number }) => s.rank);
  expect(ranks).toEqual([1, 1, 1, 4, 4, 4]);
  expect(api.scores[0].tieCount).toBe(3);
  expect(api.scores[0].points).toBeGreaterThan(0);
  expect(api.scores[3].points).toBe(0);

  const browser = await launchBoardBrowser();
  try {
    // 자동 모드는 2라운드 결과 공개를 먼저 보여 주므로, 수동 모드로 점수 발표 단계(타임라인 5)로 바로 간다
    const { page } = await openBoard(browser, `/defense-board?room=${room}`, { holdScale: 0.2 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-gm-round", "3", { timeout: 15_000 });
    await page.getByTestId("board-manual-toggle").click();
    await expect(root).toHaveAttribute("data-mode", "manual");
    for (let i = 0; i < 6; i += 1) {
      const kind = await root.getAttribute("data-kind");
      if (kind === "score") break;
      await page.getByTestId("board-next").click();
      await page.waitForTimeout(100);
    }
    // 수동으로 들어가는 시점부터 기록(연출은 리마운트로 처음부터 시작)
    await expect(root).toHaveAttribute("data-kind", "score");
    // 보이는 줄이 늘 때마다 "새로 보인 등수"를 기록(공개 순서 = 꼴찌 → 1위)
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
        const added = shown.filter((r) => {
          const i = rest.indexOf(r);
          if (i >= 0) {
            rest.splice(i, 1);
            return false;
          }
          return true;
        });
        appeared.push(added);
        prev = shown;
      }
      if (shown.length >= 6) break;
      await page.waitForTimeout(60);
    }
    expect(prev.length, "6줄 전부 공개").toBe(6);
    expect(appeared[0], "맨 처음 공개된 줄은 꼴찌(4위)").toEqual([4]);
    for (let i = 1; i < appeared.length; i += 1) {
      const before = Math.min(...appeared.slice(0, i).flat());
      for (const r of appeared[i]) expect(r, `공개 순서 ${JSON.stringify(appeared)}`).toBeLessThanOrEqual(before);
    }
    await expect(page.getByText("공동", { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="1"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="4"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="2"]')).toHaveCount(0);
    await expect(page.getByTestId("board-title")).toContainText("튜토리얼 점수 발표");
    await assertFits(page, "점수 발표 1920");
    await page.screenshot({ path: `${SHOTS}/iter5-c-defense-score.png` });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드4] 수동 모드: GM 라운드가 바뀌어도 화면이 움직이지 않고, 자동으로 돌아오면 다시 추종", async ({ request }) => {
  test.setTimeout(120_000);
  const room = await newRoom(request, "defense", names(4));
  await defenseRound(request, room, 1);
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`, { holdScale: 0.2 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await page.getByTestId("board-manual-toggle").click();
    await expect(root).toHaveAttribute("data-mode", "manual");
    await expect(root).toHaveAttribute("data-kind", "snapshot"); // 보던 단계에서 이어 간다
    await page.getByTestId("board-prev").click();
    await expect(root).toHaveAttribute("data-kind", "ready");
    await expect(page.getByTestId("board-prev")).toBeDisabled();

    await defenseRound(request, room, 2);
    await page.waitForTimeout(4000); // 폴링 여러 번
    await expect(root).toHaveAttribute("data-kind", "ready");
    await expect(root).toHaveAttribute("data-gm-round", "2"); // 추종은 안 하지만 GM 진행은 알고 있다
    await expect(page.getByTestId("board-subtitle")).toContainText("수동 모드");

    await page.getByTestId("board-manual-toggle").click();
    await expect(root).toHaveAttribute("data-mode", "auto");
    await expect(root).toHaveAttribute("data-kind", "result", { timeout: 10_000 });
    await expect(root).toHaveAttribute("data-round", "1");
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 30_000 });
    await expect(root).toHaveAttribute("data-round", "2");
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드5] 폴링 실패: 마지막 화면 유지 + 재연결 배지, 복구되면 배지 사라짐", async ({ request }) => {
  test.setTimeout(120_000);
  const room = await newRoom(request, "defense", names(6));
  await defenseRound(request, room, 1);
  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`);
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-kind", "snapshot", { timeout: 15_000 });
    await expect(page.getByTestId("board-monster-card").first()).toBeVisible({ timeout: 10_000 });
    const cards = await page.getByTestId("board-monster-card").count();
    expect(cards).toBeGreaterThan(0);
    await expect(page.getByTestId("connection-badge")).toHaveCount(0);

    await page.route("**/api/**", (route) => route.abort());
    await expect(page.getByTestId("connection-badge")).toBeVisible({ timeout: 15_000 });
    await expect(root).toHaveAttribute("data-kind", "snapshot");
    await expect(page.getByTestId("board-monster-card")).toHaveCount(cards);
    await expect(page.getByTestId("board-stage-loading")).toHaveCount(0);

    await page.unroute("**/api/**");
    await expect(page.getByTestId("connection-badge")).toHaveCount(0, { timeout: 15_000 });
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});

test("[보드6] 넘침 0 — 12명 × 3해상도 × 모든 단계(준비·대기열·전투 결과·점수·최종), 도망 연출 포함", async ({ request }) => {
  test.setTimeout(600_000);
  const room = await newRoom(request, "defense", names(12));
  await post(request, "/api/gm/defense/monster-config", { room, counts: recommendedMonsterCounts(12) });
  // 아무도 공격하지 않고 16까지 → 몬스터는 시간이 다해 도망(expired), 점수는 전원 0 동점(공동 1위 12명)
  for (let r = 1; r <= 16; r += 1) await defenseRound(request, room, r);

  const browser = await launchBoardBrowser();
  try {
    const { page } = await openBoard(browser, `/defense-board?room=${room}`, { holdScale: 0.1 });
    const root = page.getByTestId("board-root");
    await expect(root).toHaveAttribute("data-gm-round", "16", { timeout: 15_000 });
    await page.getByTestId("board-manual-toggle").click();
    await expect(root).toHaveAttribute("data-mode", "manual");
    // 타임라인 처음으로
    for (let i = 0; i < 40; i += 1) {
      if (await page.getByTestId("board-prev").isDisabled()) break;
      await page.getByTestId("board-prev").click();
    }
    await expect(root).toHaveAttribute("data-kind", "ready");

    let sawExpired = false;
    let step = 0;
    for (;;) {
      const kind = (await root.getAttribute("data-kind")) ?? "";
      const round = (await root.getAttribute("data-round")) ?? "";
      const label = `step ${step} ${kind}:${round}`;
      if (kind === "snapshot" || kind === "result") {
        await expect(page.getByTestId("board-monster-grid").or(page.getByTestId("board-monster-empty"))).toBeVisible({
          timeout: 15_000,
        });
        if ((await page.getByTestId("board-monster-grid").count()) > 0) {
          const grid = page.getByTestId("board-monster-grid");
          const total = Number(await grid.getAttribute("data-total"));
          await expect(grid).toHaveAttribute("data-shown", String(total), { timeout: 20_000 });
          if (kind === "result" && (await page.locator('[data-testid="board-monster-card"][data-cue="expired"]').count()) > 0)
            sawExpired = true;
        }
      } else if (kind === "score") {
        await expect(page.getByTestId("board-ranking")).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId("board-ranking")).toHaveAttribute("data-done", "true", { timeout: 30_000 });
      } else {
        await expect(page.getByTestId("board-lobby")).toBeVisible({ timeout: 15_000 });
      }
      const shots: Record<number, string> = {};
      if (kind === "snapshot" && round === "4") shots[720] = "iter5-c-defense-snapshot-720";
      if (kind === "result" && round === "4") shots[768] = "iter5-c-defense-result-flee-768";
      if (kind === "score" && round === "16") shots[720] = "iter5-c-defense-final-720";
      await forEachViewport(page, label, shots);
      if (await page.getByTestId("board-next").isDisabled()) break;
      await page.getByTestId("board-next").click();
      step += 1;
      if (step > 40) throw new Error("타임라인이 끝나지 않음");
    }
    expect(step, "타임라인 33단계").toBe(32);
    expect(sawExpired, "도망(expired) 연출을 한 번 이상 봤다").toBe(true);
    // 최종 점수: 전원 0점 공동 1위 — 왕관 12개가 아니라 '공동 1위' 12줄
    await expect(page.locator('[data-testid="board-ranking-row"][data-rank="1"]')).toHaveCount(12);
    await page.setViewportSize(VIEWPORTS[0]);
    await page.close();
  } finally {
    await browser.close();
    await endRoom(request, room);
  }
});
