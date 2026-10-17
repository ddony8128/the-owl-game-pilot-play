-- 디펜스 공용 화면을 방별로 GM이 제어하기 위한 최소 상태입니다.
ALTER TABLE defense_phase_state
  ADD COLUMN IF NOT EXISTS board_view TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS board_round BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS board_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE defense_phase_state
SET board_round = COALESCE(round, 0)
WHERE board_round = 0 AND COALESCE(round, 0) > 0;

