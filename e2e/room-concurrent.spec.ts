import { test, expect } from "@playwright/test";

// 핵심: 마피아 방과 디펜스 방이 동시에 활성일 때 서로 간섭하지 않는다.
// (마피아 켜둔 상태에서 디펜스를 만들고 번갈아 진행해도 상태가 섞이지 않음)
test("마피아 방 + 디펜스 방 동시 진행 — 상태 격리", async ({ request }) => {
  // 1) 마피아 방
  const mafiaRoom = (
    await (
      await request.post("/api/gm/rooms", { data: { game: "mafia" } })
    ).json()
  ).room.code;
  for (const n of ["m철수", "m영희", "m민수"]) {
    await request.post("/api/gm/players", {
      data: { room: mafiaRoom, nickname: n },
    });
  }

  // 2) 디펜스 방
  const defenseRoom = (
    await (
      await request.post("/api/gm/rooms", { data: { game: "defense" } })
    ).json()
  ).room.code;
  for (const n of ["d가람", "d나래"]) {
    await request.post("/api/gm/players", {
      data: { room: defenseRoom, nickname: n },
    });
  }

  // 3) 명단 격리: 각 방은 자기 참가자만 본다
  const mList = (
    await (await request.get(`/api/gm/players?room=${mafiaRoom}`)).json()
  ).players.map((p: { nickname: string }) => p.nickname);
  const dList = (
    await (await request.get(`/api/gm/players?room=${defenseRoom}`)).json()
  ).players.map((p: { nickname: string }) => p.nickname);
  expect(mList.sort()).toEqual(["m민수", "m영희", "m철수"].sort());
  expect(dList.sort()).toEqual(["d가람", "d나래"]);
  expect(mList).not.toContain("d가람");
  expect(dList).not.toContain("m철수");

  // 4) 번갈아 진행: 마피아 페이즈 전이 + 디펜스 라운드 진행
  expect(
    (
      await request.post("/api/gm/mafia/advance-phase", {
        data: { to: "auction", room: mafiaRoom },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post("/api/gm/defense/round", {
        data: { round: 1, room: defenseRoom },
      })
    ).ok(),
  ).toBeTruthy();

  // 5) 한 방의 진행이 다른 방 상태를 바꾸지 않는다
  const mafiaState = await (
    await request.get(`/api/mafia/state?all=1&room=${mafiaRoom}`)
  ).json();
  expect(JSON.stringify(mafiaState)).toContain("auction");

  // 디펜스 방에 마피아 페이즈가 섞여 들어오지 않음 (디펜스 상태는 정상 조회)
  const defenseState = await request.get(
    `/api/defense/state?room=${defenseRoom}`,
  );
  expect(defenseState.ok()).toBeTruthy();

  // 교차 로그인 차단: 마피아 방 코드로 디펜스 닉네임 입장 불가
  const cross = await request.post("/api/auth/login", {
    data: { room: mafiaRoom, nickname: "d가람" },
  });
  expect(cross.status()).toBe(403);
});
