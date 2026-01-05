import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  DefenseMonsterSnapshot,
  DefenseAction,
  DefenseCardState,
  DefenseScoreSnapshot,
  DefenseMonsterCount,
  Player,
} from "@/lib/types";
import { DEFENSE_MONSTERS, DEFENSE_MONSTERS_BY_ID } from "@/lib/defense/monsters";

type RoundStateResponse =
  | {
      round: number;
      players: {
        player_id: string;
        nickname: string | null;
        action:
          | {
              type: string;
              targetMonsterName?: string | null;
              usedCardValue?: number | null;
              trainingFromValue?: number | null;
              trainingToBeforeValue?: number | null;
              trainingToAfterValue?: number | null;
            }
          | null;
        score: number | null;
      }[];
      monsters: {
        instance_id: string;
        monster_id: number;
        name: string;
        description: string;
        slot_index: number;
        current_hp: number;
        remaining_time: number;
        points: number;
        attackers: {
          player_id: string;
          nickname: string | null;
          usedCardSlot: number | null;
          usedCardValue: number | null;
        }[];
      }[];
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const roundParam = searchParams.get("round");
  const round = roundParam ? Number(roundParam) : NaN;

  if (!Number.isInteger(round) || round < 1 || round > 12) {
    return NextResponse.json(
      { error: "round must be an integer between 1 and 12" } as RoundStateResponse,
      { status: 400 }
    );
  }

  // 플레이어 기본 정보
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, created_at");

  if (playersError) {
    return NextResponse.json(
      { error: playersError.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  const players = (playerRows || []) as Player[];
  const nicknameById = new Map<string, string | null>();
  players.forEach((p) => nicknameById.set(p.id, p.nickname));

  const [
    monstersSnapRes,
    actionsRes,
    cardsRes,
    scoresSnapRes,
  ] = await Promise.all([
    supabase
      .from("defense_monster_snapshot")
      .select("instance_id, monster_id, round, current_hp, remaining_time, slot_index")
      .eq("round", round),
    supabase
      .from("defense_action")
      .select(
        "round, player_id, action_type, target_monster_id, used_card_slot, training_from_slot, training_to_slot"
      )
      .eq("round", round),
    supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active"),
    supabase
      .from("defense_score_snapshot")
      .select("player_id, round, points")
      .eq("round", round),
  ]);

  if (monstersSnapRes.error) {
    return NextResponse.json(
      { error: monstersSnapRes.error.message } as RoundStateResponse,
      { status: 500 }
    );
  }
  if (actionsRes.error) {
    return NextResponse.json(
      { error: actionsRes.error.message } as RoundStateResponse,
      { status: 500 }
    );
  }
  if (cardsRes.error) {
    return NextResponse.json(
      { error: cardsRes.error.message } as RoundStateResponse,
      { status: 500 }
    );
  }
  if (scoresSnapRes.error) {
    return NextResponse.json(
      { error: scoresSnapRes.error.message } as RoundStateResponse,
      { status: 500 }
    );
  }

  const monstersSnap =
    (monstersSnapRes.data || []) as DefenseMonsterSnapshot[];
  const actions = (actionsRes.data || []) as DefenseAction[];
  const cards = (cardsRes.data || []) as DefenseCardState[];
  const scoresSnap =
    (scoresSnapRes.data || []) as DefenseScoreSnapshot[];

  const cardsByPlayer = new Map<string, DefenseCardState[]>();
  cards.forEach((c) => {
    const arr = cardsByPlayer.get(c.player_id) ?? [];
    arr.push(c);
    cardsByPlayer.set(c.player_id, arr);
  });

  const scoreByPlayer = new Map<string, number>();
  scoresSnap.forEach((s) => {
    scoreByPlayer.set(s.player_id, s.points);
  });

  // 플레이어별 행동 요약
  const actionByPlayer = new Map<
    string,
    {
      type: string;
      targetMonsterName?: string | null;
      usedCardValue?: number | null;
      trainingFromValue?: number | null;
      trainingToBeforeValue?: number | null;
      trainingToAfterValue?: number | null;
    }
  >();

  for (const a of actions) {
    const base = { type: a.action_type } as {
      type: string;
      targetMonsterName?: string | null;
      usedCardValue?: number | null;
      trainingFromValue?: number | null;
      trainingToBeforeValue?: number | null;
      trainingToAfterValue?: number | null;
    };

    const playerCards = cardsByPlayer.get(a.player_id) ?? [];

    if (a.action_type === "combat") {
      const def =
        a.target_monster_id && monstersSnap.find((m) => m.instance_id === a.target_monster_id)
          ? DEFENSE_MONSTERS_BY_ID[
              monstersSnap.find((m) => m.instance_id === a.target_monster_id)!.monster_id
            ] ?? null
          : null;
      const usedCard =
        a.used_card_slot != null
          ? playerCards.find((c) => c.card_slot === a.used_card_slot) ?? null
          : null;
      base.targetMonsterName = def?.name ?? null;
      base.usedCardValue = usedCard?.card_value ?? null;
    } else if (a.action_type === "training") {
      const fromCard =
        a.training_from_slot != null
          ? playerCards.find((c) => c.card_slot === a.training_from_slot) ?? null
          : null;
      const toCard =
        a.training_to_slot != null
          ? playerCards.find((c) => c.card_slot === a.training_to_slot) ?? null
          : null;
      if (fromCard) {
        base.trainingFromValue = fromCard.card_value;
      }
      if (toCard) {
        base.trainingToBeforeValue = toCard.card_value;
        base.trainingToAfterValue = toCard.card_value + 1;
      }
    }

    actionByPlayer.set(a.player_id, base);
  }

  // 몬스터별 공격자 목록
  type Attacker = {
    player_id: string;
    nickname: string | null;
    usedCardSlot: number | null;
    usedCardValue: number | null;
  };

  const attackersByInstance = new Map<string, Attacker[]>();

  for (const a of actions) {
    if (a.action_type !== "combat" || !a.target_monster_id) continue;
    const playerCards = cardsByPlayer.get(a.player_id) ?? [];
    const usedCard =
      a.used_card_slot != null
        ? playerCards.find((c) => c.card_slot === a.used_card_slot) ?? null
        : null;

    const arr = attackersByInstance.get(a.target_monster_id) ?? [];
    arr.push({
      player_id: a.player_id,
      nickname: nicknameById.get(a.player_id) ?? null,
      usedCardSlot: a.used_card_slot ?? null,
      usedCardValue: usedCard?.card_value ?? null,
    });
    attackersByInstance.set(a.target_monster_id, arr);
  }

  const monstersForClient = monstersSnap.map((m) => {
    const def = DEFENSE_MONSTERS_BY_ID[m.monster_id] ?? null;
    return {
      instance_id: m.instance_id,
      monster_id: m.monster_id,
      name: def?.name ?? `몬스터 ${m.monster_id}`,
      description: def?.description ?? "",
      slot_index: m.slot_index,
      current_hp: m.current_hp,
      remaining_time: m.remaining_time,
      points: def?.points ?? 0,
      attackers: attackersByInstance.get(m.instance_id) ?? [],
    };
  });

  const playersForClient = players.map((p) => ({
    player_id: p.id,
    nickname: p.nickname ?? null,
    action: actionByPlayer.get(p.id) ?? null,
    score: scoreByPlayer.get(p.id) ?? null,
  }));

  return NextResponse.json(
    {
      round,
      players: playersForClient,
      monsters: monstersForClient,
    } as RoundStateResponse,
    { status: 200 }
  );
}


