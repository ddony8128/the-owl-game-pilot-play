// 룰 영상 배경 그림(Iteration 4) — Gemini 이미지 모델로 테마 배경 6장을 만들어 video/assets/bg/에 둔다(커밋).
//   node gen-bg.mjs            → 없는 것만 생성
//   node gen-bg.mjs --only city-defense → 그 하나만 다시 생성
// 디펜스 = 포스터와 같은 「극장 무대 + 괴수에게 습격당한 만화풍 도시」(커튼 레드·골드),
// 마피아 = 포스터와 같은 「누아르 세피아 도시·꼭두각시 자본가」(세피아·골드). 글자 없음.
// 키는 GEMINI_API_KEY(환경 변수 또는 ../.env.local). 결과는 build.mjs가 public/bg/로 복사한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'assets', 'bg');
mkdirSync(OUT, { recursive: true });

function envFromDotLocal(name) {
  const f = join(ROOT, '..', '.env.local');
  if (!existsSync(f)) return undefined;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
  }
  return undefined;
}
const KEY = process.env.GEMINI_API_KEY ?? envFromDotLocal('GEMINI_API_KEY');
if (!KEY) {
  console.error('GEMINI_API_KEY 필요');
  process.exit(1);
}
const MODELS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

const DEF =
  'Hand-painted cartoon illustration in the style of a retro theater poster: bold ink outlines, warm stage lighting, ' +
  'deep crimson velvet curtains and brass-gold trims framing the edges, cream and amber highlights. ' +
  'Wide 16:9 composition with a calm, uncluttered center area so large text can be placed over it. ' +
  'No text, no letters, no logos, no UI.';
const MAF =
  'Film-noir sepia illustration: dark brown and gold tones, dramatic rim light, ink-wash shading, ' +
  'a ruined 1930s city skyline at night with a faint stock-price line glowing gold. ' +
  'Wide 16:9 composition with a calm, uncluttered center area so large text can be placed over it. ' +
  'No text, no letters, no logos, no UI.';

const SPECS = [
  { name: 'stage-defense', prompt: `An empty theater stage seen from the audience: crimson curtains drawn open at both sides, warm spotlights on the boards, a painted backdrop of a cartoon city at dusk far behind. ${DEF}` },
  { name: 'city-defense', prompt: `A cartoon city street at dusk under attack: skyscrapers, a tall tower, a few distant monster silhouettes (giant spider, octopus tentacle, tall thin figure) looming over rooftops, smoke and spotlights, no people in the foreground. ${DEF}` },
  { name: 'alley-defense', prompt: `A wide cartoon city avenue at night seen straight on, like a waiting line: a row of empty spotlight circles on the asphalt leading toward the camera, theater curtains framing the left and right edges, monsters only as faint shapes in the far fog. ${DEF}` },
  { name: 'skyline-mafia', prompt: `A ruined city skyline at night seen from a penthouse window, rain streaks on the glass, distant neon-less dark towers, a thin gold stock chart line floating over the city. ${MAF}` },
  { name: 'floor-mafia', prompt: `An old stock exchange trading floor at night, empty wooden desks and brass lamps, a large dark price board on the far wall with faint gold ticks (no readable text), long shadows. ${MAF}` },
  { name: 'hall-mafia', prompt: `A dim grand hall for a secret vote: long wooden tables, a single brass ballot box under a spotlight, tall windows with city lights behind, shadowy empty chairs. ${MAF}` },
];

async function generate(model, prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
    }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const img = (json?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!img) throw new Error(`${model}: 이미지 파트 없음`);
  return Buffer.from(img.inlineData.data, 'base64');
}

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
for (const spec of SPECS) {
  if (only && spec.name !== only) continue;
  const out = join(OUT, `${spec.name}.png`);
  if (existsSync(out) && !only) {
    console.log(`skip (exists): ${spec.name}`);
    continue;
  }
  let buf = null;
  for (const model of MODELS) {
    try {
      console.log(`생성 중: ${spec.name} (${model})…`);
      buf = await generate(model, spec.prompt);
      break;
    } catch (e) {
      console.warn(`  실패: ${e.message}`);
    }
  }
  if (!buf) {
    console.error(`생성 실패: ${spec.name}`);
    process.exit(1);
  }
  writeFileSync(out, buf);
  console.log(`  저장: ${out} (${Math.round(buf.length / 1024)} KB)`);
}
