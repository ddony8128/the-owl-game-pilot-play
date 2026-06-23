import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  DefensePhaseState,
  DefenseMonsterInstance,
  DefenseMonsterCount,
  DefenseCardState,
  DefenseScore,
  DefenseAction,
  DefensePlayerLog,
  Player,
} from "@/lib/types";
import {
  DEFENSE_MONSTERS,
  DEFENSE_MONSTERS_BY_ID,
} from "@/lib/defense/monsters";

type DefenseGlobalStateResponse =
  | {
      round: number | null;
    }
  | { error: string };

type DefensePlayerStateResponse =
  | {
      round: number | null;
      monsters: {
        instanceId: string;
        monsterId: number;
        slotIndex: number;
        currentHp: number;
        remainingTime: number;
        status: string;
        name: string;
        description: string;
        maxHp: number;
        baseTime: number;
        points: number;
        image: string;
      }[];
      cards: {
        cardSlot: number;
        cardValue: number;
        isActive: boolean;
      }[];
      score: number;
      action:
        | {
            round: number;
            actionType: string;
            targetMonsterId: string | null;
            usedCardSlot: number | null;
            trainingFromSlot: number | null;
            trainingToSlot: number | null;
          }
        | null;
      dex: {
        monsterId: number;
        name: string;
        description: string;
        maxHp: number;
        baseTime: number;
        points: number;
        remainingCount: number;
        totalCount: number;
        image: string;
      }[];
      logs: {
        round: number;
        log: string;
        createdAt: string;
      }[];
    }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  const nickname = searchParams.get("nickname");

  if (!room) {
    return NextResponse.json(
      { error: "room 필요" } as DefenseGlobalStateResponse,
      { status: 400 }
    );
  }

  // 닉네임이 없으면 전역 round 값만 반환 (GM/클라이언트 공통)
  if (!nickname) {
    const { data, error } = await supabase
      .from("defense_phase_state")
      .select("room_code, round, updated_at")
      .eq("room_code", room)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message } as DefenseGlobalStateResponse,
        { status: 500 }
      );
    }

    const phase = (data || null) as DefensePhaseState | null;

    return NextResponse.json(
      {
        round: typeof phase?.round === "number" ? phase.round : null,
      } as DefenseGlobalStateResponse,
      { status: 200 }
    );
  }

  // 플레이어 전용 상세 상태
  const playerRes = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerRes.error) {
    return NextResponse.json(
      { error: playerRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (!playerRes.data) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as DefensePlayerStateResponse,
      { status: 403 }
    );
  }

  const player = playerRes.data as Player;

  const [
    phaseRes,
    instancesRes,
    countsRes,
    cardsRes,
    scoreRes,
    actionRes,
    logsRes,
  ] = await Promise.all([
    supabase
      .from("defense_phase_state")
      .select("room_code, round, updated_at")
      .eq("room_code", room)
      .maybeSingle(),
    supabase
      .from("defense_monster_instance")
      .select(
        "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
      )
      .eq("room_code", room)
      .in("status", ["active", "defeated", "expired"]),
    supabase
      .from("defense_monster_count")
      .select("id, count")
      .eq("room_code", room),
    supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active")
      .eq("room_code", room)
      .eq("player_id", player.id),
    supabase
      .from("defense_score")
      .select("player_id, points")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .maybeSingle(),
    supabase
      .from("defense_action")
      .select(
        "round, player_id, action_type, target_monster_id, used_card_value, training_from, training_to"
      )
      .eq("room_code", room)
      .eq("player_id", player.id)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("defense_player_log")
      .select("player_id, round, log, created_at")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .order("round", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (phaseRes.error) {
    return NextResponse.json(
      { error: phaseRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (instancesRes.error) {
    return NextResponse.json(
      { error: instancesRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (countsRes.error) {
    return NextResponse.json(
      { error: countsRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (cardsRes.error) {
    return NextResponse.json(
      { error: cardsRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (scoreRes.error) {
    return NextResponse.json(
      { error: scoreRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (actionRes.error) {
    return NextResponse.json(
      { error: actionRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  if (logsRes.error) {
    return NextResponse.json(
      { error: logsRes.error.message } as DefensePlayerStateResponse,
      { status: 500 }
    );
  }

  const phase = (phaseRes.data || null) as DefensePhaseState | null;
  const round =
    typeof phase?.round === "number" && phase.round >= 0 ? phase.round : null;

  const instances = (instancesRes.data || []) as DefenseMonsterInstance[];
  const counts = (countsRes.data || []) as DefenseMonsterCount[];
  const cards = (cardsRes.data || []) as DefenseCardState[];
  const scoreRow = (scoreRes.data || null) as DefenseScore | null;
  const lastAction = (actionRes.data || null) as DefenseAction | null;
  const logs = (logsRes.data || []) as DefensePlayerLog[];

  const activeMonsters = instances.filter((m) => m.status === "active");

  const monstersForClient = activeMonsters.map((m) => {
    const def = DEFENSE_MONSTERS_BY_ID[m.monster_id] ?? null;
    return {
      instanceId: m.id,
      monsterId: m.monster_id,
      slotIndex: m.slot_index,
      currentHp: m.current_hp,
      remainingTime: m.remaining_time,
      status: m.status,
      name: def?.name ?? `몬스터 ${m.monster_id}`,
      description: def?.description ?? "",
      maxHp: def?.maxHp ?? m.current_hp,
      baseTime: def?.baseTime ?? m.remaining_time,
      points: def?.points ?? 0,
      image: def?.image ?? "",
    };
  });

  const cardsForClient = cards
    .slice()
    .sort((a, b) => a.card_slot - b.card_slot)
    .map((c) => ({
      cardSlot: c.card_slot,
      cardValue: c.card_value,
      isActive: c.is_active,
    }));

  const dex = DEFENSE_MONSTERS.map((m) => {
    const row = counts.find((c) => c.id === m.id);
    return {
      monsterId: m.id,
      name: m.name,
      description: m.description,
      maxHp: m.maxHp,
      baseTime: m.baseTime,
      points: m.points,
      remainingCount: row?.count ?? 0,
      totalCount: m.baseCount,
      image: m.image,
    };
  });

  const logsForClient = logs.map((l) => ({
    round: l.round,
    log: l.log,
    createdAt: l.created_at,
  }));

  const actionForClient = lastAction
    ? {
        round: lastAction.round,
        actionType: lastAction.action_type,
        targetMonsterId: lastAction.target_monster_id,
        usedCardValue: lastAction.used_card_value,
        trainingFrom: lastAction.training_from,
        trainingTo: lastAction.training_to,
      }
    : null;

  return NextResponse.json(
    {
      round,
      monsters: monstersForClient,
      cards: cardsForClient,
      score: scoreRow?.points ?? 0,
      action: actionForClient,
      dex,
      logs: logsForClient,
    } as DefensePlayerStateResponse,
    { status: 200 }
  );
}

