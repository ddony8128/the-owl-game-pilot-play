import { test, expect } from "@playwright/test";

// 두 디펜스 방이 서로 다른 몬스터 비율로, 간섭 없이 운영되는지 검증.
test("디펜스 방별 몬스터 비율 조절 — 간섭 없음", async ({ request }) => {
  // 방 A: 스컬 스파이더(1)만 20마리, 나머지 0
  const a = (await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()).room.code;
  await request.post("/api/gm/players", { data: { room: a, nickname: "A1" } });
  const cfgA = { "1": 20, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
  expect((await request.post("/api/gm/defense/monster-config", { data: { room: a, counts: cfgA } })).ok()).toBeTruthy();

  // 방 B: 서브웨이맨(6) 4마리만, 나머지 0
  const b = (await (await request.post("/api/gm/rooms", { data: { game: "defense" } })).json()).room.code;
  await request.post("/api/gm/players", { data: { room: b, nickname: "B1" } });
  const cfgB = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 4 };
  expect((await request.post("/api/gm/defense/monster-config", { data: { room: b, counts: cfgB } })).ok()).toBeTruthy();

  // 설정이 방별로 분리되어 저장됐는지
  const readA = (await (await request.get(`/api/gm/defense/monster-config?room=${a}`)).json()).monsters;
  const readB = (await (await request.get(`/api/gm/defense/monster-config?room=${b}`)).json()).monsters;
  expect(readA.find((m: any) => m.id === 1).base_count).toBe(20);
  expect(readA.find((m: any) => m.id === 6).base_count).toBe(0);
  expect(readB.find((m: any) => m.id === 6).base_count).toBe(4);
  expect(readB.find((m: any) => m.id === 1).base_count).toBe(0);

  // 본게임 시작(라운드 진입) → 각 방이 자기 base_count 로 풀을 채움
  expect((await request.post("/api/gm/defense/round", { data: { round: 1, room: a } })).ok()).toBeTruthy();
  expect((await request.post("/api/gm/defense/round", { data: { round: 1, room: b } })).ok()).toBeTruthy();

  // 진입 후: 방 A 는 스파이더만, 방 B 는 서브웨이맨만 (대기열 4칸 채운 뒤 남은 풀)
  const afterA = (await (await request.get(`/api/gm/defense/monster-config?room=${a}`)).json()).monsters;
  const afterB = (await (await request.get(`/api/gm/defense/monster-config?room=${b}`)).json()).monsters;
  // 방 A: 스파이더 20 → 4칸 채우며 일부 소모(다른 종류는 0이라 스파이더만 뽑힘), 6번은 계속 0
  expect(afterA.find((m: any) => m.id === 6).count).toBe(0);
  expect(afterA.find((m: any) => m.id === 1).count).toBeLessThan(20);
  // 방 B: 서브웨이맨만, 1번은 계속 0
  expect(afterB.find((m: any) => m.id === 1).count).toBe(0);
  expect(afterB.find((m: any) => m.id === 6).count).toBeLessThanOrEqual(4);

  // 한 방의 설정이 다른 방을 건드리지 않음(교차 확인)
  expect(afterA.find((m: any) => m.id === 1).base_count).toBe(20);
  expect(afterB.find((m: any) => m.id === 6).base_count).toBe(4);
});
