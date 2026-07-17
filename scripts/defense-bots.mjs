// 디펜스 실플레이 테스트용 봇 시뮬레이터.
// 사람이 2명뿐일 때, 부족한 인원을 봇으로 채워 12인용(대기열 5칸) 실플레이를 돌린다.
//
// 사용:
//   node scripts/defense-bots.mjs <ROOM> [--bots 10] [--prefix bot] [--play]
//     <ROOM>      GM이 만든 방 코드 (필수)
//     --bots N    등록할 봇 수 (기본 10)  → 사람 2명 + 봇 10 = 12명(5칸)
//     --prefix p  봇 닉네임 접두 (기본 bot → bot1..botN)
//     --play      등록 후, 매 라운드 자동 플레이 루프 시작 (Ctrl+C로 종료)
//     --base URL  대상 사이트 (기본 배포 URL)
//
// 순서: ① GM이 방 생성 → ② 이 스크립트로 봇 등록(게임 시작 전!) →
//       ③ 사람들도 각자 닉네임으로 입장 → ④ GM이 라운드 진행. 봇은 자동 반응.

const args = process.argv.slice(2);
const room = args.find((a) => !a.startsWith("--"));
const getOpt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : def;
};
const BASE = getOpt("base", "https://the-owl-game-pilot-play-real.vercel.app");
const N = Number(getOpt("bots", "10"));
const PREFIX = getOpt("prefix", "bot");
const PLAY = args.includes("--play");

if (!room) {
  console.error("사용법: node scripts/defense-bots.mjs <ROOM> [--bots 10] [--play]");
  process.exit(1);
}

const bots = Array.from({ length: N }, (_, i) => `${PREFIX}${i + 1}`);
const j = (r) => r.json().catch(() => null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function register() {
  console.log(`[등록] 방 ${room} 에 봇 ${N}명 등록 → ${BASE}`);
  for (const nick of bots) {
    const res = await fetch(`${BASE}/api/gm/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, nickname: nick }),
    });
    console.log(`  ${nick}: ${res.ok ? "ok" : `실패(${res.status})`}`);
  }
}

const isPlayable = (round) =>
  round === 1 || round === 2 || (round >= 4 && round <= 15);

async function actOnce(nick) {
  const st = await j(
    await fetch(`${BASE}/api/defense/state?room=${room}&nickname=${nick}`),
  );
  if (!st || typeof st.round !== "number") return;
  const round = st.round;
  if (!isPlayable(round)) return;
  if (st.action && st.action.round === round) return; // 이미 이번 라운드 행동함

  const active = (st.cards ?? []).filter((c) => c.isActive);
  const monsters = st.monsters ?? [];

  let body;
  if (active.length === 0) {
    // 활성 카드가 없으면 휴식(비활성 최대 3장 재활성)
    const inactive = (st.cards ?? [])
      .filter((c) => !c.isActive)
      .map((c) => c.cardSlot)
      .slice(0, 3);
    if (inactive.length === 0) return;
    body = { action_type: "rest", rest_slots: inactive };
  } else if (monsters.length > 0) {
    // 체력이 가장 낮은(잡기 쉬운) 몬스터를 가장 큰 카드로 공격
    const target = monsters.slice().sort((a, b) => a.currentHp - b.currentHp)[0];
    const card = active.slice().sort((a, b) => b.cardValue - a.cardValue)[0];
    body = {
      action_type: "combat",
      target_monster_id: target.instanceId,
      used_card_slot: card.cardSlot,
    };
  } else {
    return; // 몬스터가 없으면 대기
  }

  const res = await fetch(`${BASE}/api/defense/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room, nickname: nick, ...body }),
  });
  if (res.ok)
    console.log(`  [R${round}] ${nick} → ${body.action_type}`);
}

async function playLoop() {
  console.log(`[플레이] 매 4초 폴링, 라운드마다 봇 자동 행동. Ctrl+C 로 종료.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    for (const nick of bots) {
      try {
        await actOnce(nick);
      } catch (e) {
        console.log(`  ${nick} 오류: ${e?.message ?? e}`);
      }
    }
    await wait(4000);
  }
}

await register();
if (PLAY) await playLoop();
else console.log("등록 완료. 실플레이 자동화를 원하면 --play 를 붙여 다시 실행하세요.");
