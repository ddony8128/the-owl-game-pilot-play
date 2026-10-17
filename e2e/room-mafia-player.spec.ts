import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  addPlayers,
  createRoom,
  endRoom,
  mafiaAct,
  mafiaAdvance,
  mafiaState,
  mafiaVote,
  supabaseAdmin,
} from "./helpers/phone";

// Iteration 5 WS-B 4·6·7 — 마피아 참가자 API 를 한 라운드 끝까지 돌리며
//  정보 은닉(남의 직업·남의 표·강도 대상 없음) · 동시 20건 lost update 없음 · requestId 멱등 · 로그 탭 내용 ·
//  결과 공개 게이트(5라운드 end + reveal_result) · 종료된 방 409 · 입력 퍼징(500 없음)을 확인한다.
test.describe.configure({ mode: "serial" });

const NAMES = ["A강도", "B경찰", "C시장", "D포기", "E월급"] as const;
type Name = (typeof NAMES)[number];
let room: string;
let ids: Record<string, string>;

function playerJson(s: unknown) {
  return s as {
    phase: { round_number: number; phase: string } | null;
    roomStatus: string;
    playerState: { job: string | null; cash: number; is_mafia: boolean; stocks: Record<string, { amount: number }> } | null;
    players: Record<string, unknown>[];
    abilityResults: { player_id: string; job: string | null; category: string | null; message: string }[];
    myVoteSummary: { target: string; vote_count: number; total_spent: number }[] | null;
    myLog: { round: number; entries: { kind: string; text: string }[] }[];
    hasUsedAbilityThisPhase: boolean;
    myAbilityActionThisPhase: unknown;
    myTradesThisRound: Record<string, { bought: boolean; sold: boolean }> | null;
  };
}

async function state(request: APIRequestContext, nick: Name) {
  return playerJson(await mafiaState(request, room, nick));
}

/** 다른 사람의 비공개 정보가 없는지 — 전 페이즈 공통 단언 */
function assertHidden(nick: Name, s: ReturnType<typeof playerJson>) {
  // players 는 id·닉네임만(job/is_mafia/cash 없음)
  for (const p of s.players) {
    expect(Object.keys(p).sort(), `${nick} players 키`).toEqual(["created_at", "id", "nickname"].sort());
  }
  // 능력결과는 전부 내 것
  for (const r of s.abilityResults) expect(r.player_id, `${nick} abilityResults 소유`).toBe(ids[nick]);
  // 투표 요약은 내가 던진 것만(남의 표 집계 없음) — target 은 내가 고른 닉네임
  for (const v of s.myVoteSummary ?? []) expect(typeof v.target).toBe("string");
  // 로그는 내 것만: 남의 낙찰·남의 능력 사용 문구가 없다
  const logText = JSON.stringify(s.myLog);
  // 경매·거래 항목은 내 것만이므로 남의 닉네임이 나올 수 없다(능력 대상·투표 대상·경제사범 공지는 내가 알 수 있는 정보).
  for (const round of s.myLog) {
    for (const e of round.entries) {
      if (e.kind === "auction" || e.text.startsWith("거래:")) {
        for (const other of NAMES.filter((n) => n !== nick)) {
          expect(e.text, `${nick} 로그 '${e.text}' 에 ${other} 없음`).not.toContain(other);
        }
      }
    }
  }
  // 직업 문자열 누출: 강도가 아닌 사람의 응답에 '강도 능력 사용'·'낙찰(강도' 가 없어야 한다
  if (nick !== "A강도") {
    expect(logText).not.toContain("능력 사용: 강도");
    expect(logText).not.toContain("낙찰(강도");
    const ownJobs = JSON.stringify(s.playerState?.job ?? null);
    expect(ownJobs).not.toContain("robber");
  }
}

test.beforeAll(async ({ request }) => {
  room = await createRoom(request, "mafia");
  ids = await addPlayers(request, room, [...NAMES]);
});

test.afterAll(async ({ request }) => {
  if (room) await endRoom(request, room);
});

