-- ============================================================================
-- 게임 플레이 데이터 아카이브 (마피아 / 디펜스)
--
-- 목적: 리플레이 및 밸런스 패치 분석.
--   reset(세션 종료/초기화) 직전에 해당 게임의 모든 런타임·설정 테이블 행을
--   "원본 그대로(JSONB)" 한 판(session) 단위로 적재한다. 컬럼 손실이 없으므로
--   적재된 데이터만으로 한 판을 그대로 재구성(리플레이)하거나 지표를 집계할 수 있다.
--
-- 적용: Supabase SQL Editor 에 이 파일 전체를 한 번 실행하면 된다. (idempotent)
--   적재 로직: lib/admin/reset.ts 의 archiveMafia / archiveDefense
-- ============================================================================

-- 원본 행 보존 테이블 (모든 게임 공용)
create table if not exists game_runtime_archive (
  id           bigserial primary key,
  session_id   uuid        not null,          -- 한 판(아카이브 단위) 식별자
  game         text        not null,          -- 'mafia' | 'defense' | 'subway'
  source_table text        not null,          -- 원본 테이블명 (예: 'mafia_actions')
  row_data     jsonb       not null,          -- 원본 행 전체(모든 컬럼)
  archived_at  timestamptz not null default now()
);

create index if not exists idx_gra_session on game_runtime_archive (session_id);
create index if not exists idx_gra_game_time on game_runtime_archive (game, archived_at desc);
create index if not exists idx_gra_game_table on game_runtime_archive (game, source_table);
-- JSONB 내부 조회(밸런스 분석)를 위한 GIN 인덱스
create index if not exists idx_gra_rowdata on game_runtime_archive using gin (row_data);

-- 세션 헤더 (빠른 목록/요약 조회용)
create table if not exists game_play_sessions (
  session_id   uuid        primary key,
  game         text        not null,
  archived_at  timestamptz not null default now(),
  player_count int,
  summary      jsonb                          -- (선택) 게임별 요약 지표를 후속 채울 수 있음
);

create index if not exists idx_gps_game_time on game_play_sessions (game, archived_at desc);

-- ============================================================================
-- 활용 예시
-- ============================================================================
-- (1) 세션 목록
--   select * from game_play_sessions where game = 'mafia' order by archived_at desc;
--
-- (2) 특정 세션의 한 판 전체 리플레이용 원본 덤프
--   select source_table, row_data
--   from game_runtime_archive
--   where session_id = '<SESSION_UUID>'
--   order by source_table;
--
-- (3) 밸런스 — 마피아 직업별 최종 자산 분포 (player_state 스냅샷 기준)
--   select row_data->>'job' as job,
--          count(*) as n,
--          round(avg((row_data->>'cash')::numeric)) as avg_cash
--   from game_runtime_archive
--   where game = 'mafia' and source_table = 'mafia_player_state'
--   group by 1 order by avg_cash desc;
--
-- (4) 밸런스 — 마피아 주가 시계열 (라운드별 종목 가격)
--   select session_id,
--          row_data->>'stock_key' as stock,
--          row_data->>'round_number' as round,
--          (row_data->>'price')::numeric as price
--   from game_runtime_archive
--   where game = 'mafia' and source_table = 'mafia_stock_history'
--   order by session_id, stock, round;
--
-- (5) 밸런스 — 디펜스 몬스터 출현 빈도
--   select row_data->>'monster_id' as monster, count(*) as appeared
--   from game_runtime_archive
--   where game = 'defense' and source_table = 'defense_monster_instance'
--   group by 1 order by appeared desc;
--
-- 주: row_data 의 키 이름은 각 원본 테이블의 실제 컬럼명을 따른다. 위 예시의
--     'job'/'cash'/'price'/'monster_id' 등은 스키마에 맞게 확인 후 사용할 것.
-- ============================================================================
