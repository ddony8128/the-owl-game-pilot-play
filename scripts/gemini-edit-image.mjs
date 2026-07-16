// 로컬 전용 유틸: Gemini 이미지 모델로 레퍼런스 이미지를 편집한다.
// 키는 .env.local 의 GEMINI_API_KEY 에서만 읽는다(커밋 금지).
// 사용: node scripts/gemini-edit-image.mjs <inputPng> <promptTxt> <outputPng> [model]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (existsSync(".env.local")) {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("GEMINI_API_KEY="));
    if (line) return line.slice("GEMINI_API_KEY=".length).trim();
  }
  throw new Error("GEMINI_API_KEY 없음(.env.local)");
}

const [, , inputPath, promptPath, outputPath, model = "gemini-3-pro-image"] =
  process.argv;
if (!inputPath || !promptPath || !outputPath) {
  throw new Error("사용법: node gemini-edit-image.mjs <in.png> <prompt.txt> <out.png> [model]");
}

const key = loadKey();
const prompt = readFileSync(promptPath, "utf8");
const imgB64 = readFileSync(inputPath).toString("base64");

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const body = {
  contents: [
    {
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/png", data: imgB64 } },
      ],
    },
  ],
  generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
};

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const t = await res.text();
  throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 800)}`);
}

const json = await res.json();
const parts = json?.candidates?.[0]?.content?.parts ?? [];
const imgPart = parts.find((p) => p.inline_data || p.inlineData);
const textPart = parts.find((p) => p.text);
if (textPart) console.log("[model text]", textPart.text.slice(0, 300));
if (!imgPart) {
  throw new Error(`이미지 파트 없음. 응답: ${JSON.stringify(json).slice(0, 800)}`);
}
const data = (imgPart.inline_data || imgPart.inlineData).data;
writeFileSync(outputPath, Buffer.from(data, "base64"));
console.log("saved:", outputPath);
