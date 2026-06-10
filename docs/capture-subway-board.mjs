// 결과 중계 보드(/subway-board) 캡처 — API 응답을 목으로 가로채 DB 없이 캡처
// 사용: dev 서버(localhost:3000) 띄운 상태에서 `node docs/capture-subway-board.mjs`
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MOCK_STATE = [
  // tier1 (15회 이하 탈출자)
  { player_id: "p1", nickname: "철수", exit_number: 8, current_location: null, reset_count: 3, is_finished: true, finished_rank: 1, updated_at: "" },
  { player_id: "p2", nickname: "영희", exit_number: 8, current_location: null, reset_count: 7, is_finished: true, finished_rank: 2, updated_at: "" },
  { player_id: "p3", nickname: "민수", exit_number: 8, current_location: null, reset_count: 12, is_finished: true, finished_rank: 3, updated_at: "" },
  // tier2 (15회 초과 탈출자)
  { player_id: "p4", nickname: "지은", exit_number: 8, current_location: null, reset_count: 16, is_finished: true, finished_rank: 5, updated_at: "" },
  { player_id: "p5", nickname: "대현", exit_number: 8, current_location: null, reset_count: 21, is_finished: true, finished_rank: 4, updated_at: "" },
  // 미탈출
  { player_id: "p6", nickname: "보라", exit_number: 5, current_location: null, reset_count: 9, is_finished: false, finished_rank: null, updated_at: "" },
  { player_id: "p7", nickname: "하늘", exit_number: 2, current_location: null, reset_count: 18, is_finished: false, finished_rank: null, updated_at: "" },
];

async function main() {
  const OUT = new URL("./screenshots/", import.meta.url);
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--lang=ko-KR"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/subway/state")) {
      req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: MOCK_STATE }),
      });
    } else {
      req.continue();
    }
  });

  async function shot(name) {
    const file = fileURLToPath(
      new URL(`./screenshots/${name}.png`, import.meta.url)
    );
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ✓ ${name}`);
  }

  const clickNext = () =>
    page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "다음"
      );
      btn?.click();
    });

  await page.goto(`${BASE}/subway-board`, { waitUntil: "load", timeout: 30000 });
  await sleep(1500);
  await shot("subway-board-result");

  // 규칙 해설 1번째(규칙 0)
  await clickNext();
  await sleep(600);
  await shot("subway-board-rules");

  // 규칙 3(본문이 긴 케이스)까지 이동
  await clickNext();
  await clickNext();
  await clickNext();
  await sleep(600);
  await shot("subway-board-rules-long");

  await browser.close();
  console.log("완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
