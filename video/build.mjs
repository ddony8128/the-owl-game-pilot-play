// 룰 영상 빌드 (디펜스 딜레마 · 자본주의 마피아): 장면별 TTS + 타이밍 계산 + (옵션) 렌더.
//   node build.mjs                       → TTS 준비, generated/timings.json·chapters.json 작성
//   node build.mjs --render              → 위 + remotion 렌더 → ../public/video/{defense,mafia}.mp4
//   node build.mjs --render --only=mafia → 한 편만 렌더
//
// 올림포스 마피아 video/build.mjs를 옮겨 왔다(Veo 클립·배경·아이콘 단계는 뺐다).
// 대본은 src/scenes.ts(정본 video/rule-video-plan-v1.md 글자 그대로). 씬 길이 = 나레이션 길이 + 여운.
//
// TTS: Gemini(기본 Algenib). 원본은 assets/audio/<voice>/에 두고 **커밋한다** — 다시 빌드할 때
// 같은 문장이면 API를 부르지 않는다. GEMINI_API_KEY가 환경에 없으면 ../.env.local에서 읽는다
// (키 값은 출력하지 않는다). ffmpeg/ffprobe 필요.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP = join(ROOT, '..');
const PUB = join(ROOT, 'public');

function envFromDotLocal(name) {
  const f = join(APP, '.env.local');
  if (!existsSync(f)) return undefined;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const KEY = process.env.GEMINI_API_KEY ?? envFromDotLocal('GEMINI_API_KEY');
const VOICE = process.env.VOICE ?? 'Algenib';
const TTS_MODEL = process.env.TTS_MODEL ?? 'gemini-3.1-flash-tts-preview';
const FPS = 30;
// 나레이션 배속(피치 유지 atempo). 두 편 같은 값.
const SPEED = { defense: 1.25, mafia: 1.28 };
// 씬 길이 = 나레이션 + 여운(도식을 읽을 시간). 장면별 hold로 덮어쓸 수 있다.
const HOLD_SEC = 1.6;
// 제목 장면처럼 짧은 나레이션도 최소 이만큼은 보인다.
const MIN_SCENE_SEC = 5;
// Gemini TTS 연기 지시 — 결과 음원을 바꾸는 입력이라 캐시 키(해시)에 들어간다.
const STYLE = process.env.GEMINI_STYLE ?? '또렷하고 차분한 목소리로, 규칙을 설명하듯 보통 속도로 읽어 주세요';

mkdirSync(join(PUB, 'audio'), { recursive: true });
mkdirSync(join(ROOT, 'generated'), { recursive: true });

// 1. 대본 로드 — esbuild로 타입만 걷어내 실행한다.
const { SCRIPTS } = await importScenes();
async function importScenes() {
  const tmp = join(ROOT, 'generated', 'scenes.tmp.mjs');
  const esbuild = join(ROOT, 'node_modules', '.bin', 'esbuild');
  execSync(
    `"${esbuild}" "${join(ROOT, 'src', 'scenes.ts')}" --bundle --format=esm --target=node20 --outfile="${tmp}"`,
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
}

// 2. TTS
//   assets/audio/<voice>/<script>-<NN>-<hash>.wav = 생성 원본(1.0배속). 커밋한다.
//   public/audio/<script>-<NN>-<hash>-x<speed>.wav = 배속 적용본. gitignore.
async function ttsGemini(text, file) {
  if (!KEY) throw new Error('GEMINI_API_KEY 필요(.env.local 또는 환경 변수)');
  const prompt = `${STYLE}: ${text}`;
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            },
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 200)}`);
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error('no audio ' + JSON.stringify(json).slice(0, 200));
      const pcm = Buffer.from(part.inlineData.data, 'base64');
      const rate = Number(/rate=(\d+)/i.exec(part.inlineData.mimeType)?.[1] ?? 24000);
      const h = Buffer.alloc(44);
      h.write('RIFF', 0);
      h.writeUInt32LE(36 + pcm.length, 4);
      h.write('WAVE', 8);
      h.write('fmt ', 12);
      h.writeUInt32LE(16, 16);
      h.writeUInt16LE(1, 20);
      h.writeUInt16LE(1, 22);
      h.writeUInt32LE(rate, 24);
      h.writeUInt32LE(rate * 2, 28);
      h.writeUInt16LE(2, 32);
      h.writeUInt16LE(16, 34);
      h.write('data', 36);
      h.writeUInt32LE(pcm.length, 40);
      writeFileSync(file, Buffer.concat([h, pcm]));
      return;
    } catch (e) {
      lastErr = e;
      console.log(`  재시도 ${attempt}/4: ${String(e.message ?? e).slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  throw lastErr;
}

