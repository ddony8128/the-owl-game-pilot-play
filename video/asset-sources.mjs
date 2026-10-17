// 영상에 쓰는 앱 그림의 출처 (Iteration 3). build.mjs가 매번 video/public/<키>/로 복사하고,
// scripts/check-video.mjs가 scenes.ts의 images 목록이 실제 파일인지 확인할 때 같이 쓴다.
//   scenes.ts의 그림 경로 'monster/monster_3.png' → <앱>/public/defense/monster_3.png
export const ASSET_SOURCES = {
  job: { from: 'public/mafia/job', size: null },
  company: { from: 'public/mafia/company', size: 512 },
  monster: { from: 'public/defense', size: 512 },
  // Iteration 4(2026-10-17 또니) — 휴대폰 화면 캡처(shots)는 영상에 쓰지 않는다. 배경 그림은
  // video/assets/bg/(gen-bg.mjs 생성·커밋)에서 build.mjs가 public/bg/로 복사한다.
};
