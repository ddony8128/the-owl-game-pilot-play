// npm run check:video — 룰 영상 대본 검사 (정본 video/rule-video-plan-v1.md ↔ video/src/scenes.ts)
//  ① 나레이션: 정본과 글자 대조 0 diff (장면 순서·개수 포함)
//  ② 화면: 정본 「화면:」의 「」 글자가 그 장면의 scenes.ts 화면 텍스트에 전부 포함
//  ③ 금지어(세계관): 부엉 · 부엉이 · 나폴리탄 · ~다부엉 — 0건
//     (종목 이름 "부엉교육"은 앱 화면 라벨이라 예외)
//  ④ 장: scenes.ts의 chapter 순서 = generated/chapters.json = 정본 1.3
//  ⑤ data.cues의 문구가 그 장면 나레이션에 실제로 있음(도식 등장 시점)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseVideoPlan } from './lib/video-plan.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO = join(APP, 'video');
const PLAN = process.argv[2] ?? join(VIDEO, 'rule-video-plan-v1.md');

const tmp = join(VIDEO, 'generated', 'scenes.check.tmp.mjs');
execSync(
  `"${join(VIDEO, 'node_modules', '.bin', 'esbuild')}" "${join(VIDEO, 'src', 'scenes.ts')}" --bundle --format=esm --target=node20 --outfile="${tmp}" --log-level=error`,
);
const { SCRIPTS } = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
const plan = parseVideoPlan(PLAN);
const chaptersJson = JSON.parse(readFileSync(join(VIDEO, 'generated', 'chapters.json'), 'utf8'));

const fails = [];
const ok = [];
const fail = (m) => fails.push(m);

for (const id of ['defense', 'mafia']) {
  const want = plan[id];
  const got = SCRIPTS.find((s) => s.id === id)?.scenes ?? [];
  if (want.length !== got.length) fail(`[${id}] 장면 수 정본 ${want.length} ≠ scenes.ts ${got.length}`);
  let narrDiff = 0;
  let screenMiss = 0;
  for (const [i, w] of want.entries()) {
    const g = got[i];
    if (!g) continue;
    if (g.id !== w.id) fail(`[${id}] ${i + 1}번째 장면 id ${g.id} ≠ 정본 ${w.id}`);
    if (g.narration !== w.narration) {
      narrDiff += 1;
      let k = 0;
      while (k < w.narration.length && w.narration[k] === g.narration[k]) k += 1;
      fail(`[${id}] ${w.id} 나레이션 불일치 @${k}: 정본 "${w.narration.slice(k, k + 20)}" / scenes "${g.narration.slice(k, k + 20)}"`);
    }
    const text = JSON.stringify({ screen: g.screen, data: g.data ?? null });
    const plain = JSON.parse(JSON.stringify(g.screen)).join('\n');
    for (const q of w.screen) {
      if (!plain.includes(q) && !text.includes(JSON.stringify(q).slice(1, -1))) {
        screenMiss += 1;
        fail(`[${id}] ${w.id} 화면 글자 누락: 「${q}」`);
      }
    }
    if ((g.chapter ?? null) !== (w.chapter ?? null)) fail(`[${id}] ${w.id} 장 ${g.chapter} ≠ 정본 ${w.chapter}`);
    for (const c of g.data?.cues ?? []) {
      if (!g.narration.includes(c)) fail(`[${id}] ${w.id} cue 문구가 나레이션에 없음: "${c}"`);
    }
  }
  ok.push(`[${id}] 나레이션 ${want.length}장면 diff ${narrDiff} · 화면 「」 ${want.reduce((a, w) => a + w.screen.length, 0)}개 누락 ${screenMiss}`);

  const sceneChapters = got.filter((s) => s.chapter).map((s) => s.chapter);
  const jsonChapters = (chaptersJson[id] ?? []).map((c) => c.label).filter((l) => l !== '끝');
  const planChapters = plan.chapters[id];
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!same(sceneChapters, planChapters)) fail(`[${id}] scenes.ts 장 ${sceneChapters.join('/')} ≠ 정본 1.3 ${planChapters.join('/')}`);
  if (!same(jsonChapters, planChapters)) fail(`[${id}] chapters.json 장 ${jsonChapters.join('/')} ≠ 정본 1.3 ${planChapters.join('/')}`);
  else ok.push(`[${id}] 장 ${planChapters.length}개 = 정본 1.3 = chapters.json`);
}

// ③ 금지어 — scenes.ts·Diagrams.tsx 전체(주석 제외 없이 엄격하게)
const FORBIDDEN = ['부엉이', '나폴리탄', '다부엉', '부엉'];
const ALLOWED = ['부엉교육'];
let forbidden = 0;
for (const f of ['src/scenes.ts', 'src/Diagrams.tsx', 'src/RuleVideo.tsx']) {
  let src = readFileSync(join(VIDEO, f), 'utf8');
  for (const a of ALLOWED) src = src.split(a).join('');
  for (const w of FORBIDDEN) {
    const n = src.split(w).length - 1;
    if (n > 0) {
      forbidden += n;
      fail(`금지어 "${w}" ${n}건: video/${f}`);
    }
  }
}
ok.push(`금지어 ${forbidden}건 (예외: ${ALLOWED.join(', ')} — 종목 라벨)`);

// 정본 사본이 미션 정본과 같은지(있을 때만)
const missionPlan = 'C:/not_system/project/ai-runner/missions/owl-main/copy/rule-video-plan-v1.md';
if (!process.argv[2] && existsSync(missionPlan)) {
  const a = readFileSync(missionPlan, 'utf8').replace(/\r\n/g, '\n');
  const b = readFileSync(PLAN, 'utf8').replace(/\r\n/g, '\n');
  if (a !== b) fail('video/rule-video-plan-v1.md가 미션 정본(copy/rule-video-plan-v1.md)과 다릅니다');
  else ok.push('정본 사본 = 미션 정본');
}

for (const m of ok) console.log('ok  ', m);
for (const m of fails) console.log('FAIL', m);
console.log(fails.length === 0 ? 'check:video 통과' : `check:video 실패 ${fails.length}건`);
process.exit(fails.length === 0 ? 0 : 1);
