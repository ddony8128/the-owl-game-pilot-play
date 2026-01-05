import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  DefensePhaseState,
  DefenseCardState,
  DefenseMonsterInstance,
  DefenseActionType,
  Player,
} from "@/lib/types";

type Body = {
  nickname?: string;
  action_type?: DefenseActionType;
  target_monster_id?: string | null;
  used_card_slot?: number | null;
  training_from_slot?: number | null;
  training_to_slot?: number | null;
};

type ResponseBody = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as ResponseBody,
      { status: 400 }
    );
  }

  if (!body.action_type) {
    return NextResponse.json(
      { error: "action_type is required" } as ResponseBody,
      { status: 400 }
    );
  }

  const nickname = body.nickname.trim();
  const actionType = body.action_type;

  if (!nickname) {
    return NextResponse.json(
      { error: "invalid nickname" } as ResponseBody,
      { status: 400 }
    );
  }

  // 현재 라운드 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("id, round, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json(
      { error: phaseError.message } as ResponseBody,
      { status: 500 }
    );
  }

  const phase = (phaseRow || null) as DefensePhaseState | null;
  if (!phase) {
    return NextResponse.json(
      { error: "defense_phase_state가 초기화되지 않았습니다." } as ResponseBody,
      { status: 500 }
    );
  }

  const currentRound = phase.round;
  if (currentRound <= 0) {
    return NextResponse.json(
      {
        error:
          "준비 단계에서는 행동을 할 수 없습니다. 튜토리얼 또는 본 게임 라운드에서만 가능합니다.",
      } as ResponseBody,
      { status: 400 }
    );
  }

  // 플레이어 조회
  const playerRes = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerRes.error) {
    return NextResponse.json(
      { error: playerRes.error.message } as ResponseBody,
      { status: 500 }
    );
  }

  if (!playerRes.data) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as ResponseBody,
      { status: 403 }
    );
  }

  const player = playerRes.data as Player;

  // 이미 이번 라운드에 행동을 했는지 확인
  const { data: existingAction, error: existingError } = await supabase
    .from("defense_action")
    .select("round, player_id")
    .eq("round", currentRound)
    .eq("player_id", player.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message } as ResponseBody,
      { status: 500 }
    );
  }

  if (existingAction) {
    return NextResponse.json(
      {
        error: "이미 이번 라운드에 행동을 선택했습니다.",
      } as ResponseBody,
      { status: 400 }
    );
  }

  // 타입별 검증
  if (actionType === "combat") {
    const targetId =
      typeof body.target_monster_id === "string"
        ? body.target_monster_id
        : null;
    const usedSlot =
      typeof body.used_card_slot === "number" ? body.used_card_slot : null;

    if (!targetId || usedSlot == null) {
      return NextResponse.json(
        {
          error: "combat 행동에는 target_monster_id와 used_card_slot이 필요합니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }

    const { data: monsterRow, error: monsterError } = await supabase
      .from("defense_monster_instance")
      .select(
        "id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round"
      )
      .eq("id", targetId)
      .maybeSingle();

    if (monsterError) {
      return NextResponse.json(
        { error: monsterError.message } as ResponseBody,
        { status: 500 }
      );
    }

    const monster = (monsterRow || null) as DefenseMonsterInstance | null;
    if (!monster || monster.status !== "active") {
      return NextResponse.json(
        { error: "선택한 몬스터가 존재하지 않거나 이미 제거되었습니다." } as ResponseBody,
        { status: 400 }
      );
    }

    const { data: cardRow, error: cardError } = await supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active")
      .eq("player_id", player.id)
      .eq("card_slot", usedSlot)
      .maybeSingle();

    if (cardError) {
      return NextResponse.json(
        { error: cardError.message } as ResponseBody,
        { status: 500 }
      );
    }

    const card = (cardRow || null) as DefenseCardState | null;
    if (!card || !card.is_active) {
      return NextResponse.json(
        {
          error:
            "선택한 카드가 존재하지 않거나 이미 비활성화되어 있어 사용할 수 없습니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }
  } else if (actionType === "training") {
    const fromSlot =
      typeof body.training_from_slot === "number"
        ? body.training_from_slot
        : null;
    const toSlot =
      typeof body.training_to_slot === "number"
        ? body.training_to_slot
        : null;

    if (fromSlot == null || toSlot == null || fromSlot === toSlot) {
      return NextResponse.json(
        {
          error:
            "training 행동에는 서로 다른 training_from_slot, training_to_slot이 필요합니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }
  }

  const insertBody = {
    round: currentRound,
    player_id: player.id,
    action_type: actionType,
    target_monster_id:
      actionType === "combat"
        ? (body.target_monster_id as string | null)
        : null,
    used_card_slot:
      actionType === "combat"
        ? (body.used_card_slot as number | null)
        : null,
    training_from_slot:
      actionType === "training"
        ? (body.training_from_slot as number | null)
        : null,
    training_to_slot:
      actionType === "training"
        ? (body.training_to_slot as number | null)
        : null,
  };

  const { error: insertError } = await supabase
    .from("defense_action")
    .insert(insertBody);

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message } as ResponseBody,
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true } as ResponseBody, { status: 200 });
}


