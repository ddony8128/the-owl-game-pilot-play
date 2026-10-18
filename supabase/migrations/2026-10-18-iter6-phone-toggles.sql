-- 2026-10-18 ITER6 B5·C5 — 참가자 폰 편의 기능 토글(GM 대시보드 준비 단계 스위치, 기본 켜짐).
--   phone_logs            : 폰 로그 탭 보이기(마피아·디펜스)
--   phone_remaining_count : 디펜스 몬스터 도감의 '남은 수' 보이기
-- 운영 DB에는 2026-10-18 14:20 Management API로 이미 적용됨 — 다른 환경용. 여러 번 실행해도 안전하다.
-- 컬럼이 없어도 앱은 500을 내지 않는다(조회 실패 시 true 취급, 토글 저장만 503 안내).
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS phone_logs BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS phone_remaining_count BOOLEAN NOT NULL DEFAULT true;
