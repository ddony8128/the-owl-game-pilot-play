import { test, expect, type APIRequestContext } from "@playwright/test";

// 자유 입장(수산시장 방식, 또니 10-18): 준비 단계에서는 처음 보는 닉네임도 로그인하면 참가자로 등록되고,
// 시작 뒤에는 새 닉네임 409(기존 닉네임 재접속은 200). 디펜스는 튜토리얼 시작 때 입장 인원 기준으로 몬스터 구성 자동 세팅.
const created: string[] = [];
const login = (r: APIRequestContext, room: string, nickname: string) => r.post("/api/auth/login", { data: { room, nickname } });
async function room(r: APIRequestContext, game: "defense" | "mafia") {
  const code = (await (await r.post("/api/gm/rooms", { data: { game } })).json()).room.code as string;
  created.push(code);
  return code;
}
test.afterAll(async ({ request }) => {
  for (const code of created) await request.patch("/api/gm/rooms", { data: { code, status: "ended", ended_normally: true } });
});

test("[자유 입장·디펜스] 준비 단계 닉네임 입장 → 7명 기준 21마리 자동 세팅 → 시작 뒤 새 닉네임 409, 기존 재접속 200", async ({ request }) => {
  const code = await room(request, "defense");
  for (let i = 1; i <= 7; i += 1) {
    const res = await login(request, code, `입장${i}`);
    expect(res.ok(), `입장${i}`).toBeTruthy();
  }
  expect((await login(request, code, "입장1")).ok(), "같은 닉네임 재로그인은 같은 사람").toBeTruthy();
  const players = await (await request.get(`/api/gm/players?room=${code}`)).json();
  expect(players.players.length).toBe(7);
  expect((await request.post("/api/gm/defense/round", { data: { room: code, round: 1, from: 0 } })).ok()).toBeTruthy();
  const cfg = await (await request.get(`/api/gm/defense/monster-config?room=${code}`)).json();
  const total = (cfg.monsters ?? cfg.counts ?? []).reduce((a: number, m: { base_count: number }) => a + (m.base_count ?? 0), 0);
  expect(total, "7명 × 3").toBe(21);
  const late = await login(request, code, "늦은사람");
  expect(late.status()).toBe(409);
  expect((await late.json()).reason).toBe("game_started");
  expect((await login(request, code, "입장3")).ok()).toBeTruthy();
});

test("[자유 입장·마피아] 준비 단계 입장 OK → 경매 시작 뒤 새 닉네임 409", async ({ request }) => {
  const code = await room(request, "mafia");
  for (let i = 1; i <= 5; i += 1) expect((await login(request, code, `마${i}`)).ok()).toBeTruthy();
  expect((await request.post("/api/gm/mafia/advance-phase", { data: { room: code, to: "auction", from: "prepare" } })).ok()).toBeTruthy();
  const late = await login(request, code, "늦은마");
  expect(late.status()).toBe(409);
  expect((await login(request, code, "마2")).ok()).toBeTruthy();
});
