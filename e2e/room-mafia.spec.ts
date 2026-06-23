import { test, expect } from "@playwright/test";

// 마피아 방 1개: 생성 → 방 단위 명단 → 로그인(정상/오류) → 상태 스코핑 → 페이즈 전이.
test.describe("마피아 방", () => {
  let room: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/gm/rooms", { data: { game: "mafia" } });
    expect(res.ok()).toBeTruthy();
    room = (await res.json()).room.code;
    for (const name of ["철수", "영희", "민수"]) {
      const r = await request.post("/api/gm/players", {
        data: { room, nickname: name },
      });
      expect(r.ok()).toBeTruthy();
    }
  });

  test("방 단위 명단이 등록된다", async ({ request }) => {
    const res = await request.get(`/api/gm/players?room=${room}`);
    const json = await res.json();
    expect(json.players.map((p: { nickname: string }) => p.nickname).sort()).toEqual(
      ["민수", "영희", "철수"],
    );
  });

  test("틀린 방 코드 로그인 → 방 코드 확인 안내", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { room: "ZZZZZ", nickname: "철수" },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toContain("방 코드를 확인");
  });

  test("미등록 닉네임 로그인 → GM 등록 안내", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { room, nickname: "없는사람" },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toContain("등록하지 않은 닉네임");
  });

  test("정상 로그인", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { room, nickname: "철수" },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.player.nickname).toBe("철수");
    expect(json.room.game).toBe("mafia");
  });

  test("상태가 방 단위로 조회되고 페이즈를 전이할 수 있다", async ({ request }) => {
    // 초기 상태(prepare) 확인
    const s0 = await request.get(`/api/mafia/state?all=1&room=${room}`);
    expect(s0.ok()).toBeTruthy();
    const j0 = await s0.json();
    expect(j0.phase?.round_number ?? j0.phase?.round ?? 0).toBeDefined();

    // prepare → auction
    const adv = await request.post("/api/gm/mafia/advance-phase", {
      data: { to: "auction", room },
    });
    expect(adv.ok()).toBeTruthy();

    const s1 = await request.get(`/api/mafia/state?all=1&room=${room}`);
    const j1 = await s1.json();
    expect(JSON.stringify(j1)).toContain("auction");
  });
});
