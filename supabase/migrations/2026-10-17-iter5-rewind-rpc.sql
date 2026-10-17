-- 2026-10-17 Iteration 5 후속 — 되돌리기를 한 트랜잭션으로(반면교사 1-7: 되돌리기·재시작 뒤 상태 불일치).
-- 운영 DB에 Management API로 적용됨. 여러 번 실행해도 안전(CREATE OR REPLACE).
--
-- 설계: 복원 "계획"(무엇을 지우고 무엇을 어떤 값으로 되돌릴지)은 서버(TS)가 읽어서 세우고,
--       실행은 이 함수가 phase 행을 FOR UPDATE 로 잠근 채 한 트랜잭션으로 한다.
--       잠근 뒤 (1) 포인터가 아직 from 인지 (2) from 단계 제출이 0건인지 다시 확인하므로
--       "되돌리는 사이 들어온 제출"이 반쪽 상태를 만들 수 없다. 중간 오류는 전부 롤백.
-- 권한: service_role 만. anon/authenticated 는 실행 불가(증권가 §37 반면교사).

create or replace function public.gm_defense_rewind_apply(
  p_room text,
  p_from integer,
  p_to integer,
  p_plan jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round bigint;
  v_actions integer;
  v_row jsonb;
  v_restored integer := 0;
  v_despawned integer := 0;
  v_logs integer := 0;
begin
  select round into v_round from defense_phase_state where room_code = p_room for update;
  if v_round is null then
    return jsonb_build_object('ok', false, 'status', 500, 'reason', 'not_found', 'error', 'defense_phase_state가 초기화되지 않았습니다.');
  end if;
  if v_round <> p_from then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'already_advanced',
      'error', '그 사이 라운드가 바뀌어 되돌리지 않았습니다. 화면을 새로 고치세요.');
  end if;
  select count(*) into v_actions from defense_action where room_code = p_room and round = p_from;
  if v_actions > 0 then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'not_rewindable',
      'error', format('이번 라운드에 이미 행동을 제출한 참가자가 %s명 있어 되돌릴 수 없습니다.', v_actions));
  end if;

  -- a. from 라운드 스냅샷 삭제 → from 에 소환된 몬스터 삭제 → 풀(count) 갱신
  delete from defense_monster_snapshot where room_code = p_room and round = p_from;
  delete from defense_monster_instance
    where room_code = p_room
      and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_plan->'despawn_ids', '[]'::jsonb)) x);
  get diagnostics v_despawned = row_count;
  insert into defense_monster_count(room_code, id, count, base_count)
    select p_room, (x->>'id')::integer, (x->>'count')::integer, (x->>'base_count')::integer
    from jsonb_array_elements(coalesce(p_plan->'counts', '[]'::jsonb)) x
  on conflict (room_code, id) do update set count = excluded.count, base_count = excluded.base_count;

  -- b. to 라운드 시작 시점 스냅샷으로 몬스터 복원(처치·도망 포함)
  for v_row in select * from jsonb_array_elements(coalesce(p_plan->'restore_monsters', '[]'::jsonb)) loop
    update defense_monster_instance
      set current_hp = (v_row->>'current_hp')::integer,
          remaining_time = (v_row->>'remaining_time')::integer,
          status = 'active',
          removed_round = null
      where room_code = p_room and id = (v_row->>'instance_id')::uuid;
    v_restored := v_restored + 1;
  end loop;

  -- c. 처치 점수 차감(상대 갱신 — lost update 없음)
  insert into defense_score(room_code, player_id, points)
    select p_room, (x->>'player_id')::uuid, (x->>'delta')::integer
    from jsonb_array_elements(coalesce(p_plan->'score_deltas', '[]'::jsonb)) x
  on conflict (player_id) do update set points = defense_score.points + excluded.points;
  -- c'. 절대값 복원(3→4 취소: 튜토리얼 마지막 스냅샷)
  insert into defense_score(room_code, player_id, points)
    select p_room, (x->>'player_id')::uuid, (x->>'points')::integer
    from jsonb_array_elements(coalesce(p_plan->'scores_set', '[]'::jsonb)) x
  on conflict (player_id) do update set points = excluded.points;
  if (p_plan->>'delete_score_snapshot_round') is not null then
    delete from defense_score_snapshot
      where room_code = p_room and round = (p_plan->>'delete_score_snapshot_round')::integer;
  end if;

  -- d. 도망 페널티 카드 재활성화
  update defense_card_state c set is_active = true
    from jsonb_array_elements(coalesce(p_plan->'reactivate_cards', '[]'::jsonb)) x
    where c.room_code = p_room
      and c.player_id = (x->>'player_id')::uuid
      and c.card_slot = (x->>'slot')::integer;

  -- e. 정산 로그 삭제(제출 시점 로그는 보존)
  delete from defense_player_log
    where id in (select (x #>> '{}')::bigint from jsonb_array_elements(coalesce(p_plan->'delete_log_ids', '[]'::jsonb)) x);
  get diagnostics v_logs = row_count;

  -- f. 0→1 취소: 초기화가 만든 카드/점수/로그를 지운다
  if coalesce((p_plan->>'wipe_init')::boolean, false) then
    delete from defense_card_state where room_code = p_room;
    delete from defense_score where room_code = p_room;
    delete from defense_score_snapshot where room_code = p_room;
    delete from defense_player_log where room_code = p_room;
  end if;

  -- g. 포인터
  update defense_phase_state set round = p_to, updated_at = now() where room_code = p_room;

  return jsonb_build_object('ok', true, 'restored_monsters', v_restored, 'despawned', v_despawned, 'logs', v_logs);
end
$$;

create or replace function public.gm_mafia_rewind_apply(
  p_room text,
  p_round integer,
  p_from text,
  p_to text,
  p_plan jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round integer;
  v_phase text;
  v_sub integer := 0;
  v_deleted integer := 0;
  v_restored integer := 0;
  v_row jsonb;
  v_mode text := coalesce(p_plan->>'mode', 'none');
begin
  select round_number, phase into v_round, v_phase from mafia_phase_state where room_code = p_room for update;
  if v_phase is null then
    return jsonb_build_object('ok', false, 'status', 500, 'reason', 'not_found', 'error', 'mafia_phase_state가 초기화되지 않았습니다.');
  end if;
  if v_phase <> p_from or v_round <> p_round then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'already_advanced',
      'error', '그 사이 페이즈가 바뀌어 되돌리지 않았습니다. 화면을 새로 고치세요.');
  end if;
  if p_from = 'vote' then
    select count(*) into v_sub from mafia_votes where room_code = p_room and round_number = p_round;
  elsif p_from in ('auction', 'trade') then
    select count(*) into v_sub from mafia_actions where room_code = p_room and round_number = p_round and phase = p_from;
  end if;
  if v_sub > 0 then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'not_rewindable',
      'error', format('이 단계에 이미 제출이 %s건 있어 되돌릴 수 없습니다.', v_sub));
  end if;

  if p_from = 'vote' then
    delete from mafia_votes where room_code = p_room and round_number = p_round;
    get diagnostics v_deleted = row_count;
  elsif p_from in ('auction', 'trade') then
    delete from mafia_actions where room_code = p_room and round_number = p_round and phase = p_from;
    get diagnostics v_deleted = row_count;
  end if;

  -- 스냅샷으로 복원: mode = 'assets'(현금·주식) | 'job'(현금·직업·마피아 여부) | 'none'
  for v_row in select * from jsonb_array_elements(coalesce(p_plan->'restore', '[]'::jsonb)) loop
    if v_mode = 'assets' then
      update mafia_player_state
        set cash = coalesce((v_row->>'cash')::integer, 0),
            stocks = nullif(v_row->'stocks', 'null'::jsonb),
            updated_at = now()
        where room_code = p_room and player_id = (v_row->>'player_id')::uuid;
      v_restored := v_restored + 1;
    elsif v_mode = 'job' then
      update mafia_player_state
        set cash = coalesce((v_row->>'cash')::integer, 0),
            job = v_row->>'job',
            is_mafia = coalesce((v_row->>'is_mafia')::boolean, false),
            updated_at = now()
        where room_code = p_room and player_id = (v_row->>'player_id')::uuid;
      v_restored := v_restored + 1;
    end if;
  end loop;

  delete from mafia_player_snapshots
    where id in (select (x #>> '{}')::bigint from jsonb_array_elements(coalesce(p_plan->'delete_snapshot_ids', '[]'::jsonb)) x);

  update mafia_phase_state set phase = p_to, updated_at = now() where room_code = p_room;

  return jsonb_build_object('ok', true, 'restored', v_restored, 'deleted', v_deleted);
end
$$;

revoke all on function public.gm_defense_rewind_apply(text, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.gm_mafia_rewind_apply(text, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.gm_defense_rewind_apply(text, integer, integer, jsonb) to service_role;
grant execute on function public.gm_mafia_rewind_apply(text, integer, text, text, jsonb) to service_role;
notify pgrst, 'reload schema';
