import { test, expect, type APIRequestContext } from "@playwright/test";

// Iteration 5 WS-A — GM API 계약 검증(반면교사 1-1·1-2·1-7·1-8·1-11·1-17·1-18).
//  종료 방 409 · from 멱등/409 · 동시 전환 [200,409] · 되돌리기(성공/거부/남는 행 0) · 인원 차단 ·
//  수동 보정 · 공개 토글 · 타이머 조정 · 강퇴 FK 정리 · 입력 퍼징(500 = 0)
// 테스트 방은 끝에 ended 처리.

const created: string[] = [];

async function newRoom(request: APIRequestContext, game: "mafia" | "defense", names: string[]) {
  const res = await request.post("/api/gm/rooms", { data: { game } });
  expect(res.ok()).toBeTruthy();
  const code = (await res.json()).room.code as string;
  created.push(code);
  const ids: Record<string, string> = {};
  for (const nickname of names) {
    const r = await request.post("/api/gm/players", { data: { room: code, nickname } });
    expect(r.ok(), `등록 ${nickname}`).toBeTruthy();
    ids[nickname] = (await r.json()).player.id;
  }
  return { code, ids };
}

const endRoom = (request: APIRequestContext, code: string) =>
  request.patch("/api/gm/rooms", { data: { code, status: "ended", ended_normally: true } });

test.afterAll(async ({ request }) => {
  for (const code of created) await endRoom(request, code);
});

const defAdv = (request: APIRequestContext, room: string, round: number, from?: number) =>
  request.post("/api/gm/defense/round", { data: { room, round, ...(from !== undefined ? { from } : {}) } });
const mafAdv = (request: APIRequestContext, room: string, to: string, from?: string) =>
  request.post("/api/gm/mafia/advance-phase", { data: { room, to, ...(from ? { from } : {}) } });
const defState = async (request: APIRequestContext, room: string, nick: string) =>
  (await request.get(`/api/defense/state?${new URLSearchParams({ room, nickname: nick })}`)).json();
const mafState = async (request: APIRequestContext, room: string) =>
  (await request.get(`/api/mafia/state?all=1&room=${room}`)).json();

// ───────────────────────── 8. 종료된 방 409 ─────────────────────────
test("[8] 종료된 방: 라운드·페이즈·점수·몬스터 설정·타이머·로그·되돌리기·보정·등록·강퇴 → 409 room_ended", async ({
  request,
}) => {
  const d = await newRoom(request, "defense", ["e1", "e2"]);
  const m = await newRoom(request, "mafia", ["m1", "m2"]);
  await endRoom(request, d.code);
  await endRoom(request, m.code);

  const calls: [string, Promise<import("@playwright/test").APIResponse>][] = [
    ["defense/round", defAdv(request, d.code, 1, 0)],
    ["defense/score", request.post("/api/gm/defense/score", { data: { room: d.code, playerId: d.ids.e1, delta: 1 } })],
    ["defense/monster-config", request.post("/api/gm/defense/monster-config", { data: { room: d.code, counts: { "1": 3 } } })],
    ["timers/defense", request.post("/api/gm/timers/defense", { data: { room: d.code, action: "start" } })],
    ["defense/rewind", request.post("/api/gm/defense/rewind", { data: { room: d.code } })],
    ["mafia/advance-phase", mafAdv(request, m.code, "auction", "prepare")],
    ["mafia/phase", request.post("/api/gm/mafia/phase", { data: { room: m.code, round: 1 } })],
    ["mafia/rewind", request.post("/api/gm/mafia/rewind", { data: { room: m.code } })],
    ["mafia/adjust", request.post("/api/gm/mafia/adjust", { data: { room: m.code, playerId: m.ids.m1, kind: "cash", delta: 1 } })],
    ["timers/mafia", request.post("/api/gm/timers/mafia", { data: { room: m.code, action: "reset" } })],
    ["logs/add", request.post("/api/gm/logs/add", { data: { room: m.code, content: "x" } })],
    ["players POST", request.post("/api/gm/players", { data: { room: m.code, nickname: "late" } })],
    ["players DELETE", request.delete("/api/gm/players", { data: { id: m.ids.m2 } })],
  ];
  for (const [name, p] of calls) {
    const res = await p;
    expect(res.status(), name).toBe(409);
    expect((await res.json()).reason, name).toBe("room_ended");
  }
  // 종료 방에서도 공개 토글(표시 설정)은 가능
  const reveal = await request.patch("/api/gm/rooms", { data: { code: m.code, reveal_result: true } });
  expect(reveal.ok()).toBeTruthy();
  expect((await request.get(`/api/gm/rooms?code=${m.code}`).then((r) => r.json())).room.reveal_result).toBe(true);
});

