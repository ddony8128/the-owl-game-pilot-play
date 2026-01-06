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
  rest_slots?: number[] | null;
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
    return NextResponse.json({ error: "invalid nickname" } as ResponseBody, {
      status: 400,
    });
  }

  // 현재 라운드 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("id, round, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as ResponseBody, {
      status: 500,
    });
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
    return NextResponse.json({ error: existingError.message } as ResponseBody, {
      status: 500,
    });
  }

  if (existingAction) {
    return NextResponse.json(
      {
        error: "이미 이번 라운드에 행동을 선택했습니다.",
      } as ResponseBody,
      { status: 400 }
    );
  }

  // 타입별 검증 및 부가 정보 (예: 휴식으로 활성화한 카드 값, 전투에서 사용한 카드 값, 훈련 값)
  let restCardSlotText: string | null = null;
  let usedCardValue: number | null = null;
  let trainingFromValue: number | null = null;
  let trainingToValue: number | null = null;

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
          error:
            "combat 행동에는 target_monster_id와 used_card_slot이 필요합니다.",
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
        {
          error: "선택한 몬스터가 존재하지 않거나 이미 제거되었습니다.",
        } as ResponseBody,
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
      return NextResponse.json({ error: cardError.message } as ResponseBody, {
        status: 500,
      });
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

    // 전투에 사용한 카드는 즉시 비활성화 처리
    usedCardValue = card.card_value;
    await supabase
      .from("defense_card_state")
      .update({ is_active: false })
      .eq("player_id", player.id)
      .eq("card_slot", usedSlot);
  } else if (actionType === "training") {
    const fromSlot =
      typeof body.training_from_slot === "number"
        ? body.training_from_slot
        : null;
    const toSlot =
      typeof body.training_to_slot === "number" ? body.training_to_slot : null;

    if (fromSlot == null || toSlot == null) {
      return NextResponse.json(
        {
          error:
            "training 행동에는 training_from_slot, training_to_slot이 모두 필요합니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }

    // fromSlot: 현재 활성화된 카드만 선택 가능
    const { data: fromCardRow, error: fromCardError } = await supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active")
      .eq("player_id", player.id)
      .eq("card_slot", fromSlot)
      .maybeSingle();

    if (fromCardError) {
      return NextResponse.json(
        { error: fromCardError.message } as ResponseBody,
        { status: 500 }
      );
    }

    const fromCard = (fromCardRow || null) as DefenseCardState | null;
    if (!fromCard || !fromCard.is_active) {
      return NextResponse.json(
        {
          error: "훈련에서 비활성화할 카드는 현재 활성화된 카드여야 합니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }

    // toSlot: 존재하기만 하면 되며, 활성/비활성 무관, fromSlot과 같아도 허용
    const { data: toCardRow, error: toCardError } = await supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active")
      .eq("player_id", player.id)
      .eq("card_slot", toSlot)
      .maybeSingle();

    if (toCardError) {
      return NextResponse.json({ error: toCardError.message } as ResponseBody, {
        status: 500,
      });
    }

    const toCard = (toCardRow || null) as DefenseCardState | null;
    if (!toCard) {
      return NextResponse.json(
        {
          error: "훈련으로 강화할 카드를 찾을 수 없습니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }

    // 훈련 효과를 즉시 적용: from 카드 비활성화 + to 카드 값 +1
    const fromValue = fromCard.card_value;
    const beforeValue = toCard.card_value;
    const afterValue = beforeValue + 1;

    trainingFromValue = fromValue;
    trainingToValue = beforeValue;

    await supabase
      .from("defense_card_state")
      .update({ is_active: false })
      .eq("player_id", player.id)
      .eq("card_slot", fromSlot);

    await supabase
      .from("defense_card_state")
      .update({ card_value: afterValue })
      .eq("player_id", player.id)
      .eq("card_slot", toSlot);

    await supabase.from("defense_player_log").insert({
      player_id: player.id,
      round: currentRound,
      log: `훈련: 값 ${fromValue} 카드를 비활성화하고 값 ${beforeValue} 카드를 ${afterValue}로 강화했습니다.`,
    });
  } else if (actionType === "rest") {
    const rawSlots = Array.isArray(body.rest_slots) ? body.rest_slots : [];
    const uniqueSlots = Array.from(
      new Set(
        rawSlots.filter(
          (s): s is number => typeof s === "number" && Number.isInteger(s)
        )
      )
    ).slice(0, 3);

    if (uniqueSlots.length === 0) {
      return NextResponse.json(
        {
          error: "휴식으로 활성화할 비활성 카드가 1장 이상 선택되어야 합니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }

    const { data: cardsRows, error: cardsError } = await supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active")
      .eq("player_id", player.id)
      .in("card_slot", uniqueSlots);

    if (cardsError) {
      return NextResponse.json({ error: cardsError.message } as ResponseBody, {
        status: 500,
      });
    }

    const inactiveCards = (cardsRows || [])
      .filter((c) => !c.is_active)
      .slice(0, 3);

    const inactiveSlots = inactiveCards.map((c) => c.card_slot);

    if (inactiveSlots.length === 0) {
      return NextResponse.json(
        {
          error:
            "선택한 카드가 이미 모두 활성화되어 있어 휴식을 적용할 수 없습니다.",
        } as ResponseBody,
        { status: 400 }
      );
    }

    await supabase
      .from("defense_card_state")
      .update({ is_active: true })
      .eq("player_id", player.id)
      .in("card_slot", inactiveSlots);

    const values = inactiveCards.map((c) => c.card_value).sort((a, b) => a - b);
    const valuesLabel = values.join(", ");
    restCardSlotText = values.join(",");

    await supabase.from("defense_player_log").insert({
      player_id: player.id,
      round: currentRound,
      log: `휴식: ${valuesLabel} 카드를 다시 활성화했습니다.`,
    });
  }

  const insertBody = {
    round: currentRound,
    player_id: player.id,
    action_type: actionType,
    target_monster_id:
      actionType === "combat"
        ? (body.target_monster_id as string | null)
        : null,
    used_card_value: actionType === "combat" ? usedCardValue : null,
    training_from: actionType === "training" ? trainingFromValue : null,
    training_to: actionType === "training" ? trainingToValue : null,
    rest_card: actionType === "rest" ? restCardSlotText : null,
  };

  const { error: insertError } = await supabase
    .from("defense_action")
    .insert(insertBody);

  if (insertError) {
    return NextResponse.json({ error: insertError.message } as ResponseBody, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as ResponseBody, { status: 200 });
}