test("경매: 베팅·멱등 재전송·중복 베팅 거부·prepare 에서는 400", async ({ request }) => {
  // prepare 에서는 베팅 불가(500 아님)
  const early = await mafiaAct(request, room, "A강도", "bet", { job: "robber", amount: 6 });
  expect(early.status()).toBe(400);
  await mafiaAdvance(request, room, "auction");

  const rid = "bet-A-0001";
  const b1 = await mafiaAct(request, room, "A강도", "bet", { job: "robber", amount: 6 }, rid);
  expect(b1.status(), await b1.text()).toBe(200);
  // 같은 request_id 재전송 → 멱등 200, 두 번 기록되지 않음
  const b1again = await mafiaAct(request, room, "A강도", "bet", { job: "robber", amount: 6 }, rid);
  expect(b1again.status()).toBe(200);
  expect((await b1again.json()).idempotent).toBe(true);
  // 다른 베팅은 1회 제한 400
  const b1other = await mafiaAct(request, room, "A강도", "bet", { job: "police", amount: 1 });
  expect(b1other.status()).toBe(400);

  expect((await mafiaAct(request, room, "B경찰", "bet", { job: "police", amount: 3 })).status()).toBe(200);
  expect((await mafiaAct(request, room, "C시장", "bet", { job: "mayor", amount: 2 })).status()).toBe(200);
  expect((await mafiaAct(request, room, "D포기", "bet", { job: null, give_up: true })).status()).toBe(200);
  expect((await mafiaAct(request, room, "E월급", "bet", { job: "robber", amount: 5 })).status()).toBe(200);
  // 보유 현금 초과 베팅은 400
  const over = await mafiaAct(request, room, "E월급", "bet", { job: "ceo", amount: 999 });
  expect(over.status()).toBe(400);

  // 경매 중 상태: 내 베팅만 보이고 남의 직업은 없다
  const sB = await state(request, "B경찰");
  assertHidden("B경찰", sB);
  const sD = await state(request, "D포기");
  assertHidden("D포기", sD);
  expect(JSON.stringify(sD.myLog)).toContain("경매: 베팅을 포기했습니다.");
});

test("거래: 동시 매수 20건 lost update 없음 · requestId 멱등 · 매수+매도 금지 · 능력 사용", async ({ request }) => {
  await mafiaAdvance(request, room, "trade");
  // 직업 확인(내 것만)
  const sA = await state(request, "A강도");
  expect(sA.playerState?.job).toBe("robber");
  expect(sA.playerState?.cash).toBe(24); // 30 - 6
  const sE = await state(request, "E월급");
  expect(sE.playerState?.job).toBe("salaryman"); // 5 < 6 로 낙찰 실패
  expect(sE.playerState?.cash).toBe(30); // 낙찰자만 지불

  // D: 현금 30 으로 1주(5원) 매수 20건 동시 → 정확히 6건, 현금 0, 6주 (반면교사 1-9)
  const results = await Promise.all(
    Array.from({ length: 20 }, () => mafiaAct(request, room, "D포기", "buy", { stock_key: "부엉교육", amount: 1 })),
  );
  const okCount = results.filter((r) => r.status() === 200).length;
  const insufficient = results.filter((r) => r.status() === 400).length;
  const busy = results.filter((r) => r.status() === 409).length;
  // 불변식: 성공 건수만큼만 차감(lost update 없음), 현금은 음수가 되지 않고, 몰림(409 busy)은 "거부"로 명확히 끝난다
  expect(okCount + insufficient + busy, "200/400/409 외 상태 없음").toBe(20);
  expect(okCount, "현금 30 으로 5원짜리는 최대 6건").toBeLessThanOrEqual(6);
  expect(okCount, "대부분은 성공해야 한다").toBeGreaterThanOrEqual(5);
  const sD = await state(request, "D포기");
  expect(sD.playerState?.cash).toBe(30 - 5 * okCount);
  expect(sD.playerState?.stocks["부엉교육"].amount).toBe(okCount);
  if (okCount === 6) expect(insufficient).toBe(14 - busy);

  // E: 같은 request_id 로 매수 2주 두 번 → 한 번만 반영
  const rid = "buy-E-0001";
  const e1 = await mafiaAct(request, room, "E월급", "buy", { stock_key: "번쩍전기", amount: 2 }, rid);
  expect(e1.status()).toBe(200);
  const e2 = await mafiaAct(request, room, "E월급", "buy", { stock_key: "번쩍전기", amount: 2 }, rid);
  expect(e2.status()).toBe(200);
  expect((await e2.json()).idempotent).toBe(true);
  let sE2 = await state(request, "E월급");
  expect(sE2.playerState?.cash).toBe(20);
  expect(sE2.playerState?.stocks["번쩍전기"].amount).toBe(2);
  // 같은 종목 매도는 400(매수+매도 금지), 보유 없는 종목 매도도 400
  expect((await mafiaAct(request, room, "E월급", "sell", { stock_key: "번쩍전기", amount: 1 })).status()).toBe(400);
  expect((await mafiaAct(request, room, "E월급", "sell", { stock_key: "이상교통", amount: 1 })).status()).toBe(400);
  // 없는 종목·소수 수량·음수 → 400 (500 아님)
  expect((await mafiaAct(request, room, "E월급", "buy", { stock_key: "없는종목", amount: 1 })).status()).toBe(400);
  expect((await mafiaAct(request, room, "E월급", "buy", { stock_key: "국채", amount: 1.5 })).status()).toBe(400);
  expect((await mafiaAct(request, room, "E월급", "buy", { stock_key: "국채", amount: -1 })).status()).toBe(400);
  sE2 = await state(request, "E월급");
  expect(sE2.myTradesThisRound?.["번쩍전기"]).toEqual({ bought: true, sold: false });

  // 능력: 강도 → D·E, 경찰 → A·C, 시장 → 표 2원. 두 번째 능력은 400.
  expect((await mafiaAct(request, room, "A강도", "ability", { job: "robber", targets: ["D포기", "E월급"] })).status()).toBe(200);
  expect((await mafiaAct(request, room, "A강도", "ability", { job: "robber", targets: ["B경찰", "C시장"] })).status()).toBe(400);
  expect((await mafiaAct(request, room, "B경찰", "ability", { job: "police", targets: ["A강도", "C시장"] })).status()).toBe(200);
  expect((await mafiaAct(request, room, "C시장", "ability", { job: "mayor", ticket_price: 2 })).status()).toBe(200);

  // 은닉: 강도의 대상(D·E)은 D·E 의 응답 어디에도 '강도 대상'으로 드러나지 않는다
  for (const n of ["B경찰", "C시장", "D포기", "E월급"] as const) {
    const s = await state(request, n);
    assertHidden(n, s);
    expect(s.hasUsedAbilityThisPhase).toBe(n === "B경찰" || n === "C시장");
    // 내 직업·내 베팅(myAuctionBet 은 내가 건 직업이라 보여도 된다)을 뺀 나머지에 강도 직업이 없어야 한다
    const rest = { ...s, myAuctionBet: null, myLog: null };
    expect(JSON.stringify(rest)).not.toContain('"job":"robber"');
    expect(s.playerState?.job).not.toBe("robber");
  }
});

