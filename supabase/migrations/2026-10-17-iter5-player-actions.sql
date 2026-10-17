-- 2026-10-17 Iteration 5 WS-B — 참가자 폰 행동 API 안정화 (ADD만, 옛 코드와 호환)
-- 기존 DB에 한 번 실행한다(Supabase SQL Editor 또는 Management API). 여러 번 실행해도 안전하다.
--
-- defense_action
--   used_card_slot : 전투에 쓴 카드 칸(값이 아니라 칸). 라운드 마감과 겹쳐 정산에서 빠진 전투를 되돌릴 때 쓴다.
--   cards_before   : 행동 제출 직전의 내 카드 상태 [{cardSlot, cardValue, isActive}] — 행동 변경(덮어쓰기) 시 이전 행동의 부수효과를 되돌리는 기준.
--   (room_code, round, player_id) 유니크 — 한 라운드에 한 사람의 행동은 한 행만 존재(덮어쓰기 upsert·동시 제출 23505).
ALTER TABLE public.defense_action ADD COLUMN IF NOT EXISTS used_card_slot INTEGER NULL;
ALTER TABLE public.defense_action ADD COLUMN IF NOT EXISTS cards_before JSONB NULL;
CREATE UNIQUE INDEX IF NOT EXISTS defense_action_room_round_player_key
  ON public.defense_action (room_code, round, player_id);

-- mafia_votes.request_id : 폰이 보낸 requestId. 응답 유실 뒤 재전송이 두 번 집계되지 않게 한다.
ALTER TABLE public.mafia_votes ADD COLUMN IF NOT EXISTS request_id TEXT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mafia_votes_request_key
  ON public.mafia_votes (room_code, voter_id, request_id) WHERE request_id IS NOT NULL;

-- mafia_actions.payload->>'request_id' : 매수/매도/베팅/능력의 requestId(payload 안).
CREATE UNIQUE INDEX IF NOT EXISTS mafia_actions_request_key
  ON public.mafia_actions (room_code, player_id, (payload->>'request_id')) WHERE (payload->>'request_id') IS NOT NULL;

-- 베팅·능력은 라운드/페이즈당 1회 — 동시 제출(check-then-insert 경쟁)이 두 행을 만들지 못하게 한다.
CREATE UNIQUE INDEX IF NOT EXISTS mafia_actions_once_per_phase_key
  ON public.mafia_actions (room_code, player_id, round_number, phase, action_type) WHERE action_type IN ('bet','ability');

NOTIFY pgrst, 'reload schema';
