// 실제 페이지 캡처 스크립트 (설치된 Chrome + puppeteer-core)
// 사용: dev 서버(localhost:3000) 띄운 상태에서 `node docs/capture.mjs`
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const OUT = new URL("./screenshots/", import.meta.url);
const PLAYERS = ["캡처1", "캡처2", "캡처3", "캡처4", "캡처5", "캡처6"];
const ME = PLAYERS[0];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.warn(`  ! ${path} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("플레이어 생성...");
  await api("/api/test/players", { nicknames: PLAYERS });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--lang=ko-KR"],
  });

  const shots = [];
  async function shot(name, url, { mobile = true, wait = 2800 } = {}) {
    const page = await browser.newPage();
    try {
      await page.setViewport(
        mobile
          ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true }
          : { width: 1280, height: 900, deviceScaleFactor: 1 }
      );
      await page.goto(`${BASE}${url}`, {
        waitUntil: "load",
        timeout: 30000,
      });
      await sleep(wait);
      const file = fileURLToPath(
        new URL(`./screenshots/${name}.png`, import.meta.url)
      );
      await page.screenshot({ path: file, fullPage: false });
      console.log(`  ✓ ${name}  (${url})`);
      shots.push(name);
    } catch (e) {
      console.warn(`  ✗ ${name}  (${url}) -> ${e.message}`);
    } finally {
      await page.close();
    }
  }

  const as = (n) => `?as=${encodeURIComponent(ME)}`;

  // ---- active_game 무관 페이지 ----
  await shot("test-console", "/test", { mobile: false });
  await shot("gm-main", "/dashboard/x9a2k7/main", { mobile: false });
  await shot("rules", `/rules${as()}`);
  await shot("locked", "/locked");

  // ---- 인트로 ----
  await shot("intro", `/intro${as()}`);

  // ---- 1게임 이상교통 ----
  console.log("1게임 이상교통 세팅...");
  await api("/api/test/reset", { scope: "game", game: "subway" });
  await api("/api/gm/game/activate", { active_game: "subway" });
  await shot("subway", `/subway${as()}`);
  await shot("subway-gm", "/dashboard/x9a2k7/subway", { mobile: false });

  // ---- 2게임 디펜스 딜레마 ----
  console.log("2게임 디펜스 세팅...");
  await api("/api/test/reset", { scope: "game", game: "defense" });
  await api("/api/gm/game/activate", { active_game: "defense" });
  // round 0 -> 1 (initRound: 몬스터/카드/점수 시드)
  await api("/api/gm/defense/round", { round: 1 });
  await shot("defense", `/defense${as()}`);
  await shot("defense-board", "/defense-board", { mobile: false });
  await shot("defense-gm", "/dashboard/x9a2k7/defense", { mobile: false });

  // ---- 3게임 자본주의 마피아 ----
  console.log("3게임 마피아 세팅...");
  await api("/api/test/reset", { scope: "game", game: "mafia" });
  await api("/api/gm/game/activate", { active_game: "mafia" });
  // prepare -> auction (자산/주가 시드)
  await api("/api/gm/mafia/advance-phase", { to: "auction" });
  await shot("mafia", `/mafia${as()}`);
  await shot("mafia-gm", "/dashboard/x9a2k7/mafia", { mobile: false });

  // ---- 투표 ----
  console.log("투표 세팅...");
  await api("/api/gm/game/activate", { active_game: "vote" });
  await shot("vote", `/vote${as()}`);

  await browser.close();

  // ---- active_game 원복 ----
  console.log("active_game 원복(subway)...");
  await api("/api/gm/game/activate", { active_game: "subway" });

  console.log(`\n완료: ${shots.length}장`);
  console.log(shots.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