test("주가 변동 → 투표: 동시 투표 20건 · requestId · 자기 투표 금지 · 은닉", async ({ request }) => {
  await mafiaAdvance(request, room, "apply");
  // 정산 뒤 내 능력결과만 보인다
  const sB = await state(request, "B경찰");
  assertHidden("B경찰", sB);
  expect(sB.abilityResults.some((r) => r.category === "police_check" && /마피아가 있습니다/.test(r.message))).toBe(true);
  const sD = await state(request, "D포기");
  assertHidden("D포기", sD);
  expect(sD.abilityResults.every((r) => r.category !== "robber_gain")).toBe(true);

  // 투표 전에는 400
  expect((await mafiaVote(request, room, "B경찰", ids["A강도"], 1)).status()).toBe(400);
  await mafiaAdvance(request, room, "vote");

  // 표 가격 2원(시장). E: 현금 20+3=23 → 1표(2원) 20건 동시 → 11건 성공, 현금 1
  const votes = await Promise.all(Array.from({ length: 20 }, () => mafiaVote(request, room, "E월급", ids["A강도"], 1)));
  const vOk = votes.filter((r) => r.status() === 200).length;
  const vNo = votes.filter((r) => r.status() === 400).length;
  const vBusy = votes.filter((r) => r.status() === 409).length;
  expect(vOk + vNo + vBusy, "200/400/409 외 상태 없음").toBe(20);
  expect(vOk, "현금 23·표 2원 → 최대 11표").toBeLessThanOrEqual(11);
  expect(vOk).toBeGreaterThanOrEqual(9);
  const sE = await state(request, "E월급");
  expect(sE.playerState?.cash, "성공한 표만큼만 차감(lost update 없음)").toBe(23 - 2 * vOk);
  expect(sE.myVoteSummary).toEqual([{ target: "A강도", vote_count: vOk, total_spent: 2 * vOk }]);

  // C: requestId 재전송 → 1표만
  const rid = "vote-C-0001";
  expect((await mafiaVote(request, room, "C시장", ids["A강도"], 1, rid)).status()).toBe(200);
  const again = await mafiaVote(request, room, "C시장", ids["A강도"], 1, rid);
  expect(again.status()).toBe(200);
  expect((await again.json()).idempotent).toBe(true);
  const sC = await state(request, "C시장");
  expect(sC.myVoteSummary).toEqual([{ target: "A강도", vote_count: 1, total_spent: 2 }]);

  // B: 3표(6원)
  expect((await mafiaVote(request, room, "B경찰", ids["A강도"], 3)).status()).toBe(200);
  // 잘못된 대상·형식·자기 자신 → 400 (500 아님)
  expect((await mafiaVote(request, room, "B경찰", "not-a-uuid", 1)).status()).toBe(400);
  expect((await mafiaVote(request, room, "B경찰", ids["B경찰"], 1)).status()).toBe(400);
  expect((await request.post("/api/mafia/vote", { data: { room, nickname: "B경찰", target_id: ids["A강도"], vote_count: "2" } })).status()).toBe(400);
  expect((await request.post("/api/mafia/vote", { data: { room, nickname: "B경찰", target_id: ids["A강도"], vote_count: 0 } })).status()).toBe(400);

  // 은닉: D 의 응답에는 남의 표(E 11표·B 3표)가 없다
  const sD2 = await state(request, "D포기");
  assertHidden("D포기", sD2);
  expect(sD2.myVoteSummary).toEqual([]);
  expect(JSON.stringify(sD2)).not.toContain(`${vOk}표`);
});

