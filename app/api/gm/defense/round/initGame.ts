import type {
  DefensePhaseState,
  DefenseMonsterCount,
  Player,
} from "@/lib/types";
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";
import { randomUUID } from "crypto";

export async function handleDefenseInitRound(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: DefensePhaseState,
  nextRound: number
) {
  // 몬스터 카운트 초기화 (각 4마리)
  const initialCounts: DefenseMonsterCount[] = DEFENSE_MONSTERS.map((m) => ({
    id: m.id,
    count: 4,
  }));

  await supabase.from("defense_monster_count").upsert(initialCounts, {
    onConflict: "id",
  });

  // 기존 몬스터 인스턴스 정리:
  // 현재 active 상태인 몬스터들은 모두 expired 처리하여 기록을 남긴다.
  const { error: expireError } = await supabase
    .from("defense_monster_instance")
    .update({
      status: "expired",
      remaining_time: 0,
      removed_round: current.round,
    })
    .eq("status", "active");

  if (expireError) {
    throw new Error(expireError.message);
  }

  // 플레이어 목록 조회
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, created_at");

  if (playersError) {
    throw new Error(playersError.message);
  }

  const players = (playerRows || []) as Player[];

  // 카드/점수 초기화
  if (players.length > 0) {
    // 카드: 1,2,3,4 모두 활성
    const cardRows: {
      player_id: string;
      card_slot: number;
      card_value: number;
      is_active: boolean;
    }[] = [];

    for (const p of players) {
      for (let slot = 1; slot <= 4; slot += 1) {
        cardRows.push({
          player_id: p.id,
          card_slot: slot,
          card_value: slot,
          is_active: true,
        });
      }
    }

    // 전체 카드 상태 리셋 (Supabase는 WHERE 없는 delete를 막으므로 항상 true인 조건 사용)
    const { error: deleteCardsError } = await supabase
      .from("defense_card_state")
      .delete()
      .neq("player_id", "00000000-0000-0000-0000-000000000000");
    if (deleteCardsError) {
      throw new Error(deleteCardsError.message);
    }

    const { error: insertCardsError } = await supabase
      .from("defense_card_state")
      .insert(cardRows);
    if (insertCardsError) {
      throw new Error(insertCardsError.message);
    }

    // 점수: 0포인트로 초기화
    const scoreRows = players.map((p) => ({
      player_id: p.id,
      points: 0,
    }));

    // 전체 점수 리셋
    const { error: deleteScoresError } = await supabase
      .from("defense_score")
      .delete()
      .neq("player_id", "00000000-0000-0000-0000-000000000000");
    if (deleteScoresError) {
      throw new Error(deleteScoresError.message);
    }

    const { error: insertScoresError } = await supabase
      .from("defense_score")
      .insert(scoreRows);
    if (insertScoresError) {
      throw new Error(insertScoresError.message);
    }
  }

  // 초기 몬스터 인스턴스 4개 생성 (대기열 0~3)
  const { data: countsRows, error: countsError } = await supabase
    .from("defense_monster_count")
    .select("id, count");

  if (countsError) {
    throw new Error(countsError.message);
  }

  const counts = (countsRows || []) as DefenseMonsterCount[];
  const countsMap = new Map<number, number>();
  counts.forEach((c) => countsMap.set(c.id, c.count));

  const instancesToInsert: {
    id: string;
    monster_id: number;
    current_hp: number;
    remaining_time: number;
    slot_index: number;
    status: string;
    spawned_round: number;
  }[] = [];

  for (let slot = 0; slot < 4; slot += 1) {
    const available = DEFENSE_MONSTERS.filter(
      (m) => (countsMap.get(m.id) ?? 0) > 0
    );
    if (available.length === 0) break;

    const chosen =
      available[Math.floor(Math.random() * available.length)] ?? null;
    if (!chosen) break;

    instancesToInsert.push({
      id: randomUUID(),
      monster_id: chosen.id,
      current_hp: chosen.maxHp,
      remaining_time: chosen.baseTime,
      slot_index: slot,
      status: "active",
      spawned_round: nextRound,
    });
    countsMap.set(chosen.id, (countsMap.get(chosen.id) ?? 0) - 1);
  }

  if (instancesToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("defense_monster_instance")
      .insert(instancesToInsert);

    if (insertError) {
      throw new Error(insertError.message);
    }

    // 카운트 반영
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
}
