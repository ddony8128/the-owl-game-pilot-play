// 영상에 쓰는 앱 그림의 출처 (Iteration 3). build.mjs가 매번 video/public/<키>/로 복사하고,
// scripts/check-video.mjs가 scenes.ts의 images 목록이 실제 파일인지 확인할 때 같이 쓴다.
//   scenes.ts의 그림 경로 'monster/monster_3.png' → <앱>/public/defense/monster_3.png
export const ASSET_SOURCES = {
  job: { from: 'public/mafia/job', size: null },
  company: { from: 'public/mafia/company', size: 512 },
  monster: { from: 'public/defense', size: 512 },
  shots: {
    from: 'docs/gm-guide/img',
    size: null,
    only: [
      'defense-action.png',
      'mafia-auction.png',
      'mafia-trade.png',
      'mafia-vote.png',
      'mafia-stocks.png',
      'mafia-board.png',
    ],
  },
};