// ───────────────────────── 1-2. from 멱등 / 409 ─────────────────────────
test("[1-2] 디펜스 from: 두 단계 앞선 서버에 옛 화면 값 → 200 멱등, 건너뛰기/되돌린 뒤 옛 탭 → 409", async ({
  request,
}) => {
  const { code } = await newRoom(request, "defense", ["f1", "f2", "f3", "f4", "f5", "f6"]);
  // 서버: 0→1→2 (다른 창)
  expect((await defAdv(request, code, 1, 0)).ok()).toBeTruthy();
  expect((await defAdv(request, code, 2, 1)).ok()).toBeTruthy();
  // 뒤처진 탭(from=0, target=1) → 200 멱등, 라운드 변화 없음
  const stale = await defAdv(request, code, 1, 0);
  expect(stale.status()).toBe(200);
  const j = await stale.json();
  expect(j.idempotent).toBe(true);
  expect(j.phase.round).toBe(2);
  // from 없는 재전송(옛 요청)도 멱등
  expect((await defAdv(request, code, 2)).status()).toBe(200);
  // 건너뛰기 → 409
  const skip = await defAdv(request, code, 5, 2);
  expect(skip.status()).toBe(409);
  expect((await skip.json()).reason).toBe("cannot_skip");
  // 되돌린 뒤(2→1) 옛 탭이 from=2 로 3을 요청 → 409 stale_from
  const rw = await request.post("/api/gm/defense/rewind", { data: { room: code, from: 2 } });
  expect(rw.ok(), await rw.text()).toBeTruthy();
  const old = await defAdv(request, code, 3, 2);
  expect(old.status()).toBe(409);
  expect((await old.json()).reason).toBe("stale_from");
  // 잘못된 from 형식은 무시(옛 요청 취급) — 500 아님
  expect((await request.post("/api/gm/defense/round", { data: { room: code, round: 2, from: "abc" } })).status()).toBe(200);
});

test("[1-2] 마피아 from: 이미 넘어간 페이즈 → 200 멱등, end 에서 전환 → 409, 라운드 변경 멱등", async ({ request }) => {
  const { code } = await newRoom(request, "mafia", ["p1", "p2", "p3", "p4", "p5"]);
  expect((await mafAdv(request, code, "auction", "prepare")).ok()).toBeTruthy();
  expect((await mafAdv(request, code, "trade", "auction")).ok()).toBeTruthy();
  const stale = await mafAdv(request, code, "auction", "prepare");
  expect(stale.status()).toBe(200);
  expect((await stale.json()).idempotent).toBe(true);
  expect((await mafState(request, code)).phase.phase).toBe("trade");
  // 건너뛰기
  const skip = await mafAdv(request, code, "vote", "trade");
  expect(skip.status()).toBe(409);
  // 모르는 페이즈 → 400
  expect((await mafAdv(request, code, "nope")).status()).toBe(400);
  // end 까지
  expect((await mafAdv(request, code, "apply", "trade")).ok()).toBeTruthy();
  expect((await mafAdv(request, code, "vote", "apply")).ok()).toBeTruthy();
  expect((await mafAdv(request, code, "end", "vote")).ok()).toBeTruthy();
  const atEnd = await mafAdv(request, code, "prepare", "end");
  expect(atEnd.status()).toBe(409);
  // 라운드 변경 + 같은 요청 재전송 멱등
  expect((await request.post("/api/gm/mafia/phase", { data: { room: code, round: 1, from: 0 } })).ok()).toBeTruthy();
  const again = await request.post("/api/gm/mafia/phase", { data: { room: code, round: 1, from: 0 } });
  expect(again.status()).toBe(200);
  expect((await again.json()).idempotent).toBe(true);
});

// ───────────────────────── 1-1. 동시 전환 ─────────────────────────
test("[1-1] 디펜스 같은 전환 5연발 동시 → 정확히 1건 진행, 정산 1회(스냅샷 1세트)", async ({ request }) => {
  const { code } = await newRoom(request, "defense", ["c1", "c2", "c3", "c4", "c5", "c6"]);
  await request.post("/api/gm/defense/monster-config", {
    data: { room: code, counts: { "1": 0, "2": 40, "3": 0, "4": 0, "5": 0, "6": 0 } },
  });
  for (let r = 1; r <= 4; r += 1) expect((await defAdv(request, code, r, r - 1)).ok()).toBeTruthy();
  // 4라운드(본게임 1): 전투 1건 넣고 5로 동시 5연발
  const st = await defState(request, code, "c1");
  const target = st.monsters[0];
  expect(
    (
      await request.post("/api/defense/action", {
        data: { room: code, nickname: "c1", action_type: "combat", target_monster_id: target.instanceId, used_card_slot: 1 },
      })
    ).ok(),
  ).toBeTruthy();
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => defAdv(request, code, 5, 4)));
  const statuses = results.map((r) => r.status()).sort();
  // 하나는 진행(200, idempotent 없음), 나머지는 200 멱등 또는 409 — 500 은 없다
  expect(statuses.every((s) => s === 200 || s === 409)).toBeTruthy();
  const bodies = await Promise.all(results.map((r) => r.json()));
  const executed = bodies.filter((b) => b.ok && !b.idempotent);
  expect(executed.length, "정산을 실행한 요청은 정확히 1건").toBe(1);
  // 몬스터 HP 가 두 번 깎이지 않았다: 피해 1 → HP 4
  const after = await defState(request, code, "c1");
  const same = after.monsters.find((m: { instanceId: string }) => m.instanceId === target.instanceId);
  expect(same.currentHp).toBe(target.currentHp - 1);
  expect(after.round).toBe(5);
});

