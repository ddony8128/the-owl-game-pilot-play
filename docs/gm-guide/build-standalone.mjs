// GM 가이드 HTML 의 <img src="img/...png"> 를 base64 data URI 로 인라인해
// 단일 파일(.html 하나만 전달 가능)로 만든다. → docs/gm-guide/dist/<name>.html
//
// 실행: node docs/gm-guide/build-standalone.mjs   (boot-camp-web 루트에서)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

const ROOT = "docs/gm-guide";
const IMG = join(ROOT, "img");
const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const htmls = readdirSync(ROOT).filter(
  (f) => f.endsWith(".html") && f !== "build-standalone.mjs",
);

for (const file of htmls) {
  let html = readFileSync(join(ROOT, file), "utf8");
  html = html.replace(/src="img\/([^"]+)"/g, (m, name) => {
    const p = join(IMG, name);
    if (!existsSync(p)) {
      console.warn("  ! 이미지 없음:", name);
      return m;
    }
    const b64 = readFileSync(p).toString("base64");
    return `src="data:image/png;base64,${b64}"`;
  });
  const out = join(DIST, file);
  writeFileSync(out, html, "utf8");
  console.log("생성:", out, `(${Math.round(html.length / 1024)} KB)`);
}
