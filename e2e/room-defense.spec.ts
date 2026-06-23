import { test, expect } from "@playwright/test";

// 디펜스 방 1개: 생성 → 방 단위 명단 → 로그인 → 상태 스코핑 → 라운드 진행.
test.describe("디펜스 방", () => {
  let room: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/gm/rooms", {
      data: { game: "defense" },
    });
    expect(res.ok()).toBeTruthy();
    room = (await res.json()).room.code;
    for (const name of ["가람", "나래", "다온"]) {
      const r = await request.post("/api/gm/players", {
        data: { room, nickname: name },
      });
      expect(r.ok()).toBeTruthy();
    }
  });

  test("방 단위 명단이 등록된다", async ({ request }) => {
    const res = await request.get(`/api/gm/players?room=${room}`);
    const json = await res.json();
    expect(
      json.players.map((p: { nickname: string }) => p.nickname).sort(),
    ).toEqual(["가람", "나래", "다온"]);
  });

  test("정상 로그인 + 방 게임 확인", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { room, nickname: "가람" },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).room.game).toBe("defense");
  });

  test("상태가 방 단위로 조회되고 라운드를 진행할 수 있다", async ({ request }) => {
    const s0 = await request.get(`/api/defense/state?room=${room}`);
    expect(s0.ok()).toBeTruthy();

    // 0 → 1 (게임 초기화/시작)
    const adv = await request.post("/api/gm/defense/round", {
      data: { round: 1, room },
    });
    expect(adv.ok()).toBeTruthy();

    const score = await request.get(`/api/gm/defense/score?room=${room}`);
    expect(score.ok()).toBeTruthy();
  });
});
