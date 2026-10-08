-- 2026-10-08 보드 룰 영상 (GM 대시보드 [룰 영상] → /defense-board · /mafia-board 전체 화면 재생)
-- 기존 DB에 한 번 실행한다(Supabase SQL Editor). 여러 번 실행해도 안전하다.
--   board_video          : 'defense' | 'mafia' | NULL (재생 중인 영상)
--   board_video_seek_sec : 시작/이동 위치(초)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS board_video TEXT NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS board_video_seek_sec INTEGER NULL;
