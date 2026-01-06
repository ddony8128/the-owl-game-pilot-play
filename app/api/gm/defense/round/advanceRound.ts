import type {
  DefensePhaseState,
  DefenseAction,
  DefenseCardState,
  DefenseMonsterInstance,
  DefenseMonsterCount,
  DefenseScore,
  Player,
} from "@/lib/types";
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  DEFENSE_MONSTERS,
  DEFENSE_MONSTERS_BY_ID,
} from "@/lib/defense/monsters";
import { randomUUID } from "crypto";

function getRoundLabelForLog(round: number): string {
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 15) {
    const gameRound = round - 3; // 4~15 -> 1~12라운드
    return `${gameRound}라운드`;
  }
  if (round === 16) return "게임 종료";
  return `알 수 없음 (DB round ${round})`;
}

export async function handleDefenseAdvanceRound(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: DefensePhaseState,
  nextRound: number
) {
  // 1. 이번 라운드의 모든 액션/카드/몬스터/점수/플레이어 상태 로드
  const [actionsRes, cardsRes, monstersRes, scoresRes, playersRes] =
    await Promise.all([
      supabase
        .from("defense_action")
        .select(
          "round, player_id, action_type, target_monster_id, used_card_value, training_from, training_to"
        )
        .eq("round", current.round),
      supabase
        .from("defense_card_state")
        .select("player_id, card_slot, card_value, is_active"),
      supabase
        .from("defense_monster_instance")
        .select(
          "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
        ),
      supabase.from("defense_score").select("player_id, points"),
      supabase.from("players").select("id, nickname, created_at"),
    ]);

  if (actionsRes.error) throw new Error(actionsRes.error.message);
  if (cardsRes.error) throw new Error(cardsRes.error.message);
  if (monstersRes.error) throw new Error(monstersRes.error.message);
  if (scoresRes.error) throw new Error(scoresRes.error.message);
  if (playersRes.error) throw new Error(playersRes.error.message);

  const actions = (actionsRes.data || []) as DefenseAction[];
  const cards = (cardsRes.data || []) as DefenseCardState[];
  const monsters = (monstersRes.data || []) as DefenseMonsterInstance[];
  const scores = (scoresRes.data || []) as DefenseScore[];
  const players = (playersRes.data || []) as Player[];

  const scoreMap = new Map<string, number>();
  scores.forEach((s) => {
    scoreMap.set(s.player_id, s.points);
  });

  const cardsByPlayer = new Map<string, DefenseCardState[]>();
  cards.forEach((c) => {
    const arr = cardsByPlayer.get(c.player_id) ?? [];
    arr.push(c);
    cardsByPlayer.set(c.player_id, arr);
  });

  const monstersById = new Map<string, DefenseMonsterInstance>();
  monsters.forEach((m) => {
    monstersById.set(m.id, m);
  });

  const playerById = new Map<string, Player>();
  players.forEach((p) => playerById.set(p.id, p));

  // 2. 액션 처리: 휴식/훈련/전투
  // 2-1. 휴식
  // - 휴식 효과(비활성 카드 최대 3장 활성화)는 /api/defense/action에서 즉시 적용된다.
  // - 여기서는 자동 휴식 처리나 추가 카드 변경을 하지 않는다.

  // 2-2. 전투: 몬스터별로 피해량 합산 후 처리
  const combatActions = actions.filter(
    (a) => a.action_type === "combat" && a.target_monster_id
  );

  type CombatEntry = {
    player_id: string;
    card_value: number;
  };

  const combatsByMonster = new Map<string, CombatEntry[]>();

  for (const a of combatActions) {
    const monsterId = a.target_monster_id as string;
    if (!monsterId) continue;
    if (typeof a.used_card_value !== "number") continue;

    const list = combatsByMonster.get(monsterId) ?? [];
    list.push({
      player_id: a.player_id,
      card_value: a.used_card_value,
    });
    combatsByMonster.set(monsterId, list);
  }

  for (const [monsterId, entries] of combatsByMonster.entries()) {
    const monster = monstersById.get(monsterId);
    if (!monster || monster.status !== "active") continue;

    const totalDamage = entries.reduce((sum, e) => sum + e.card_value, 0);

    const def = DEFENSE_MONSTERS_BY_ID[monster.monster_id] ?? null;
    const beforeHp = monster.current_hp;
    const afterHp = Math.max(0, beforeHp - totalDamage);
    const defeated = totalDamage >= beforeHp;

    const participantIds = new Set(entries.map((e) => e.player_id));

    if (defeated) {
      // 몬스터 제거 및 점수 분배
      await supabase
        .from("defense_monster_instance")
        .update({
          status: "defeated",
          current_hp: 0,
          removed_round: current.round,
        })
        .eq("id", monsterId);

      const points = def?.points ?? 0;
      const n = entries.length;
      const perPlayer = n > 0 ? Math.floor(points / n) : 0;

      if (perPlayer > 0) {
        for (const e of entries) {
          const prev = scoreMap.get(e.player_id) ?? 0;
          const next = prev + perPlayer;
          scoreMap.set(e.player_id, next);

          await supabase.from("defense_score").upsert(
            {
              player_id: e.player_id,
              points: next,
            } as DefenseScore,
            { onConflict: "player_id" }
          );

          await supabase.from("defense_player_log").insert({
            player_id: e.player_id,
            round: current.round,
            log: `전투: ${
              def?.name ?? `몬스터 ${monster.monster_id}`
            } 처치에 참여해, 총 ${n}명이 나누어 1인당 ${perPlayer}점을 획득했습니다.`,
          });
        }
      } else {
        for (const e of entries) {
          await supabase.from("defense_player_log").insert({
            player_id: e.player_id,
            round: current.round,
            log: `전투: ${
              def?.name ?? `몬스터 ${monster.monster_id}`
            } 처치에 참여했지만, 분배 가능한 점수가 없어 포인트는 얻지 못했습니다.`,
          });
        }
      }

      // 참여하지 않은 플레이어에게도 몬스터 처치 결과 로그 제공 (개인 전투 로그와 명확히 구분되도록 '전투:' 접두사는 붙이지 않음)
      for (const p of players) {
        if (participantIds.has(p.id)) continue;
        await supabase.from("defense_player_log").insert({
          player_id: p.id,
          round: current.round,
          log: `${def?.name ?? `몬스터 ${monster.monster_id}`}이(가) 쓰러졌습니다.`,
        });
      }
    } else {
      await supabase
        .from("defense_monster_instance")
        .update({ current_hp: afterHp })
        .eq("id", monsterId);

      // 전투에 참여한 플레이어들: 지금처럼 상세 피해 로그 유지
      for (const e of entries) {
        await supabase.from("defense_player_log").insert({
          player_id: e.player_id,
          round: current.round,
          log: `전투: ${
            def?.name ?? `몬스터 ${monster.monster_id}`
          }에게 총 ${totalDamage} 피해를 입혔습니다. (남은 HP: ${afterHp})`,
        });
      }

      // 참여하지 않은 플레이어에게도 해당 몬스터의 피해 결과 로그 제공 (개인 전투 로그와 구분되도록 '전투:' 접두사 없이)
      for (const p of players) {
        if (participantIds.has(p.id)) continue;
        await supabase.from("defense_player_log").insert({
          player_id: p.id,
          round: current.round,
          log: `${def?.name ?? `몬스터 ${monster.monster_id}`}이(가) 이번 라운드에 총 ${totalDamage} 피해를 입고 남은 HP가 ${afterHp}가 되었습니다.`,
        });
      }
    }
  }

  // 3. 몬스터 잔여 시간 감소 및 만료 처리
  const activeAfterCombatRes = await supabase
    .from("defense_monster_instance")
    .select(
      "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
    )
    .eq("status", "active");

  if (activeAfterCombatRes.error) {
    throw new Error(activeAfterCombatRes.error.message);
  }

  const activeAfterCombat = (activeAfterCombatRes.data ||
    []) as DefenseMonsterInstance[];

  const expiredMonsters: DefenseMonsterInstance[] = [];

  for (const m of activeAfterCombat) {
    const newTime = m.remaining_time - 1;
    if (newTime <= 0) {
      expiredMonsters.push(m);
      await supabase
        .from("defense_monster_instance")
        .update({
          remaining_time: 0,
          status: "expired",
          removed_round: current.round,
        })
        .eq("id", m.id);
    } else {
      await supabase
        .from("defense_monster_instance")
        .update({ remaining_time: newTime })
        .eq("id", m.id);
    }
  }

  // 만료된 몬스터가 하나라도 있다면, 모든 플레이어의 가장 큰 활성 카드 하나만 비활성화
  if (expiredMonsters.length > 0) {
    // 대표 몬스터 하나를 로그에 사용 (이 라운드에 도망친 몬스터가 있다는 의미만 전달)
    const firstExpired = expiredMonsters[0];
    const def = DEFENSE_MONSTERS_BY_ID[firstExpired.monster_id] ?? null;

    for (const p of players) {
      const playerCardsRes = await supabase
        .from("defense_card_state")
        .select("player_id, card_slot, card_value, is_active")
        .eq("player_id", p.id)
        .eq("is_active", true)
        .order("card_value", { ascending: false })
        .order("card_slot", { ascending: false })
        .limit(1);

      if (playerCardsRes.error) {
        throw new Error(playerCardsRes.error.message);
      }

      const biggest = (playerCardsRes.data || []) as DefenseCardState[];
      if (biggest.length === 0) continue;

      const card = biggest[0];
      const value = card.card_value;
      await supabase
        .from("defense_card_state")
        .update({ is_active: false })
        .eq("player_id", card.player_id)
        .eq("card_slot", card.card_slot);

      await supabase.from("defense_player_log").insert({
        player_id: card.player_id,
        round: current.round,
        log: `${
          def?.name ?? `몬스터 ${firstExpired.monster_id}`
        }의 시간이 만료되어, 가장 큰 활성 카드(값 ${value})가 비활성화되었습니다.`,
      });
    }
  }

  // 4. 대기열 빈 슬롯에 새 몬스터 소환 (count를 고려)
  const countsRes = await supabase
    .from("defense_monster_count")
    .select("id, count");
  if (countsRes.error) throw new Error(countsRes.error.message);
  const counts = (countsRes.data || []) as DefenseMonsterCount[];
  const countsMap = new Map<number, number>();
  counts.forEach((c) => countsMap.set(c.id, c.count));

  const activeNowRes = await supabase
    .from("defense_monster_instance")
    .select(
      "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
    )
    .eq("status", "active");
  if (activeNowRes.error) throw new Error(activeNowRes.error.message);
  const activeNow = (activeNowRes.data || []) as DefenseMonsterInstance[];

  const activeBySlot = new Map<number, DefenseMonsterInstance>();
  const existingMonsterTypes = new Set<number>();
  activeNow.forEach((m) => {
    activeBySlot.set(m.slot_index, m);
    existingMonsterTypes.add(m.monster_id);
  });

  const newInstances: {
    id: string;
    monster_id: number;
    current_hp: number;
    remaining_time: number;
    slot_index: number;
    status: string;
    spawned_round: number;
  }[] = [];

  const newlyChosenTypes = new Set<number>();

  for (let slot = 0; slot < 4; slot += 1) {
    if (activeBySlot.has(slot)) continue;

    const forbidden = new Set<number>([
      ...existingMonsterTypes,
      ...newlyChosenTypes,
    ]);

    let pool = DEFENSE_MONSTERS.filter(
      (m) => (countsMap.get(m.id) ?? 0) > 0 && !forbidden.has(m.id)
    );

    // 남은 겹치지 않는 몬스터가 없다면, 단순히 남은 몬스터 중에서 선택
    if (pool.length === 0) {
      pool = DEFENSE_MONSTERS.filter((m) => (countsMap.get(m.id) ?? 0) > 0);
    }

    if (pool.length === 0) break;

    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? null;
    if (!chosen) break;

    newInstances.push({
      id: randomUUID(),
      monster_id: chosen.id,
      current_hp: chosen.maxHp,
      remaining_time: chosen.baseTime,
      slot_index: slot,
      status: "active",
      spawned_round: nextRound,
    });
    countsMap.set(chosen.id, (countsMap.get(chosen.id) ?? 0) - 1);
    newlyChosenTypes.add(chosen.id);
  }

  if (newInstances.length > 0) {
    const { error: insertError } = await supabase
      .from("defense_monster_instance")
      .insert(newInstances);

    if (insertError) {
      throw new Error(insertError.message);
    }

    const updatedCounts = DEFENSE_MONSTERS.map((m) => ({
      id: m.id,
      count: countsMap.get(m.id) ?? 0,
    }));

    const { error: updateCountsError } = await supabase
      .from("defense_monster_count")
      .upsert(updatedCounts, {
        onConflict: "id",
      });

    if (updateCountsError) {
      throw new Error(updateCountsError.message);
    }
  }

  // 5. 점수/몬스터 스냅샷 저장 (현재 라운드 기준)
  const finalScoresRes = await supabase
    .from("defense_score")
    .select("player_id, points");
  if (finalScoresRes.error) throw new Error(finalScoresRes.error.message);
  const finalScores = (finalScoresRes.data || []) as DefenseScore[];

  if (finalScores.length > 0) {
    await supabase.from("defense_score_snapshot").insert(
      finalScores.map((s) => ({
        player_id: s.player_id,
        round: current.round,
        points: s.points,
      }))
    );
  }

  // 5-2. 다음 라운드 시작 시점의 몬스터 스냅샷 저장 (nextRound 기준)
  const nextMonstersRes = await supabase
    .from("defense_monster_instance")
    .select(
      "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
    )
    .eq("status", "active");

  if (nextMonstersRes.error) {
    throw new Error(nextMonstersRes.error.message);
  }

  const nextMonsters =
    (nextMonstersRes.data || []) as DefenseMonsterInstance[];

  if (nextMonsters.length > 0) {
    await supabase.from("defense_monster_snapshot").insert(
      nextMonsters.map((m) => ({
        instance_id: m.id,
        monster_id: m.monster_id,
        round: nextRound,
        current_hp: m.current_hp,
        remaining_time: m.remaining_time,
        slot_index: m.slot_index,
      }))
    );
  }
}
