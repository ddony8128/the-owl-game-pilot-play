// 검토용 정지 화면: 각 장면의 88% 지점을 out/stills/<편>-<NN>.png로 (번들 1회).
//   node stills.mjs [defense|mafia] [장면번호,...]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const timings = JSON.parse(readFileSync(join(ROOT, 'generated', 'timings.json'), 'utf8'));
const only = process.argv[2];
const pick = process.argv[3]?.split(',').map(Number);
const outDir = process.env.STILLS_DIR ?? join(ROOT, 'out', 'stills');
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(ROOT, 'src', 'index.ts') });
for (const id of ['defense', 'mafia']) {
  if (only && only !== 'all' && only !== id) continue;
  const composition = await selectComposition({ serveUrl, id });
  let acc = 0;
  for (const [i, s] of timings[id].scenes.entries()) {
    const frame = acc + Math.floor(s.frames * 0.88);
    acc += s.frames;
    if (pick && !pick.includes(i + 1)) continue;
    const output = join(outDir, `${id}-${String(i + 1).padStart(2, '0')}.png`);
    await renderStill({ composition, serveUrl, output, frame, imageFormat: 'png' });
    console.log('still', output);
  }
}
