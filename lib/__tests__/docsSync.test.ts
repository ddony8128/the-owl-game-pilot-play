import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { recommendedMonsterCounts, DEFENSE_PLAYER_MIN, DEFENSE_PLAYER_MAX } from "@/lib/defense/composition";
import { computeQueueSize } from "@/lib/defense/queue";
import { MAFIA_MIN_PLAYERS, MAFIA_RECOMMENDED_MIN, MAFIA_RECOMMENDED_MAX } from "@/lib/admin/headcount";
import { chaptersOf } from "@/lib/ruleVideos";

// verify:docs — "문서 ≠ 코드" 반면교사(수산시장 Iter16·29, 증권가 §29). GM 안내·폰 규칙 탭의 숫자와 버튼 이름이
// 코드 상수·실제 소스와 같은지 읽어서 대조한다. 숫자는 문서를 손으로 고칠 때 가장 자주 어긋난다.
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const mdDefense = read("docs/GM안내-디펜스.md");
const mdMafia = read("docs/GM안내-마피아.md");
const htmlDefense = read("docs/gm-guide/디펜스.html");
const htmlMafia = read("docs/gm-guide/마피아.html");
const phoneDefense = read("app/defense/DefenseRulesTab.tsx");

function sourceText(dir: string): string {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "__tests__") continue;
        walk(p);
      } else if (/\.(tsx?|css)$/.test(ent.name)) out.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(path.join(ROOT, dir));
  return out.join("\n");
}
const appSource = sourceText("app") + "\n" + sourceText("components") + "\n" + sourceText("lib");

// GM 안내는 장 시작 초를 반올림해 적는다(23.77 → 0:24, 116.9 → 1:57)
const mmss = (sec: number) => {
  const r = Math.round(sec);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};

describe("문서 = 코드: 디펜스 인원별 구성표", () => {
  const ids = [1, 2, 3, 4, 5, 6] as const;
  for (let n = DEFENSE_PLAYER_MIN; n <= DEFENSE_PLAYER_MAX; n += 1) {
    const row = recommendedMonsterCounts(n);
    const counts = ids.map((id) => row[id]);
    const total = counts.reduce((a, b) => a + b, 0);
    it(`${n}명: GM 안내 md/HTML 표 = composition.ts (${counts.join("/")}, 총 ${total}, 대기열 ${computeQueueSize(n)})`, () => {
      const mdRow = `| ${n} | ${computeQueueSize(n)} | ${total} | ${counts.join(" | ")} |`;
      expect(mdDefense, `md 표 행: ${mdRow}`).toContain(mdRow);
      const htmlRow = `<tr><td>${n}</td><td>${computeQueueSize(n)}</td><td>${total}</td>${counts.map((c) => `<td>${c}</td>`).join("")}</tr>`;
      expect(htmlDefense, `html 표 행: ${htmlRow}`).toContain(htmlRow);
    });
  }
  it("대기열 칸 수 문구(6~9명 4칸 / 10~12명 5칸)", () => {
    expect(computeQueueSize(9)).toBe(4);
    expect(computeQueueSize(10)).toBe(5);
    expect(mdDefense).toContain("6~9명 4칸 / 10~12명 5칸");
  });
});

describe("문서 = 코드: 마피아 인원 범위", () => {
  it(`GM 안내 md/HTML 에 권장 ${MAFIA_RECOMMENDED_MIN}~${MAFIA_RECOMMENDED_MAX}명 · ${MAFIA_MIN_PLAYERS}명 미만 차단`, () => {
    const rec = `${MAFIA_RECOMMENDED_MIN}~${MAFIA_RECOMMENDED_MAX}명`;
    expect(mdMafia).toContain(rec);
    expect(mdMafia).toContain(`${MAFIA_MIN_PLAYERS}명 미만`);
    expect(htmlMafia).toContain(rec);
    expect(htmlMafia).toContain(`${MAFIA_MIN_PLAYERS}명 미만`);
  });
});

describe("문서 = 코드: 룰 영상 장 시각", () => {
  for (const [id, md] of [["defense", mdDefense], ["mafia", mdMafia]] as const) {
    it(`${id}: GM 안내의 장 버튼 시각 = chapters.json`, () => {
      for (const ch of chaptersOf(id)) {
        if (ch.label === "끝") continue;
        expect(md, `${ch.label}(${mmss(ch.atSec)})`).toContain(`${ch.label}(${mmss(ch.atSec)})`);
      }
    });
  }
});

describe("문서 = 코드: 동점·순위 문구", () => {
  it("GM 안내·폰 규칙 탭이 '공동 순위'를 말한다", () => {
    expect(mdDefense).toContain("공동 순위");
    expect(phoneDefense).toContain("공동 순위");
    expect(mdMafia).toContain("공동 순위");
  });
});

describe("문서 = 코드: GM 안내의 버튼·문구가 실제 소스에 있다", () => {
  const labels = new Set<string>();
  for (const md of [mdDefense, mdMafia]) {
    for (const m of md.matchAll(/\*\*\[([^\]]+)\]\*\*|「([^」]+)」/g)) labels.add((m[1] ?? m[2]).trim());
  }
  const strip = (s: string) => s.replace(/^[^\p{L}\p{N}+]+/u, "").trim(); // 이모지·화살표 접두 제거
  for (const label of labels) {
    const needle = strip(label);
    if (!needle || needle === "참가자") continue;
    it(`"${label}"`, () => {
      expect(appSource.includes(needle), `소스에 "${needle}" 없음`).toBe(true);
    });
  }
});