async function narrationWav(scriptId, i, text, speed) {
  const nn = String(i).padStart(2, '0');
  const hash = createHash('sha1')
    .update(`${VOICE}|${TTS_MODEL}|${STYLE}|${text}`)
    .digest('hex')
    .slice(0, 8);
  const dir = join(ROOT, 'assets', 'audio', VOICE.toLowerCase());
  mkdirSync(dir, { recursive: true });
  const origin = join(dir, `${scriptId}-${nn}-${hash}.wav`);
  if (!existsSync(origin)) {
    // 같은 문장·같은 지시면 다른 순번 파일을 그대로 쓴다(장면 순서를 바꿔도 재녹음 없음).
    const same = readdirSync(dir).find((f) => f.endsWith(`-${hash}.wav`));
    if (same) writeFileSync(origin, readFileSync(join(dir, same)));
  }
  if (!existsSync(origin)) {
    process.stdout.write(`tts ${scriptId}-${nn}-${hash} ... `);
    await ttsGemini(text, origin);
    console.log('ok');
  }
  const name = `${scriptId}-${nn}-${hash}-x${speed}.wav`;
  const out = join(PUB, 'audio', name);
  if (!existsSync(out)) {
    if (speed === 1) writeFileSync(out, readFileSync(origin));
    else execSync(`ffmpeg -v error -y -i "${origin}" -filter:a "atempo=${speed}" "${out}"`);
  }
  return `audio/${name}`;
}

function wavSeconds(file) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`,
  );
  return Number(String(out).trim());
}

// 3. 타이밍
const timings = {};
for (const script of SCRIPTS) {
  const scenes = [];
  const speed = SPEED[script.id] ?? 1;
  for (const [i, s] of script.scenes.entries()) {
    const audio = await narrationWav(script.id, i, s.narration, speed);
    const narrSec = wavSeconds(join(PUB, audio));
    const frames = Math.ceil(Math.max(MIN_SCENE_SEC, narrSec + (s.hold ?? HOLD_SEC)) * FPS);
    scenes.push({ frames, audio, narrSec: Number(narrSec.toFixed(2)) });
  }
  const total = scenes.reduce((a, b) => a + b.frames, 0);
  timings[script.id] = { scenes, total };
  console.log(
    script.id,
    `x${speed}`,
    `${(total / FPS).toFixed(1)}s`,
    scenes.map((x) => (x.frames / FPS).toFixed(1)).join(' '),
  );
}
writeFileSync(join(ROOT, 'generated', 'timings.json'), JSON.stringify(timings, null, 2));

// 4. 장(章) 목록 — chapter를 단 씬의 실제 시작 초. 마지막에 전체 길이를 '끝'으로 넣는다.
const chapters = {};
for (const script of SCRIPTS) {
  const list = [];
  let acc = 0;
  for (const [i, sc] of script.scenes.entries()) {
    if (sc.chapter) list.push({ label: sc.chapter, atSec: Number((acc / FPS).toFixed(2)) });
    acc += timings[script.id].scenes[i].frames;
  }
  list.push({ label: '끝', atSec: Number((acc / FPS).toFixed(2)) });
  chapters[script.id] = list;
}
writeFileSync(join(ROOT, 'generated', 'chapters.json'), JSON.stringify(chapters, null, 2));
console.log('chapters', Object.entries(chapters).map(([k, v]) => `${k}:${v.length - 1}`).join(' '));

// 5. 렌더 — 1080p 렌더 후 720p(crf 26)로 줄여 배포 파일을 작게. 오디오는 aac.
if (process.argv.includes('--render')) {
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
  mkdirSync(join(APP, 'public', 'video'), { recursive: true });
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  for (const script of SCRIPTS) {
    if (only && script.id !== only) continue;
    const mezz = join(ROOT, 'out', `${script.id}-1080.mp4`);
    const out = join(APP, 'public', 'video', `${script.id}.mp4`);
    console.log('render', script.id, '→', out);
    execSync(`npx remotion render src/index.ts ${script.id} "${mezz}" --codec=h264 --crf=22 --log=error`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    execSync(
      `ffmpeg -v error -y -i "${mezz}" -vf scale=1280:720 -c:v libx264 -crf 26 -preset slow -movflags +faststart -c:a aac -b:a 128k "${out}"`,
      { stdio: 'inherit' },
    );
    console.log('done', script.id, `${(statSync(out).size / 1e6).toFixed(1)} MB`);
  }
}