// ───────────────────────── 3·1-7. 되돌리기 ─────────────────────────
test("[3] 디펜스 되돌리기: 정산 취소 — 몬스터 HP/소환/점수/카드/로그가 정산 직전으로, 제출이 있으면 409", async ({
  request,
}) => {
  const { code, ids } = await newRoom(request, "defense", ["r1", "r2"]);
  // 스컬 스파이더(HP1·2점·잔여 2)만 → 1라운드에 처치 가능, 도망도 빠르게
  await request.post("/api/gm/defense/monster-config", {
    data: { room: code, counts: { "1": 40, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 } },
  });
  for (let r = 1; r <= 4; r += 1) expect((await defAdv(request, code, r, r - 1)).ok()).toBeTruthy();
  const before = await defState(request, code, "r1");
  const target = before.monsters[0];
  // r1·r2 가 같은 스컬을 친다(1+2 ≥ 1 처치 → 2점/2명 = 1점씩)
  for (const [nick, slot] of [["r1", 1], ["r2", 2]] as const) {
    expect(
      (
        await request.post("/api/defense/action", {
          data: { room: code, nickname: nick, action_type: "combat", target_monster_id: target.instanceId, used_card_slot: slot },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect((await defAdv(request, code, 5, 4)).ok()).toBeTruthy();
  const settled = await defState(request, code, "r1");
  expect(settled.score).toBe(1);
  expect(settled.monsters.some((m: { instanceId: string }) => m.instanceId === target.instanceId)).toBe(false);
  // 되돌리기(5라운드 제출 0건)
  const rw = await request.post("/api/gm/defense/rewind", { data: { room: code, from: 5 } });
  expect(rw.ok(), await rw.text()).toBeTruthy();
  const rj = await rw.json();
  expect(rj.phase.round).toBe(4);
  const restored = await defState(request, code, "r1");
  expect(restored.round).toBe(4);
  expect(restored.score, "처치 점수 차감").toBe(0);
  const back = restored.monsters.find((m: { instanceId: string }) => m.instanceId === target.instanceId);
  expect(back, "처치된 몬스터가 다시 active").toBeTruthy();
  expect(back.currentHp).toBe(target.currentHp);
  expect(back.remainingTime).toBe(target.remainingTime);
  // 정산 때 소환된 몬스터는 회수되고 대기열은 4라운드 시작 때와 같은 구성
  expect(restored.monsters.map((m: { instanceId: string }) => m.instanceId).sort()).toEqual(
    before.monsters.map((m: { instanceId: string }) => m.instanceId).sort(),
  );
  // 전투에 쓴 카드는 그대로 비활성(제출 기록 유지), 전투 정산 로그는 삭제
  expect(restored.cards.find((c: { cardSlot: number }) => c.cardSlot === 1).isActive).toBe(false);
  expect(restored.logs.some((l: { log: string }) => /처치에 참여/.test(l.log))).toBe(false);
  // 4라운드 행동 기록은 남아 있어 대시보드 요약에 보인다
  const rs = await (await request.get(`/api/gm/defense/round-state?room=${code}&round=4`)).json();
  expect(rs.players.find((p: { player_id: string }) => p.player_id === ids.r1).action?.type).toBe("combat");
  // 스냅샷: 5라운드 몬스터 스냅샷 0, 4라운드 점수 스냅샷 0 (round-state 5 는 몬스터 없음)
  const rs5 = await (await request.get(`/api/gm/defense/round-state?room=${code}&round=5`)).json();
  expect(rs5.monsters).toHaveLength(0);
  expect(rs.players.every((p: { score: number | null }) => p.score == null)).toBe(true);
  // 다시 넘기면 같은 결과(멱등 구조): 점수 1, 라운드 5
  expect((await defAdv(request, code, 5, 4)).ok()).toBeTruthy();
  expect((await defState(request, code, "r1")).score).toBe(1);
  // 5라운드에 제출이 들어오면 되돌리기 거부
  const st5 = await defState(request, code, "r2");
  expect(
    (
      await request.post("/api/defense/action", {
        data: { room: code, nickname: "r2", action_type: "combat", target_monster_id: st5.monsters[0].instanceId, used_card_slot: 1 },
      })
    ).ok(),
  ).toBeTruthy();
  const refused = await request.post("/api/gm/defense/rewind", { data: { room: code, from: 5 } });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).reason).toBe("not_rewindable");
  // GM 로그에 되돌리기가 남았다
  const dash = await (await request.get(`/api/gm/defense/dashboard?room=${code}`)).json();
  expect(dash.gmLogs.some((l: { kind: string }) => l.kind === "rewind")).toBe(true);
});

test("[3] 디펜스 되돌리기: 도망 페널티 카드 복원 + 시작 전환(1→0, 4→3) 취소 + 준비 단계 409", async ({ request }) => {
  const { code } = await newRoom(request, "defense", ["w1"]);
  // 준비 단계 → 409
  const r0 = await request.post("/api/gm/defense/rewind", { data: { room: code } });
  expect(r0.status()).toBe(409);
  await request.post("/api/gm/defense/monster-config", {
    data: { room: code, counts: { "1": 40, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 } },
  });
  // 1→0 취소
  expect((await defAdv(request, code, 1, 0)).ok()).toBeTruthy();
  expect((await request.post("/api/gm/defense/rewind", { data: { room: code, from: 1 } })).ok()).toBeTruthy();
  const s0 = await defState(request, code, "w1");
  expect(s0.round).toBe(0);
  expect(s0.monsters).toHaveLength(0);
  expect(s0.cards).toHaveLength(0);
  const cfg0 = await (await request.get(`/api/gm/defense/monster-config?room=${code}`)).json();
  expect(cfg0.monsters.find((m: { id: number }) => m.id === 1).count, "풀이 기준값으로 복원").toBe(40);
  // 1·2라운드 방치 → 스컬(잔여 2) 도망 → 2→3 정산 때 페널티(카드 4 비활성)
  for (let r = 1; r <= 3; r += 1) expect((await defAdv(request, code, r, r - 1)).ok()).toBeTruthy();
  const s3 = await defState(request, code, "w1");
  expect(s3.cards.find((c: { cardSlot: number }) => c.cardSlot === 4).isActive, "도망 페널티 적용").toBe(false);
  // 3→2 되돌리기: 카드 4 재활성, 도망 몬스터 복원
  const rw = await request.post("/api/gm/defense/rewind", { data: { room: code, from: 3 } });
  expect(rw.ok(), await rw.text()).toBeTruthy();
  expect((await rw.json()).restored.cards).toBe(1);
  const s2 = await defState(request, code, "w1");
  expect(s2.round).toBe(2);
  expect(s2.cards.find((c: { cardSlot: number }) => c.cardSlot === 4).isActive).toBe(true);
  expect(s2.monsters.length).toBeGreaterThan(0);
  // 다시 3, 4 로 가서 4→3 취소
  expect((await defAdv(request, code, 3, 2)).ok()).toBeTruthy();
  expect((await defAdv(request, code, 4, 3)).ok()).toBeTruthy();
  expect((await request.post("/api/gm/defense/rewind", { data: { room: code, from: 4 } })).ok()).toBeTruthy();
  expect((await defState(request, code, "w1")).round).toBe(3);
  // 다시 시작하면 정상(첫 시도에 성공)
  expect((await defAdv(request, code, 4, 3)).ok()).toBeTruthy();
  expect((await defState(request, code, "w1")).monsters.length).toBeGreaterThan(0);
});

test("[3] 마피아 되돌리기: trade→auction(직업·낙찰액 복원, 입찰 유지) · vote→apply · apply/end 409 · 제출 있으면 409", async ({
  request,
}) => {
  const { code, ids } = await newRoom(request, "mafia", ["a1", "a2", "a3", "a4", "a5"]);
  // prepare 에서 되돌리기 → 409
  expect((await request.post("/api/gm/mafia/rewind", { data: { room: code } })).status()).toBe(409);
  expect((await mafAdv(request, code, "auction", "prepare")).ok()).toBeTruthy();
  // 입찰 1건 있으면 auction→prepare 거부
  expect(
    (
      await request.post("/api/mafia/action", {
        data: { room: code, nickname: "a1", type: "bet", payload: { job: "ceo", amount: 7 } },
      })
    ).ok(),
  ).toBeTruthy();
  const refused = await request.post("/api/gm/mafia/rewind", { data: { room: code, from: "auction" } });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error).toContain("입찰");
  // 경매 마감 → a1 CEO·현금 23
  expect((await mafAdv(request, code, "trade", "auction")).ok()).toBeTruthy();
  let st = await mafState(request, code);
  let a1 = st.players.find((p: { player_id: string }) => p.player_id === ids.a1);
  expect(a1.job).toBe("ceo");
  expect(a1.cash).toBe(23);
  // trade→auction 되돌리기(거래 0건)
  const rw = await request.post("/api/gm/mafia/rewind", { data: { room: code, from: "trade" } });
  expect(rw.ok(), await rw.text()).toBeTruthy();
  st = await mafState(request, code);
  expect(st.phase.phase).toBe("auction");
  a1 = st.players.find((p: { player_id: string }) => p.player_id === ids.a1);
  expect(a1.job, "직업 배정 취소").toBeNull();
  expect(a1.is_mafia).toBe(false);
  expect(a1.cash, "낙찰액 지불 취소").toBe(30);
  // 입찰 기록은 유지 → 다시 마감하면 같은 결과
  const me = await (await request.get(`/api/mafia/state?room=${code}&nickname=a1`)).json();
  expect(me.myAuctionBet?.job).toBe("ceo");
  expect((await mafAdv(request, code, "trade", "auction")).ok()).toBeTruthy();
  st = await mafState(request, code);
  a1 = st.players.find((p: { player_id: string }) => p.player_id === ids.a1);
  expect(a1.job).toBe("ceo");
  expect(a1.cash).toBe(23);
  // 거래 1건 있으면 trade→auction 거부
  expect(
    (
      await request.post("/api/mafia/action", {
        data: { room: code, nickname: "a2", type: "buy", payload: { stock_key: "부엉교육", amount: 1 } },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await request.post("/api/gm/mafia/rewind", { data: { room: code, from: "trade" } })).status()).toBe(409);
  // apply 에서는 409
  expect((await mafAdv(request, code, "apply", "trade")).ok()).toBeTruthy();
  const atApply = await request.post("/api/gm/mafia/rewind", { data: { room: code, from: "apply" } });
  expect(atApply.status()).toBe(409);
  expect((await atApply.json()).reason).toBe("not_rewindable");
  // vote→apply 는 가능(투표 0건)
  expect((await mafAdv(request, code, "vote", "apply")).ok()).toBeTruthy();
  expect((await request.post("/api/gm/mafia/rewind", { data: { room: code, from: "vote" } })).ok()).toBeTruthy();
  expect((await mafState(request, code)).phase.phase).toBe("apply");
  // 옛 화면(from=vote)으로 다시 되돌리기 → 409 stale_from
  const stale = await request.post("/api/gm/mafia/rewind", { data: { room: code, from: "vote" } });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).reason).toBe("stale_from");
  // end 에서는 409
  expect((await mafAdv(request, code, "vote", "apply")).ok()).toBeTruthy();
  expect((await mafAdv(request, code, "end", "vote")).ok()).toBeTruthy();
  expect((await request.post("/api/gm/mafia/rewind", { data: { room: code } })).status()).toBe(409);
  const dash = await (await request.get(`/api/gm/mafia/dashboard?room=${code}`)).json();
  expect(dash.gmLogs.filter((l: { kind: string }) => l.kind === "rewind").length).toBeGreaterThanOrEqual(2);
});

// ───────────────────────── 5. 인원 범위 ─────────────────────────
test("[5] 마피아 4명은 본게임 시작(0→1) 409 too_few_players, 5명은 통과 · 튜토리얼 진행은 인원 무관", async ({ request }) => {
  const { code } = await newRoom(request, "mafia", ["h1", "h2", "h3", "h4"]);
  for (const to of ["auction", "trade", "apply", "vote", "end"]) expect((await mafAdv(request, code, to)).ok(), to).toBeTruthy();
  const blocked = await request.post("/api/gm/mafia/phase", { data: { room: code, round: 1, from: 0 } });
  expect(blocked.status()).toBe(409);
  const bj = await blocked.json();
  expect(bj.reason).toBe("too_few_players");
  expect(bj.error).toContain("5명 이상");
  expect((await mafState(request, code)).phase.round_number).toBe(0);
  await request.post("/api/gm/players", { data: { room: code, nickname: "h5" } });
  const ok = await request.post("/api/gm/mafia/phase", { data: { room: code, round: 1, from: 0 } });
  expect(ok.ok(), await ok.text()).toBeTruthy();
  const dash = await (await request.get(`/api/gm/mafia/dashboard?room=${code}`)).json();
  expect(dash.gmLogs.some((l: { kind: string }) => l.kind === "headcount")).toBe(true);
});

// ───────────────────────── 4. 수동 보정 · 공개 토글 ─────────────────────────
test("[4] 마피아 현금·주식 ±1 보정 — 0주 미만 거부, 잘못된 종목 400, 자산 생성 전 409, GM 로그", async ({ request }) => {
  const { code, ids } = await newRoom(request, "mafia", ["b1", "b2", "b3", "b4", "b5"]);
  const adj = (data: Record<string, unknown>) => request.post("/api/gm/mafia/adjust", { data: { room: code, ...data } });
  // 자산 생성 전(prepare) → 409
  expect((await adj({ playerId: ids.b1, kind: "cash", delta: 1 })).status()).toBe(409);
  await mafAdv(request, code, "auction");
  expect((await adj({ playerId: ids.b1, kind: "cash", delta: 1 })).ok()).toBeTruthy();
  expect((await adj({ playerId: ids.b1, kind: "cash", delta: -1 })).ok()).toBeTruthy();
  expect((await adj({ playerId: ids.b1, kind: "cash", delta: -1 })).ok()).toBeTruthy();
  let st = await mafState(request, code);
  expect(st.players.find((p: { player_id: string }) => p.player_id === ids.b1).cash).toBe(29);
  // 주식 +1 → 1주, -1 → 0주, 다시 -1 → 400
  expect((await adj({ playerId: ids.b1, kind: "stock", stock_key: "국채", delta: 1 })).ok()).toBeTruthy();
  st = await mafState(request, code);
  expect(st.players.find((p: { player_id: string }) => p.player_id === ids.b1).stocks["국채"].amount).toBe(1);
  expect((await adj({ playerId: ids.b1, kind: "stock", stock_key: "국채", delta: -1 })).ok()).toBeTruthy();
  expect((await adj({ playerId: ids.b1, kind: "stock", stock_key: "국채", delta: -1 })).status()).toBe(400);
  // 입력 검증
  expect((await adj({ playerId: ids.b1, kind: "stock", stock_key: "없는종목", delta: 1 })).status()).toBe(400);
  expect((await adj({ playerId: ids.b1, kind: "cash", delta: 5 })).status()).toBe(400);
  expect((await adj({ playerId: ids.b1, kind: "gold", delta: 1 })).status()).toBe(400);
  expect((await adj({ playerId: "00000000-0000-0000-0000-000000000000", kind: "cash", delta: 1 })).status()).toBe(404);
  const dash = await (await request.get(`/api/gm/mafia/dashboard?room=${code}`)).json();
  const adjusts = dash.gmLogs.filter((l: { kind: string }) => l.kind === "adjust");
  expect(adjusts.length).toBe(5);
  expect(adjusts.some((l: { content: string }) => /현금 보정: b1 \+1원 \(30 → 31\)/.test(l.content))).toBe(true);
});

test("[4] 결과 공개 토글: PATCH reveal_result 가 저장·조회되고 GM 로그에 남는다 · 잘못된 값 400", async ({ request }) => {
  const { code } = await newRoom(request, "mafia", ["v1"]);
  const get = async () => (await request.get(`/api/gm/rooms?code=${code}`)).json();
  expect((await get()).room.reveal_result).toBe(false);
  const on = await request.patch("/api/gm/rooms", { data: { code, reveal_result: true } });
  expect(on.ok()).toBeTruthy();
  expect((await on.json()).room.reveal_result).toBe(true);
  expect((await get()).room.reveal_result).toBe(true);
  expect((await request.patch("/api/gm/rooms", { data: { code, reveal_result: false } })).ok()).toBeTruthy();
  expect((await get()).room.reveal_result).toBe(false);
  expect((await request.patch("/api/gm/rooms", { data: { code, reveal_result: "yes" } })).status()).toBe(400);
  expect((await request.patch("/api/gm/rooms", { data: { code, status: "paused" } })).status()).toBe(400);
  expect((await request.patch("/api/gm/rooms", { data: { code: "ZZZZZ", reveal_result: true } })).status()).toBe(404);
  const dash = await (await request.get(`/api/gm/mafia/dashboard?room=${code}`)).json();
  expect(dash.gmLogs.filter((l: { kind: string }) => l.kind === "reveal").length).toBe(2);
  expect(dash.room.reveal_result).toBe(false);
});

// 공개 토글이 보드 요약 API 응답을 바꾸는지 — board-summary 는 WS-C 가 reveal_result 를 보도록 바꾼다(계약).
// 머지 전 이 브랜치의 board-summary 는 아직 토글을 모르므로 fixme 로 두고, 머지 뒤 켠다.
test.fixme("[4·C] 5라운드 end + reveal_result=false 면 board-summary 가 결과를 숨기고, true 면 공개한다", async () => {});

// ───────────────────────── 6. 타이머 조정 ─────────────────────────
test("[6] 디펜스 타이머: 프리셋·분 입력·±30초·다음 라운드부터(리셋/라운드 전환 때 승격)·입력 검증", async ({ request }) => {
  const { code } = await newRoom(request, "defense", ["t1"]);
  const get = async () => (await request.get(`/api/gm/timers/defense?room=${code}`)).json();
  const set = (data: Record<string, unknown>) => request.post("/api/gm/timers/defense", { data: { room: code, action: "set", ...data } });
  expect((await get()).totalSeconds).toBe(300);
  expect((await set({ minutes: 8 })).ok()).toBeTruthy();
  expect((await get()).totalSeconds).toBe(480);
  expect((await set({ delta: -30 })).ok()).toBeTruthy();
  expect((await get()).totalSeconds).toBe(450);
  expect((await set({ delta: 30, applyTo: "now" })).ok()).toBeTruthy();
  expect((await get()).totalSeconds).toBe(480);
  // 다음 라운드부터 3분 → 지금은 480 유지, 예약 180
  expect((await set({ minutes: 3, applyTo: "next" })).ok()).toBeTruthy();
  let g = await get();
  expect(g.totalSeconds).toBe(480);
  expect(g.pendingTotalSeconds).toBe(180);
  // 예약에 +30초 → 210
  expect((await set({ delta: 30, applyTo: "next" })).ok()).toBeTruthy();
  expect((await get()).pendingTotalSeconds).toBe(210);
  // 라운드 전환이 예약을 적용한다
  expect((await defAdv(request, code, 1, 0)).ok()).toBeTruthy();
  g = await get();
  expect(g.totalSeconds).toBe(210);
  expect(g.pendingTotalSeconds).toBeNull();
  // 리셋도 예약을 적용
  expect((await set({ minutes: 10, applyTo: "next" })).ok()).toBeTruthy();
  expect((await request.post("/api/gm/timers/defense", { data: { room: code, action: "reset" } })).ok()).toBeTruthy();
  expect((await get()).totalSeconds).toBe(600);
  // 실행 중 시간 조정 → 남은 시간이 즉시 바뀐다(timerStartAt 유지)
  expect((await request.post("/api/gm/timers/defense", { data: { room: code, action: "start" } })).ok()).toBeTruthy();
  const started = await get();
  expect((await set({ minutes: 1 })).ok()).toBeTruthy();
  const adjusted = await get();
  expect(adjusted.totalSeconds).toBe(60);
  expect(adjusted.timerStartAt).toBe(started.timerStartAt);
  // 검증(1-17): 범위·형식 → 400, 500 없음
  for (const bad of [{ minutes: 0 }, { minutes: 31 }, { minutes: 2.5 }, { minutes: "5" }, { delta: 15 }, { seconds: 100 }, { minutes: 5, delta: 30 }, {}, { minutes: 5, applyTo: "later" }]) {
    const r = await set(bad);
    expect(r.status(), JSON.stringify(bad)).toBe(400);
  }
  expect((await set({ delta: -60 })).status(), "60초에서 -60 → 30초 미만").toBe(400);
  expect((await request.post("/api/gm/timers/defense", { data: { room: code, action: "explode" } })).status()).toBe(400);
  const dash = await (await request.get(`/api/gm/defense/dashboard?room=${code}`)).json();
  expect(dash.gmLogs.filter((l: { kind: string }) => l.kind === "timer").length).toBeGreaterThanOrEqual(5);
});

test("[6] 마피아 타이머: 페이즈별 조정(경매·거래·투표), 없는 단계 400, 페이즈 전환 리셋이 예약을 승격", async ({ request }) => {
  const { code } = await newRoom(request, "mafia", ["u1", "u2", "u3", "u4", "u5"]);
  const get = async () => (await request.get(`/api/gm/timers/mafia?room=${code}`)).json();
  const set = (data: Record<string, unknown>) => request.post("/api/gm/timers/mafia", { data: { room: code, action: "set", ...data } });
  let g = await get();
  expect(g.durations.auction.totalSeconds).toBe(180);
  expect(g.durations.trade.totalSeconds).toBe(600);
  expect(g.durations.vote.totalSeconds).toBe(300);
  // prepare 에서 현재 단계로 조정 → 400(타이머 없는 단계), phase 지정은 OK
  expect((await set({ minutes: 5 })).status()).toBe(400);
  expect((await set({ minutes: 5, phase: "trade" })).ok()).toBeTruthy();
  expect((await set({ minutes: 4, phase: "auction", applyTo: "next" })).ok()).toBeTruthy();
  expect((await set({ minutes: 5, phase: "apply" })).status()).toBe(400);
  g = await get();
  expect(g.durations.trade.totalSeconds).toBe(300);
  expect(g.durations.auction.totalSeconds).toBe(180);
  expect(g.durations.auction.pendingTotalSeconds).toBe(240);
  // prepare→auction 전환이 타이머를 리셋하며 예약을 적용
  expect((await mafAdv(request, code, "auction", "prepare")).ok()).toBeTruthy();
  g = await get();
  expect(g.phase).toBe("auction");
  expect(g.totalSeconds).toBe(240);
  expect(g.pendingTotalSeconds).toBeNull();
  // 현재 단계(auction) ±30
  expect((await set({ delta: 30 })).ok()).toBeTruthy();
  expect((await get()).totalSeconds).toBe(270);
});

// ───────────────────────── 1-11. 강퇴 경로 ─────────────────────────
test("[1-11] 경매에 입찰한 참가자를 강퇴 → 200(FK 정리), 명단·미제출 수·자산에서 빠지고 재전송은 멱등", async ({ request }) => {
  const { code, ids } = await newRoom(request, "mafia", ["k1", "k2", "k3", "k4", "k5"]);
  await mafAdv(request, code, "auction");
  expect(
    (await request.post("/api/mafia/action", { data: { room: code, nickname: "k1", type: "bet", payload: { job: "ceo", amount: 3 } } })).ok(),
  ).toBeTruthy();
  let pend = await (await request.get(`/api/gm/mafia/pending?room=${code}`)).json();
  expect(pend.total).toBe(5);
  expect(pend.pending.length).toBe(4);
  const del = await request.delete("/api/gm/players", { data: { id: ids.k1 } });
  expect(del.status(), await del.text()).toBe(200);
  pend = await (await request.get(`/api/gm/mafia/pending?room=${code}`)).json();
  expect(pend.total).toBe(4);
  expect(pend.pending.length).toBe(4);
  const st = await mafState(request, code);
  expect(st.players.some((p: { player_id: string }) => p.player_id === ids.k1)).toBe(false);
  // 재전송 멱등
  expect((await request.delete("/api/gm/players", { data: { id: ids.k1 } })).status()).toBe(200);
  // 경매 마감도 정상(남은 4명 월급쟁이)
  expect((await mafAdv(request, code, "trade", "auction")).ok()).toBeTruthy();
  // 같은 닉네임 재등록은 새 참가자
  const re = await request.post("/api/gm/players", { data: { room: code, nickname: "k1" } });
  expect(re.ok()).toBeTruthy();
  expect((await re.json()).player.id).not.toBe(ids.k1);
  // 잘못된 id 형식 → 400
  expect((await request.delete("/api/gm/players", { data: { id: "not-a-uuid" } })).status()).toBe(400);
});

test("[1-11] 디펜스: 행동을 제출한 참가자를 라운드 중 강퇴 → 미제출 수에서 빠지고 정산·점수 조회가 정상", async ({ request }) => {
  const { code, ids } = await newRoom(request, "defense", ["x1", "x2", "x3"]);
  for (let r = 1; r <= 4; r += 1) expect((await defAdv(request, code, r, r - 1)).ok()).toBeTruthy();
  const st = await defState(request, code, "x1");
  expect(
    (
      await request.post("/api/defense/action", {
        data: { room: code, nickname: "x1", action_type: "combat", target_monster_id: st.monsters[0].instanceId, used_card_slot: 4 },
      })
    ).ok(),
  ).toBeTruthy();
  let pend = await (await request.get(`/api/gm/defense/pending?room=${code}`)).json();
  expect(pend.pending.map((p: { nickname: string }) => p.nickname).sort()).toEqual(["x2", "x3"]);
  expect((await request.delete("/api/gm/players", { data: { id: ids.x1 } })).status()).toBe(200);
  pend = await (await request.get(`/api/gm/defense/pending?room=${code}`)).json();
  expect(pend.total).toBe(2);
  expect((await defAdv(request, code, 5, 4)).ok()).toBeTruthy();
  const scores = await (await request.get(`/api/gm/defense/score?room=${code}`)).json();
  expect(scores.scores.some((s: { player_id: string }) => s.player_id === ids.x1)).toBe(false);
});

// ───────────────────────── 1-17. 입력 퍼징 ─────────────────────────
test("[1-17] GM 쓰기 API 입력 퍼징 — 깨진 JSON·형식 오류·범위 밖 값에 500 이 없다", async ({ request }) => {
  const { code, ids } = await newRoom(request, "defense", ["z1"]);
  const m = await newRoom(request, "mafia", ["y1", "y2", "y3", "y4", "y5"]);
  const garbage: unknown[] = [null, "x", 1, [], { room: 123 }, { room: code }, { room: code, round: "1" }, { room: code, round: 99 }, { room: code, round: -1 }, { room: code, round: 1.5 }];
  const targets: [string, string][] = [
    ["POST", "/api/gm/defense/round"],
    ["POST", "/api/gm/defense/rewind"],
    ["POST", "/api/gm/defense/score"],
    ["POST", "/api/gm/defense/monster-config"],
    ["POST", "/api/gm/timers/defense"],
    ["POST", "/api/gm/mafia/advance-phase"],
    ["POST", "/api/gm/mafia/phase"],
    ["POST", "/api/gm/mafia/rewind"],
    ["POST", "/api/gm/mafia/adjust"],
    ["POST", "/api/gm/timers/mafia"],
    ["POST", "/api/gm/logs/add"],
    ["POST", "/api/gm/players"],
    ["DELETE", "/api/gm/players"],
    ["PATCH", "/api/gm/rooms"],
    ["POST", "/api/gm/rooms"],
  ];
  for (const [method, url] of targets) {
    for (const body of garbage) {
      const res = await request.fetch(url, { method, data: body });
      expect(res.status(), `${method} ${url} ${JSON.stringify(body)}`).toBeLessThan(500);
    }
    // 깨진 JSON 본문
    const broken = await request.fetch(url, { method, headers: { "Content-Type": "application/json" }, data: "{not json" });
    expect(broken.status(), `${method} ${url} broken json`).toBeLessThan(500);
  }
  // 의미 검사: 200 이면 저장값 = 요청값
  expect((await request.post("/api/gm/defense/score", { data: { room: code, playerId: ids.z1, delta: 1 } })).ok()).toBeTruthy();
  const sc = await (await request.get(`/api/gm/defense/score?room=${code}`)).json();
  expect(sc.scores.find((s: { player_id: string }) => s.player_id === ids.z1).points).toBe(1);
  // 다른 방 참가자 id 로 점수 생성 불가(404)
  expect((await request.post("/api/gm/defense/score", { data: { room: code, playerId: m.ids.y1, delta: 1 } })).status()).toBe(404);
  // 제로폭 문자가 섞인 닉네임은 같은 사람으로 정규화된다
  const zw = await request.post("/api/gm/players", { data: { room: code, nickname: "z​1" } });
  expect(zw.ok()).toBeTruthy();
  expect((await zw.json()).created).toBe(false);
});