test("라운드 종료: 로그 탭에 경매·거래·정산·투표가 라운드별로 쌓이고 남의 정보는 없다", async ({ request }) => {
  await mafiaAdvance(request, room, "end");
  const sB = await state(request, "B경찰");
  assertHidden("B경찰", sB);
  const r0 = sB.myLog.find((r) => r.round === 0);
  expect(r0, "튜토리얼(0) 라운드 로그").toBeTruthy();
  const texts = r0!.entries.map((e) => e.text);
  expect(texts).toContain("경매: 경찰에 3원 베팅 → 낙찰(경찰, 3원 지불)");
  expect(texts).toContain("능력 사용: 경찰 — 대상: A강도, C시장");
  expect(texts.some((t) => t.startsWith("정산: 이번 라운드 월급으로 5원"))).toBe(true);
  expect(texts.some((t) => t.startsWith("정산: 경찰 조사 결과"))).toBe(true);
  expect(texts).toContain("투표: A강도에게 3표 (6원 사용)");
  expect(texts.some((t) => t.startsWith("라운드 종료: 경제사범으로 지목되었던 A강도은(는) 마피아였습니다"))).toBe(true);
  // 경찰은 마피아가 잡힌 라운드에 국채 2주
  expect(sB.playerState?.stocks["국채"].amount).toBe(2);

  // D(월급쟁이): 거래 로그에 가격·총액, 포기 → 월급쟁이
  const sD = await state(request, "D포기");
  const dTexts = sD.myLog.find((r) => r.round === 0)!.entries.map((e) => e.text);
  expect(dTexts.filter((t) => t === "거래: 부엉교육 1주 매수 (주당 5원, 총 5원)").length).toBe(6);
  expect(dTexts).toContain("경매: 베팅을 포기했습니다. → 낙찰 실패, 이번 라운드 직업: 월급쟁이");
  expect(dTexts.some((t) => t.includes("강도로 총"))).toBe(false);

  // A(강도): 자기 능력 결과는 보인다
  const sA = await state(request, "A강도");
  const aTexts = sA.myLog.find((r) => r.round === 0)!.entries.map((e) => e.text);
  expect(aTexts).toContain("경매: 강도에 6원 베팅 → 낙찰(강도, 6원 지불)");
  expect(aTexts).toContain("능력 사용: 강도 — 대상: D포기, E월급");
  expect(aTexts.some((t) => t.includes("벌금"))).toBe(true);
});

