import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Iteration 5 WS-B — 참가자 폰 E2E 공용 헬퍼. 라이브 Supabase 를 쓰므로 만든 방은 끝에 endRoom 으로 종료 표시한다.

/** .env.local 의 SUPABASE_URL/SUPABASE_SERVICE_KEY 를 읽는다(셸 export 가 없을 때). 값은 출력하지 않는다. */
export function loadSupabaseEnv(): { url: string; key: string } {
  let url = process.env.SUPABASE_URL ?? "";
  let key = process.env.SUPABASE_SERVICE_KEY ?? "";
  if (!url || !key) {
    try {
      const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const v = m[2].replace(/^"(.*)"$/, "$1");
        if (m[1] === "SUPABASE_URL" && !url) url = v;
        if (m[1] === "SUPABASE_SERVICE_KEY" && !key) key = v;
      }
    } catch {
      // 없으면 아래에서 실패 메시지
    }
  }
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다(.env.local 또는 셸 export)");
  return { url, key };
}

export function supabaseAdmin(): SupabaseClient {
  const { url, key } = loadSupabaseEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function createRoom(request: APIRequestContext, game: "defense" | "mafia"): Promise<string> {
  const res = await request.post("/api/gm/rooms", { data: { game } });
  expect(res.ok(), `방 생성(${game})`).toBeTruthy();
  return (await res.json()).room.code as string;
}

export async function addPlayers(request: APIRequestContext, room: string, names: string[]): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const nickname of names) {
    const r = await request.post("/api/gm/players", { data: { room, nickname } });
    expect(r.ok(), `참가자 등록 ${nickname}`).toBeTruthy();
    ids[nickname] = (await r.json()).player.id as string;
  }
  return ids;
}

export async function endRoom(request: APIRequestContext, room: string): Promise<void> {
  await request.patch("/api/gm/rooms", { data: { code: room, status: "ended", ended_normally: true } });
}

/** 폰 로그인 상태를 localStorage 에 심는다(usePlayerAuth 가 읽는 키). */
export async function primePhone(page: Page, room: string, nickname: string, game: "defense" | "mafia"): Promise<void> {
  await page.addInitScript(
    ({ r, n, g }) => {
      localStorage.setItem("owlgame:room", r as string);
      localStorage.setItem("owlgame:nickname", n as string);
      localStorage.setItem("owlgame:roomGame", g as string);
      // 폴링을 빠르게(테스트용 오버라이드 — usePolling 이 읽는다)
      (window as unknown as { __OWL_POLL__?: number }).__OWL_POLL__ = 700;
    },
    { r: room, n: nickname, g: game },
  );
}

export async function defenseAdvance(request: APIRequestContext, room: string, to: number): Promise<void> {
  const r = await request.post("/api/gm/defense/round", { data: { room, round: to } });
  expect(r.ok(), `디펜스 round→${to}`).toBeTruthy();
}

export async function defenseConfigOnly(request: APIRequestContext, room: string, monsterId: number, count = 40): Promise<void> {
  const counts: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  counts[monsterId] = count;
  const r = await request.post("/api/gm/defense/monster-config", { data: { room, counts } });
  expect(r.ok(), "monster-config").toBeTruthy();
}

export type DefenseState = {
  round: number;
  roomStatus?: string;
  monsters: { instanceId: string; monsterId: number; currentHp: number; slotIndex: number }[];
  cards: { cardSlot: number; cardValue: number; isActive: boolean }[];
  score: number;
  action: { round: number; actionType: string; usedCardValue: number | null; trainingFrom: number | null; trainingTo: number | null } | null;
  logs: { round: number; log: string }[];
};

export async function defenseState(request: APIRequestContext, room: string, nick: string): Promise<DefenseState> {
  const res = await request.get(`/api/defense/state?room=${room}&nickname=${encodeURIComponent(nick)}`);
  expect(res.ok(), `state ${nick}`).toBeTruthy();
  return (await res.json()) as DefenseState;
}

export async function defenseAct(
  request: APIRequestContext,
  room: string,
  nick: string,
  body: Record<string, unknown>,
) {
  return request.post("/api/defense/action", { data: { room, nickname: nick, ...body } });
}

export async function mafiaAdvance(request: APIRequestContext, room: string, to: string): Promise<void> {
  const r = await request.post("/api/gm/mafia/advance-phase", { data: { room, to } });
  expect(r.ok(), `마피아 phase→${to}: ${r.status()} ${await r.text()}`).toBeTruthy();
}

export async function mafiaRound(request: APIRequestContext, room: string, round: number): Promise<void> {
  const r = await request.post("/api/gm/mafia/phase", { data: { room, round } });
  expect(r.ok(), `마피아 round→${round}: ${await r.text()}`).toBeTruthy();
}

export async function mafiaState(request: APIRequestContext, room: string, nick: string) {
  const res = await request.get(`/api/mafia/state?room=${room}&nickname=${encodeURIComponent(nick)}`);
  expect(res.ok(), `mafia state ${nick}: ${res.status()}`).toBeTruthy();
  return res.json();
}

export async function mafiaAct(request: APIRequestContext, room: string, nick: string, type: string, payload: Record<string, unknown>, request_id?: string) {
  return request.post("/api/mafia/action", { data: { room, nickname: nick, type, payload, ...(request_id ? { request_id } : {}) } });
}

export async function mafiaVote(request: APIRequestContext, room: string, nick: string, target_id: string, vote_count: number, request_id?: string) {
  return request.post("/api/mafia/vote", { data: { room, nickname: nick, target_id, vote_count, ...(request_id ? { request_id } : {}) } });
}

/** 가로 넘침(px). 0 이어야 한다(허용 오차 1). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * ITER6 A — GM 대시보드의 접힌 패널(<details>: 제출 현황·설정 및 수동 관리·룰 영상 제어 등)을 모두 편다.
 * 저쪽 UI 배치를 따라 기본으로 접어 두었으므로, 그 안을 조작하는 테스트는 먼저 이걸 부른다.
 */
export async function openPanels(page: Page): Promise<void> {
  await page.waitForSelector("details", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
}
