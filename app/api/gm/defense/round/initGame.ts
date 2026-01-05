import type {
  DefensePhaseState,
  DefenseMonsterCount,
  Player,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";

type AnyClient = SupabaseClient<any, string, any>;

export async function handleDefenseInitRound(
  supabase: AnyClient,
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

  // 기존 몬스터 인스턴스 정리
  await supabase.from("defense_monster_instance").delete().neq("id", null);

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

    await supabase.from("defense_card_state").delete().neq("player_id", null);
    await supabase.from("defense_card_state").insert(cardRows);

    // 점수: 0포인트로 초기화
    const scoreRows = players.map((p) => ({
      player_id: p.id,
      points: 0,
    }));

    await supabase.from("defense_score").delete().neq("player_id", null);
    await supabase.from("defense_score").insert(scoreRows);
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
    await supabase.from("defense_monster_instance").insert(instancesToInsert);

    // 카운트 반영
    const updatedCounts = DEFENSE_MONSTERS.map((m) => ({
      id: m.id,
      count: countsMap.get(m.id) ?? 0,
    }));
    await supabase.from("defense_monster_count").upsert(updatedCounts, {
      onConflict: "id",
    });
  }
}