test("결과 공개 게이트: 5라운드 end 이고 reveal_result=true 일 때만 결과", async ({ request }) => {
  // 아직 0라운드 end → 비공개
  let res = await request.get(`/api/mafia/result?room=${room}`);
  expect(res.status()).toBe(200);
  let json = await res.json();
  expect(json.revealed).toBe(false);
  expect(json.finished).toBe(false);
  expect(json.message).toBe("게임이 끝나면 공개됩니다");
  expect(json.results).toEqual([]);

  // 5라운드 end 로 올려도 reveal_result 가 꺼져 있으면 비공개
  const sb = supabaseAdmin();
  const up = await sb.from("mafia_phase_state").update({ round_number: 5, phase: "end" }).eq("room_code", room);
  expect(up.error).toBeNull();
  res = await request.get(`/api/mafia/result?room=${room}`);
  json = await res.json();
  expect(json.revealed).toBe(false);
  expect(json.finished).toBe(true);
  expect(json.results).toEqual([]);

  // GM 공개 토글(WS-A 의 PATCH 는 이 브랜치에 없어 DB 로 직접) → 공개
  const rv = await sb.from("rooms").update({ reveal_result: true }).eq("code", room);
  expect(rv.error).toBeNull();
  res = await request.get(`/api/mafia/result?room=${room}`);
  json = await res.json();
  expect(json.revealed).toBe(true);
  expect(json.results.length).toBe(5);
  for (const r of json.results) {
    expect(Object.keys(r).sort()).toEqual(["asset", "cash", "finished_rank", "nickname", "player_id"].sort());
  }
  // 다시 끄면 비공개
  await sb.from("rooms").update({ reveal_result: false }).eq("code", room);
  json = await (await request.get(`/api/mafia/result?room=${room}`)).json();
  expect(json.revealed).toBe(false);
});

test("종료된 방: 베팅·거래·투표 API 409 room_ended, 상태 조회는 roomStatus=ended", async ({ request }) => {
  const sb = supabaseAdmin();
  await sb.from("mafia_phase_state").update({ round_number: 1, phase: "trade" }).eq("room_code", room);
  await endRoom(request, room);
  const buy = await mafiaAct(request, room, "E월급", "buy", { stock_key: "국채", amount: 1 });
  expect(buy.status()).toBe(409);
  expect((await buy.json()).reason).toBe("room_ended");
  const bet = await mafiaAct(request, room, "E월급", "bet", { job: "ceo", amount: 1 });
  expect(bet.status()).toBe(409);
  const vote = await mafiaVote(request, room, "E월급", ids["A강도"], 1);
  expect(vote.status()).toBe(409);
  const s = await state(request, "E월급");
  expect(s.roomStatus).toBe("ended");
  // 로그는 종료 후에도 열람된다
  expect(s.myLog.length).toBeGreaterThan(0);
});

test("입력 퍼징: 플레이어 API 에 500 이 없다", async ({ request }) => {
  const bad: { url: string; data: unknown }[] = [
    { url: "/api/mafia/action", data: {} },
    { url: "/api/mafia/action", data: { room } },
    { url: "/api/mafia/action", data: { room, nickname: 1, type: "buy" } },
    { url: "/api/mafia/action", data: { room, nickname: "E월급", type: "BUY", payload: { stock_key: "국채", amount: 1 } } },
    { url: "/api/mafia/action", data: { room, nickname: "E월급", type: "buy", payload: "x" } },
    { url: "/api/mafia/action", data: { room, nickname: "E월급", type: "buy", payload: { stock_key: 1, amount: "3" } } },
    { url: "/api/mafia/action", data: { room, nickname: "E월급", type: "bet", payload: { job: "ceo", amount: "3" }, request_id: "bad id!" } },
    { url: "/api/mafia/action", data: { room, nickname: "E월급", type: "ability", payload: { targets: ["x"] } } },
    { url: "/api/mafia/vote", data: {} },
    { url: "/api/mafia/vote", data: { room, nickname: "E월급", target_id: 12, vote_count: 1 } },
    { url: "/api/mafia/vote", data: { room, nickname: "E월급", target_id: "00000000-0000-0000-0000-000000000000", vote_count: 1.5 } },
    { url: "/api/mafia/vote", data: { room, nickname: "E월급", target_id: ids["A강도"], vote_count: 10_000_000 } },
  ];
  for (const b of bad) {
    const r = await request.post(b.url, { data: b.data });
    expect(r.status(), `${b.url} ${JSON.stringify(b.data)}`).toBeLessThan(500);
  }
  // 상태 조회: 없는 방 404, 없는 닉네임 403(reason), 닉네임 변형은 같은 사람
  expect((await request.get(`/api/mafia/state?room=ZZZZZ&nickname=x`)).status()).toBe(404);
  const forbidden = await request.get(`/api/mafia/state?room=${room}&nickname=${encodeURIComponent("없는사람")}`);
  expect(forbidden.status()).toBe(403);
  expect((await forbidden.json()).reason).toBe("not_registered");
  const nfd = await request.get(`/api/mafia/state?room=${room}&nickname=${encodeURIComponent("E월급".normalize("NFD") + "​")}`);
  expect(nfd.status()).toBe(200);
});
