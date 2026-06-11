// 모바일(플레이어) 화면 캡처 + 가로 오버플로 측정 — /intro, /subway, /subway/end
// 사용: dev 서버(localhost:3000) 띄운 상태에서 `node docs/capture-mobile.mjs`
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAYER = { id: "p1", nickname: "철수" };
const GAME_STATE = {
  gameState: { active_game: "subway" },
  rules: [{ rule_key: "subway", is_open: true }],
};

// 페이지별 subway state mock
let subwayMode = "intro";
function subwayStateBody() {
  if (subwayMode === "play") {
    return {
      state: {
        exitNumber: 3, currentLocation: null, resetCount: 16,
        isFinished: false, finishedRank: null,
        timerStart: false, timerStartAt: null, totalSeconds: 1800, pauseAt: null,
        rules: [], othersAtSameLocation: [],
      },
    };
  }
  if (subwayMode === "end") {
    return {
      state: {
        exitNumber: 8, currentLocation: null, resetCount: 16,
        isFinished: true, finishedRank: 2,
        timerStart: false, timerStartAt: null, totalSeconds: 1800, pauseAt: null,
        rules: [], othersAtSameLocation: [],
      },
    };
  }
  return { state: null };
}

async function main() {
  const OUT = new URL("./screenshots/", import.meta.url);
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--lang=ko-KR"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("owlgame:nickname", "철수");
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    const json = (b) => req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.includes("/api/auth/login")) return json({ player: PLAYER });
    if (u.includes("/api/state/game")) return json(GAME_STATE);
    if (u.includes("/api/subway/state")) return json(subwayStateBody());
    return req.continue();
  });

  async function measure(label) {
    return page.evaluate((label) => {
      const de = document.documentElement;
      const vw = window.innerWidth;
      const overflowers = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          overflowers.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 80),
            left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
          });
        }
      }
      // 가장 넓은(=가장 바깥) 5개만
      overflowers.sort((a, b) => b.right - a.right);
      return { label, vw, scrollW: de.scrollWidth, clientW: de.clientWidth,
        overflowX: de.scrollWidth > de.clientWidth, top: overflowers.slice(0, 8) };
    }, label);
  }

  async function shot(name) {
    const file = fileURLToPath(new URL(`./screenshots/${name}.png`, import.meta.url));
    await page.screenshot({ path: file, fullPage: false }); // 뷰포트 클립 = 실제 보이는 영역
    console.log(`  ✓ ${name}`);
  }

  const results = [];

  subwayMode = "intro";
  await page.goto(`${BASE}/intro`, { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);
  results.push(await measure("intro")); await shot("m-intro");

  subwayMode = "play";
  await page.goto(`${BASE}/subway`, { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1200);
  results.push(await measure("subway-guide-open")); await shot("m-subway-guide");
  // 안내문 모달 닫기
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /닫기|확인|시작|x/i.test(b.textContent || ""));
    btn?.click();
  });
  await sleep(600);
  results.push(await measure("subway-play")); await shot("m-subway");

  subwayMode = "end";
  await page.goto(`${BASE}/subway/end`, { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);
  results.push(await measure("subway-end")); await shot("m-end");

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  console.log("완료");
}

main().catch((e) => { console.error(e); process.exit(1); });
