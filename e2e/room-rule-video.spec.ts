import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import chapters from "../video/generated/chapters.json";

// Iteration 2 — 룰 영상(디펜스 · 마피아): GM 대시보드 [룰 영상] 패널 ↔ 보드 전체 화면 재생.
//  (a) 패널 렌더 · 게임 불일치 400 · 종료 방 비활성 · 컬럼 없는 DB에서도 500 없음
//  (b) DB에 rooms.board_video 컬럼이 있을 때만: 실제 재생 → 장 이동 → 정지 → 종료 보고
//  (c) 보드 오버레이 동작(/api/board-video 응답을 가로채 검증 — DB와 무관)
// 테스트가 만든 방은 끝에 [방 종료].

// Playwright 기본 Chromium은 H.264/AAC(mp4)를 못 튼다 → 설치된 Chrome + 자동 재생 허용(파일 전체)
test.use({ channel: "chrome", launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

const created: string[] = [];

async function newRoom(request: APIRequestContext, game: "mafia" | "defense", names: string[] = []) {
  const code = (await (await request.post("/api/gm/rooms", { data: { game } })).json()).room
    .code as string;
  created.push(code);
  for (const nickname of names) await request.post("/api/gm/players", { data: { room: code, nickname } });
  return code;
}

const endRoom = (request: APIRequestContext, code: string) =>
  request.patch("/api/gm/rooms", { data: { code, status: "ended", ended_normally: true } });

test.afterAll(async ({ request }) => {
  for (const code of created) await endRoom(request, code);
});

type Chapter = { label: string; atSec: number };
const CH = chapters as Record<string, Chapter[]>;

async function columnExists(request: APIRequestContext, code: string) {
  const j = await (await request.get(`/api/board-video?room=${code}`)).json();
  return !j.columnMissing;
}

test("[a] 영상 파일 2편이 서빙된다", async ({ request }) => {
  for (const id of ["defense", "mafia"]) {
    const res = await request.get(`/video/${id}.mp4`);
    expect(res.status(), id).toBe(200);
    expect(res.headers()["content-type"]).toContain("video/mp4");
  }
});

test("[a] GM 대시보드 두 게임에 [룰 영상] 패널 — 이름·길이·장 버튼", async ({ page, request }) => {
  test.setTimeout(60_000);
  for (const game of ["defense", "mafia"] as const) {
    const code = await newRoom(request, game, ["v1"]);
    await page.goto(`/dashboard/x9a2k7/${game}?room=${code}`);
    const panel = page.getByTestId("rule-video-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel).toContainText(game === "defense" ? "디펜스 딜레마 · 규칙" : "자본주의 마피아 · 규칙");
    await expect(panel.getByRole("button", { name: "▶ 보드에서 재생" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "■ 정지" })).toBeVisible();
    for (const c of CH[game]!.filter((x) => x.label !== "끝")) {
      await expect(panel.getByRole("button", { name: c.label, exact: true })).toBeVisible();
    }
  }
});

test("[a] API: 게임 불일치 400 · 알 수 없는 영상 400 · 없는 방 404 · 종료 방 409", async ({ request }) => {
  const d = await newRoom(request, "defense");
  const m = await newRoom(request, "mafia");
  const patch = (code: string, video: unknown, seekSec?: number) =>
    request.patch("/api/gm/rooms/video", { data: { code, video, seekSec } });
  expect((await patch(d, "mafia")).status()).toBe(400);
  expect((await patch(m, "defense")).status()).toBe(400);
  expect((await patch(d, "rules")).status()).toBe(400);
  expect((await patch("ZZZZZ", "defense")).status()).toBe(404);
  // 컬럼 없는 DB에서도 조회·종료 보고는 500을 내지 않는다
  const g = await request.get(`/api/board-video?room=${d}`);
  expect(g.status()).toBe(200);
  expect((await request.post("/api/board-video/ended", { data: { code: d, video: "defense" } })).status()).toBe(200);
  await endRoom(request, d);
  expect((await patch(d, "defense")).status()).toBe(409);
});

test("[a] 종료된 방은 패널 버튼 비활성 + 안내", async ({ page, request }) => {
  test.setTimeout(60_000);
  const code = await newRoom(request, "mafia", ["e1"]);
  await endRoom(request, code);
  await page.goto(`/dashboard/x9a2k7/mafia?room=${code}`);
  const panel = page.getByTestId("rule-video-panel");
  await expect(panel.getByTestId("rule-video-ended")).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByRole("button", { name: "▶ 보드에서 재생" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "목표", exact: true })).toBeDisabled();
});

test("[a] 컬럼이 없는 DB면 패널이 마이그레이션 안내 + 버튼 비활성", async ({ page, request }) => {
  const code = await newRoom(request, "defense", ["c1"]);
  test.skip(await columnExists(request, code), "board_video 컬럼이 이미 있음 — 해당 없음");
  await page.goto(`/dashboard/x9a2k7/defense?room=${code}`);
  const panel = page.getByTestId("rule-video-panel");
  await expect(panel.getByTestId("rule-video-column-missing")).toContainText(
    "supabase/migrations/2026-10-08-board-video.sql",
    { timeout: 20_000 },
  );
  await expect(panel.getByRole("button", { name: "▶ 보드에서 재생" })).toBeDisabled();
  expect((await request.patch("/api/gm/rooms/video", { data: { code, video: "defense" } })).status()).toBe(503);
});

// ── (b) 실제 재생 — 컬럼이 있을 때만 ─────────────────────────────
test.describe("[b] 실재생 (board_video 컬럼 필요)", () => {
  for (const [game, jump] of [
    ["defense", "전투 처리"],
    ["mafia", "직업 경매"],
  ] as const) {
  test(`${game}: GM 재생 → 보드 오버레이 → 장 이동 → 정지 → 재생 → 종료 보고 → null`, async ({ browser, request }) => {
    test.setTimeout(120_000);
    const code = await newRoom(request, game, ["b1"]);
    test.skip(!(await columnExists(request, code)), "DB에 board_video 컬럼 없음 — 마이그레이션 실행 후 수행(Iteration 2b)");

    const gm = await browser.newPage();
    const board = await browser.newPage();
    await gm.goto(`/dashboard/x9a2k7/${game}?room=${code}`);
    await board.goto(`/${game}-board?room=${code}`);
    const panel = gm.getByTestId("rule-video-panel");

    await panel.getByRole("button", { name: "▶ 보드에서 재생" }).click();
    await expect(board.getByTestId("board-video")).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByTestId("rule-video-playing")).toBeVisible({ timeout: 10_000 });

    const target = CH[game]!.find((c) => c.label === jump)!;
    await panel.getByRole("button", { name: jump, exact: true }).click();
    await expect
      .poll(() => board.getByTestId("board-video").evaluate((v: HTMLVideoElement) => v.currentTime), {
        timeout: 10_000,
      })
      .toBeGreaterThan(target.atSec - 2);
    await expect(panel.getByTestId("rule-video-playing")).toContainText(jump);

    await panel.getByRole("button", { name: "■ 정지" }).click();
    await expect(board.getByTestId("board-video")).toHaveCount(0, { timeout: 10_000 });

    // 다시 재생 → 끝(마지막 0.5초로 보내 ended 유도) → 보드가 서버에 null 보고
    await panel.getByRole("button", { name: "정리", exact: true }).click();
    await expect(board.getByTestId("board-video")).toBeVisible({ timeout: 10_000 });
    await board.getByTestId("board-video").evaluate((v: HTMLVideoElement) => {
      v.currentTime = Math.max(0, v.duration - 0.5);
    });
    await expect
      .poll(async () => (await (await request.get(`/api/board-video?room=${code}`)).json()).video, {
        timeout: 15_000,
      })
      .toBe(null);
    await expect(board.getByTestId("board-video")).toHaveCount(0);
    await expect(panel.getByTestId("rule-video-playing")).toHaveCount(0, { timeout: 10_000 });
    await gm.close();
    await board.close();
  });
  }
});

// ── (c) 보드 오버레이 동작 — /api/board-video를 가로채 검증(DB 컬럼과 무관) ──
test.describe("[c] 보드 오버레이 (응답 가로채기)", () => {
  async function mockBoardVideo(page: Page, state: { video: string | null; seekSec: number | null }) {
    const ended: unknown[] = [];
    await page.route((u) => u.pathname === "/api/board-video", (route) =>
      route.fulfill({ json: { ...state, columnMissing: false, status: "active" } }),
    );
    await page.route((u) => u.pathname === "/api/board-video/ended", async (route) => {
      ended.push(route.request().postDataJSON());
      state.video = null;
      state.seekSec = null;
      await route.fulfill({ json: { ok: true } });
    });
    return ended;
  }

  for (const game of ["defense", "mafia"] as const) {
    test(`${game}: 재생 → 장 이동 → 정지 → 재생 → 끝 → 종료 보고`, async ({ page, request }) => {
      test.setTimeout(90_000);
      const code = await newRoom(request, game);
      const state = { video: game as string | null, seekSec: 0 as number | null };
      const ended = await mockBoardVideo(page, state);
      await page.goto(`/${game}-board?room=${code}`);

      const video = page.getByTestId("board-video");
      await expect(video).toBeVisible({ timeout: 10_000 });
      await expect(video).toHaveAttribute("data-video-id", game);
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), { timeout: 15_000 })
        .toBe(true);

      // 장 이동
      const ch = CH[game]!.filter((c) => c.label !== "끝")[3]!;
      state.seekSec = Math.floor(ch.atSec);
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 })
        .toBeGreaterThan(ch.atSec - 2);

      // 정지(서버 값 null) → 오버레이 사라짐
      state.video = null;
      state.seekSec = null;
      await expect(video).toHaveCount(0, { timeout: 10_000 });

      // 다시 재생 → 끝으로 보내 ended → 종료 보고 → 오버레이 사라짐
      state.video = game;
      state.seekSec = 0;
      await expect(video).toBeVisible({ timeout: 10_000 });
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 })
        .toBeGreaterThan(0);
      await video.evaluate((v: HTMLVideoElement) => {
        v.currentTime = Math.max(0, v.duration - 0.4);
      });
      await expect.poll(() => ended.length, { timeout: 15_000 }).toBeGreaterThan(0);
      expect(ended[0]).toMatchObject({ code, video: game });
      await expect(video).toHaveCount(0, { timeout: 10_000 });
    });
  }

  test("파일을 못 불러오면 안내 후 5초 뒤 종료 보고", async ({ page, request }) => {
    test.setTimeout(60_000);
    const code = await newRoom(request, "defense");
    const ended = await mockBoardVideo(page, { video: "defense", seekSec: 0 });
    await page.route((u) => u.pathname === "/video/defense.mp4", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );
    await page.goto(`/defense-board?room=${code}`);
    await expect(page.getByTestId("board-video-failed")).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => ended.length, { timeout: 12_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("board-video-stage")).toHaveCount(0, { timeout: 10_000 });
  });

  test("자동 재생이 막히면 ▶ 버튼 → 누르면 재생", async ({ page, request }) => {
    test.setTimeout(60_000);
    const code = await newRoom(request, "mafia");
    // 브라우저 정책 대신 첫 play()를 거절시켜 '자동 재생 차단'을 만든다(사용자 클릭부터는 정상).
    await page.addInitScript(() => {
      const orig = HTMLMediaElement.prototype.play;
      let first = true;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        if (first) {
          first = false;
          return Promise.reject(new DOMException("blocked", "NotAllowedError"));
        }
        return orig.call(this);
      };
    });
    await mockBoardVideo(page, { video: "mafia", seekSec: 0 });
    await page.goto(`/mafia-board?room=${code}`);
    const play = page.getByTestId("board-video-play");
    await expect(play).toBeVisible({ timeout: 10_000 });
    await play.click();
    await expect(play).toHaveCount(0);
    await expect
      .poll(() => page.getByTestId("board-video").evaluate((v: HTMLVideoElement) => !v.paused), {
        timeout: 10_000,
      })
      .toBe(true);
  });
});
