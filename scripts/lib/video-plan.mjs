// 룰 영상 정본(video/rule-video-plan-v1.md) 파서.
// 편: "## 2. 대본 ①" = defense, "## 3. 대본 ②" = mafia. 장면: "### S<n> ..." 블록.
//   chapter   = 제목의 "[장: X]"
//   screen    = "화면:" 줄부터 "나레이션:" 직전까지의 「」 안 글자 목록
//   narration = "나레이션:" 뒤부터 다음 빈 줄/제목까지(줄바꿈 유지)
// 장 목록(1.3) = "- 디펜스: a / b / ..." · "- 마피아: ..."
import { readFileSync } from 'node:fs';

export function parseVideoPlan(path) {
  const md = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const lines = md.split('\n');
  const out = { defense: [], mafia: [], chapters: { defense: [], mafia: [] } };
  let cur = null;
  let scene = null;
  let mode = null;
  for (const line of lines) {
    const ch = /^- (디펜스|마피아): (.+)$/.exec(line);
    if (ch && !cur) {
      const k = ch[1] === '디펜스' ? 'defense' : 'mafia';
      // 1.3의 첫 목록만 장 목록이다(뒤의 "5. 수치 출처"에도 같은 머리말이 있다).
      if (out.chapters[k].length === 0) out.chapters[k] = ch[2].split(' / ').map((s) => s.trim());
      continue;
    }
    if (line.startsWith('## ')) {
      cur = line.includes('대본 ①') ? 'defense' : line.includes('대본 ②') ? 'mafia' : null;
      scene = null;
      mode = null;
      continue;
    }
    if (!cur) continue;
    const h = /^### (S\d+) (.*)$/.exec(line);
    if (h) {
      const chapter = /\[장: ([^\]]+)\]/.exec(h[2])?.[1] ?? null;
      scene = { id: h[1], heading: h[2], chapter, screen: [], narration: '' };
      out[cur].push(scene);
      mode = null;
      continue;
    }
    if (!scene) continue;
    if (line.startsWith('화면:')) mode = 'screen';
    if (line.startsWith('나레이션:')) {
      mode = 'narration';
      scene.narration = line.slice('나레이션:'.length).trim();
      continue;
    }
    if (mode === 'screen') {
      for (const m of line.matchAll(/「([^」]*)」/g)) scene.screen.push(m[1]);
    } else if (mode === 'narration') {
      if (line.trim() === '' || line.startsWith('---')) mode = null;
      else scene.narration += '\n' + line;
    }
  }
  return out;
}
