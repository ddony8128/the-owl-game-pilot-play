-- ============================================================================
-- 부엉이게임 파일럿 (마피아 / 디펜스) — 전체 초기화 스크립트 (보조용)
--
-- ⚠️ 권장 방식은 GM 메인 대시보드의 "세션 종료 / 다음 팀 준비" 버튼입니다.
--    그 버튼은 직전 판을 아카이브에 보존하고, 주가/페이즈/몬스터 시드까지
--    정확히 재설정합니다. 이 SQL은 그게 불가능한 비상 상황의 보조 수단입니다.
--
-- 이 스크립트는 런타임/명단만 비웁니다. 게임별 시드(주가·페이즈·몬스터 수)는
-- 복원하지 않으므로, 실행 후 반드시 대시보드 "진행 상태만 초기화"를 한 번 눌러
-- 시드를 채워야 게임이 정상 시작됩니다.
--
-- 보존: game_runtime_archive / game_play_sessions / subway_play_records (아카이브)
-- ============================================================================

BEGIN;

-- 런타임(플레이) 데이터 — 자식 → 부모 순서로 비움
TRUNCATE
  subway_player_events, subway_reports, subway_player_state,
  mafia_actions, mafia_player_snapshots, mafia_votes, mafia_public_logs,
  mafia_ability_results, mafia_stock_history, mafia_player_state,
  defense_monster_snapshot, defense_action, defense_card_state,
  defense_score, defense_score_snapshot, defense_player_log,
  defense_monster_instance,
  player_votes
  RESTART IDENTITY CASCADE;

-- 참가자 명단 + GM 메모 (다음 팀 준비). 명단 유지하려면 이 줄을 제외.
TRUNCATE players RESTART IDENTITY CASCADE;
TRUNCATE gm_memos RESTART IDENTITY;

-- 전역 상태 '준비'로, 규칙 전부 닫기 (행 보존)
UPDATE game_state SET active_game = 'ready', timer_start = false,
       timer_start_at = NULL, pause_at = NULL, updated_at = now() WHERE id = 1;
UPDATE rules_state SET is_open = false, updated_at = now();

COMMIT;

-- 실행 후: 대시보드 → "진행 상태만 초기화" 1회 (mafia_stock_state / mafia_phase_state /
-- defense_phase_state / defense_monster_count 등 시드 복원).
