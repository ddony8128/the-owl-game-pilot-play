import { expect, chromium, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// 보드(빔) E2E 공통 — Iteration 5 WS-C. (.spec 이 아니므로 테스트로 돌지 않는다)

export const SHOTS = "C:/not_system/project/ai-runner/missions/owl-main/shots";
mkdirSync(SHOTS, { recursive: true });

/** 운영 빔 해상도 3종(수산시장 iteration33 의 5종 중 또니 지시 3종) */
export const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

export async function post(req: APIRequestContext, path: string, data: unknown) {
  const res = await req.post(path, { data });
  if (!res.ok()) throw new Error(`${path} -> ${res.status()}: ${await res.text()}`);
  return res.json();
}

export async function newRoom(req: APIRequestContext, game: "defense" | "mafia", players: string[]): Promise<string> {
  const room: string = (await post(req, "/api/gm/rooms", { game })).room.code;
  for (const nickname of players) await post(req, "/api/gm/players", { room, nickname });
  return room;
}

export const names = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? "가나다라마바사아자차" : `u${i + 1}`));

export async function endRoom(req: APIRequestContext, room: string) {
  await req.patch("/api/gm/rooms", { data: { code: room, status: "ended", ended_normally: true } });
}

export const defenseRound = (req: APIRequestContext, room: string, round: number) =>
  post(req, "/api/gm/defense/round", { room, round });
/** GM [다음] 한 번 — 응답 { label, round, stage, prevRound, earlyEnd } */
export const defenseStep = (req: APIRequestContext, room: string) =>
  post(req, "/api/gm/defense/step", { room }) as Promise<{ label: string; round: number; stage: string; prevRound: number; earlyEnd: boolean }>;
/** [다음]을 (round, stage) 에 도달할 때까지 누른다(최대 40회) */
export async function defenseStepTo(req: APIRequestContext, room: string, round: number, stage: string) {
  for (let i = 0; i < 40; i += 1) {
    const r = await defenseStep(req, room);
    if (r.round === round && r.stage === stage) return r;
  }
  throw new Error(`defenseStepTo: (${round}, ${stage}) 에 도달하지 못함`);
}
export const mafiaAdvance = (req: APIRequestContext, room: string, to: string) =>
  post(req, "/api/gm/mafia/advance-phase", { room, to });
export const mafiaNextRound = (req: APIRequestContext, room: string, round: number) =>
  post(req, "/api/gm/mafia/phase", { room, round });

/**
 * 헤드리스 크로미엄은 기본으로 --hide-scrollbars 를 켠다 → 운영 PC 와 다르다(반면교사 1-12).
 * 넘침 검사는 이 브라우저로 한다.
 */
export async function launchBoardBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] });
}

export async function openBoard(
  browser: Browser,
  path: string,
  opts: { pollMs?: number; holdScale?: number; viewport?: { width: number; height: number } } = {},
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? VIEWPORTS[0] });
  const page = await ctx.newPage();
  await page.addInitScript(
    ({ pollMs, holdScale }) => {
      (window as unknown as { __OWL_POLL__?: number }).__OWL_POLL__ = pollMs;
      if (holdScale != null) (window as unknown as { __OWL_BOARD_HOLD_SCALE__?: number }).__OWL_BOARD_HOLD_SCALE__ = holdScale;
    },
    { pollMs: opts.pollMs ?? 500, holdScale: opts.holdScale ?? null },
  );
  await page.goto(path);
  return { ctx, page };
}

/** 문서 scrollHeight ≤ innerHeight+1, scrollWidth ≤ innerWidth+1, board-main 안도 넘치지 않음 */
export async function assertFits(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="board-main"]') as HTMLElement | null;
    const root = document.querySelector('[data-testid="board-root"]') as HTMLElement | null;
    return {
      sh: document.documentElement.scrollHeight,
      sw: document.documentElement.scrollWidth,
      ih: window.innerHeight,
      iw: window.innerWidth,
      msh: main?.scrollHeight ?? 0,
      mch: main?.clientHeight ?? 0,
      rsh: root?.scrollHeight ?? 0,
      rch: root?.clientHeight ?? 0,
    };
  });
  expect(m.sh, `${label}: scrollHeight ${m.sh} > innerHeight ${m.ih}`).toBeLessThanOrEqual(m.ih + 1);
  expect(m.sw, `${label}: scrollWidth ${m.sw} > innerWidth ${m.iw}`).toBeLessThanOrEqual(m.iw + 1);
  expect(m.rsh, `${label}: board-root 안 넘침 ${m.rsh - m.rch}px`).toBeLessThanOrEqual(m.rch + 1);
  expect(m.msh, `${label}: board-main 안 넘침 ${m.msh - m.mch}px`).toBeLessThanOrEqual(m.mch + 1);
}

/** 3개 해상도 전부 넘침 0. shots 에 { height: 파일명 } 을 주면 그 해상도에서 캡처 */
export async function forEachViewport(page: Page, label: string, shots: Record<number, string> = {}) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    await assertFits(page, `${label} @${vp.width}x${vp.height}`);
    if (shots[vp.height]) await page.screenshot({ path: `${SHOTS}/${shots[vp.height]}.png` });
  }
  await page.setViewportSize(VIEWPORTS[0]);
}

/**
 * 순차 공개 타이밍 기록 — **조작 전에 시작**해 attr 값이 바뀌는 시각을 모은다(반면교사 §2).
 * selector 의 attr(숫자)이 바뀔 때마다 { value, at } 을 쌓고, until 값에 닿거나 timeout 이면 끝.
 */
export function recordAttrTimeline(
  page: Page,
  selector: string,
  attr: string,
  until: (v: number) => boolean,
  timeoutMs: number,
): Promise<{ value: number; at: number }[]> {
  return page.evaluate(
    ({ selector, attr, timeoutMs, untilSrc }) =>
      new Promise<{ value: number; at: number }[]>((resolve) => {
        const until = new Function("v", `return (${untilSrc})(v)`) as (v: number) => boolean;
        const log: { value: number; at: number }[] = [];
        let last = Number.NaN;
        const start = performance.now();
        const tick = () => {
          const el = document.querySelector(selector);
          const v = el ? Number(el.getAttribute(attr)) : Number.NaN;
          if (!Number.isNaN(v) && v !== last) {
            last = v;
            log.push({ value: v, at: performance.now() });
            if (until(v)) {
              resolve(log);
              return;
            }
          }
          if (performance.now() - start > timeoutMs) {
            resolve(log);
            return;
          }
          setTimeout(tick, 40);
        };
        tick();
      }),
    { selector, attr, timeoutMs, untilSrc: until.toString() },
  );
}

/** 연속 공개 간격(ms) 목록 */
export function intervalsOf(log: { value: number; at: number }[], fromValue = 1): number[] {
  const steps = log.filter((l) => l.value >= fromValue);
  const out: number[] = [];
  for (let i = 1; i < steps.length; i += 1) out.push(steps[i].at - steps[i - 1].at);
  return out;
}

/** 공개 전 보드 요약에 들어가면 안 되는 키(반면교사 1-10) */
export const PRIVATE_KEY_RE = /is_mafia|"job"|"cash"|total_assets|holdings|"rounds":\[\{|"final":\[\{/;
