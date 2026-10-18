import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { DefensePhaseState, DefenseCardState, Player } from "@/lib/types";
import { isValidNickname, normalizeNickname } from "@/lib/nickname";
import { isUniqueViolation, requireActiveRoom } from "@/lib/player/roomGuard";
import {
  decideSubmit,
  isDefenseActionType,
  isValidationFailure,
  snapshotCards,
  validateActionAgainstCards,
  type CardSnapshot,
  type ExistingAction,
} from "@/lib/defense/action";

// POST /api/defense/action — 디펜스 행동 제출(낙장불입).
// 계약(ITER6, 2026-10-18 또니): 같은 라운드에 이미 제출한 행동은 바꿀 수 없다.
//  1) 폰이 보고 있던 round 와 서버 round 가 다르면 409 round_mismatch (늦은 화면의 옛 버튼 방지)
//  2) 같은 라운드 기존 행동이 있으면: 같은 내용의 재전송은 멱등 200, 다른 내용은 409 already_submitted
//  3) 저장 직후 라운드가 넘어갔으면(정산과 겹침) 되돌리고 409 round_advanced — 조용한 유실 금지
//  4) 타이머 0 이후도 막지 않는다(소프트 타이머). 종료된 방은 409 room_ended.
//  (되돌리기 rewind 가 "행동 제출 0건"을 조건으로 쓰는 것은 그대로)
type Body = {
  room?: string;
  nickname?: string;
  round?: number;
  action_type?: unknown;
  target_monster_id?: string | null;
  used_card_slot?: number | null;
  training_from_slot?: number | null;
  training_to_slot?: number | null;
  rest_slots?: number[] | null;
};

type Ok = { ok: true; round: number; idempotent?: boolean };
type Err = { error: string; reason?: string };

const err = (status: number, error: string, reason?: string) =>
  NextResponse.json({ error, ...(reason ? { reason } : {}) } as Err, { status });

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) return err(400, "room 필요", "bad_request");
  if (!body || typeof body.nickname !== "string") return err(400, "nickname is required", "bad_request");
  if (!isDefenseActionType(body.action_type)) {
    return err(400, "action_type 은 combat | rest | training 중 하나여야 합니다.", "bad_request");
  }
  const nickname = normalizeNickname(body.nickname);
  if (!isValidNickname(nickname)) return err(400, "invalid nickname", "bad_request");
  if (body.round !== undefined && (typeof body.round !== "number" || !Number.isInteger(body.round))) {
    return err(400, "round 는 정수여야 합니다.", "bad_request");
  }
  const actionType = body.action_type;

  // 종료된 방은 읽기 전용
  const guard = await requireActiveRoom(supabase, room);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  // 현재 라운드
  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("room_code, round, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return err(500, phaseError.message);
  const phase = (phaseRow || null) as DefensePhaseState | null;
  if (!phase) return err(500, "defense_phase_state가 초기화되지 않았습니다.");
  const currentRound = phase.round;

  // 플레이어
  const playerRes = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();
  if (playerRes.error) return err(500, playerRes.error.message);
  if (!playerRes.data) return err(403, "등록되지 않은 닉네임입니다.", "not_registered");
  const player = playerRes.data as Player;

  // 같은 라운드 기존 행동
  const existingRes = await supabase
    .from("defense_action")
    .select("id, action_type, cards_before, used_card_slot, target_monster_id, training_from, training_to, rest_card")
    .eq("room_code", room)
    .eq("round", currentRound)
    .eq("player_id", player.id)
    .maybeSingle();
  if (existingRes.error) return err(500, existingRes.error.message);
  const existing = (existingRes.data || null) as ExistingAction | null;

  const decision = decideSubmit({ serverRound: currentRound, clientRound: body.round, existing, body });
  if (decision.kind === "reject") return err(decision.status, decision.error, decision.reason);
  // 같은 내용의 재전송(응답 유실 뒤 재시도) — 이미 반영됐으므로 아무것도 바꾸지 않고 성공으로 답한다
  if (decision.kind === "idempotent") {
    return NextResponse.json({ ok: true, round: currentRound, idempotent: true } as Ok, { status: 200 });
  }

  // 현재 카드 + 활성 몬스터
  const [cardsRes, monstersRes] = await Promise.all([
    supabase
      .from("defense_card_state")
      .select("player_id, card_slot, card_value, is_active")
      .eq("room_code", room)
      .eq("player_id", player.id),
    supabase.from("defense_monster_instance").select("id").eq("room_code", room).eq("status", "active"),
  ]);
  if (cardsRes.error) return err(500, cardsRes.error.message);
  if (monstersRes.error) return err(500, monstersRes.error.message);
  const currentCards = snapshotCards((cardsRes.data || []) as DefenseCardState[]);
  const activeMonsterIds = new Set(((monstersRes.data || []) as { id: string }[]).map((m) => m.id));

  const baseCards: CardSnapshot = currentCards;
  const validated = validateActionAgainstCards(
    {
      action_type: actionType,
      target_monster_id: body.target_monster_id,
      used_card_slot: body.used_card_slot,
      training_from_slot: body.training_from_slot,
      training_to_slot: body.training_to_slot,
      rest_slots: body.rest_slots,
    },
    baseCards,
    activeMonsterIds,
  );
  if (isValidationFailure(validated)) return err(400, validated.error, "invalid_action");

  // 새 행동의 부수효과를 정확히 되돌리는 함수(동시 제출 경쟁에서 "내 효과만" 거둔다 — 스냅샷 전체 복원은 남의 효과를 덮을 수 있다).
  const undoEffects = async () => {
    if (validated.type === "combat") {
      await supabase
        .from("defense_card_state")
        .update({ is_active: true })
        .eq("room_code", room)
        .eq("player_id", player.id)
        .eq("card_slot", validated.usedSlot);
    } else if (validated.type === "training") {
      await supabase
        .from("defense_card_state")
        .update({ is_active: true })
        .eq("room_code", room)
        .eq("player_id", player.id)
        .eq("card_slot", validated.fromSlot);
      await supabase
        .from("defense_card_state")
        .update({ card_value: validated.toValueBefore })
        .eq("room_code", room)
        .eq("player_id", player.id)
        .eq("card_slot", validated.toSlot);
    } else {
      await supabase
        .from("defense_card_state")
        .update({ is_active: false })
        .eq("room_code", room)
        .eq("player_id", player.id)
        .in("card_slot", validated.slots);
    }
  };

  // 행을 먼저 넣는다(유니크 인덱스가 "같은 사람의 동시 제출"을 한 건만 통과시킨다) → 부수효과는 그 뒤에.
  const cardsBefore: CardSnapshot = baseCards;
  const insertBody = {
    room_code: room,
    round: currentRound,
    player_id: player.id,
    action_type: actionType,
    target_monster_id: validated.type === "combat" ? validated.targetId : null,
    used_card_value: validated.type === "combat" ? validated.usedValue : null,
    used_card_slot: validated.type === "combat" ? validated.usedSlot : null,
    training_from: validated.type === "training" ? validated.fromValue : null,
    training_to: validated.type === "training" ? validated.toValueBefore : null,
    rest_card: validated.type === "rest" ? validated.values.join(",") : null,
    cards_before: cardsBefore,
  };

  const inserted = await supabase.from("defense_action").insert(insertBody).select("id").maybeSingle();
  if (inserted.error) {
    if (isUniqueViolation(inserted.error)) {
      // 같은 사람의 동시 제출 — 먼저 들어간 한 건만 남는다(낙장불입)
      return err(409, "이미 제출한 행동은 바꿀 수 없습니다.", "already_submitted");
    }
    return err(500, inserted.error.message);
  }
  const insertedId = (inserted.data as { id: number }).id;

  // 부수효과 적용(제출 시점 즉시 반영 — 기존 동작 유지)
  if (validated.type === "combat") {
    await supabase
      .from("defense_card_state")
      .update({ is_active: false })
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("card_slot", validated.usedSlot);
  } else if (validated.type === "training") {
    const after = validated.toValueBefore + 1;
    await supabase
      .from("defense_card_state")
      .update({ is_active: false })
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("card_slot", validated.fromSlot);
    await supabase
      .from("defense_card_state")
      .update({ card_value: after })
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("card_slot", validated.toSlot);
    await supabase.from("defense_player_log").insert({
      room_code: room,
      player_id: player.id,
      round: currentRound,
      log: `훈련: 값 ${validated.fromValue} 카드를 비활성화하고 값 ${validated.toValueBefore} 카드를 ${after}로 강화했습니다.`,
    });
  } else {
    await supabase
      .from("defense_card_state")
      .update({ is_active: true })
      .eq("room_code", room)
      .eq("player_id", player.id)
      .in("card_slot", validated.slots);
    await supabase.from("defense_player_log").insert({
      room_code: room,
      player_id: player.id,
      round: currentRound,
      log: `휴식: ${validated.values.join(", ")} 카드를 다시 활성화했습니다.`,
    });
  }

  // 내 행이 그 사이 지워졌으면(되돌리기 등) 내 효과만 거두고 409
  const stillMine = await supabase.from("defense_action").select("id").eq("id", insertedId).maybeSingle();
  if (!stillMine.error && !stillMine.data) {
    await undoEffects();
    return err(409, "다른 제출이 먼저 처리되었습니다. 화면을 확인해 주세요.", "conflict");
  }

  // 저장 직후 라운드가 넘어갔으면(정산과 겹침) 이 행동은 정산에 들어가지 못했다 → 되돌리고 명확히 409
  const after = await supabase
    .from("defense_phase_state")
    .select("round")
    .eq("room_code", room)
    .maybeSingle();
  const afterRound = (after.data as { round?: number } | null)?.round;
  if (typeof afterRound === "number" && afterRound !== currentRound) {
    await supabase.from("defense_action").delete().eq("id", insertedId);
    await undoEffects();
    await supabase.from("defense_player_log").insert({
      room_code: room,
      player_id: player.id,
      round: currentRound,
      log: "알림: 라운드 마감과 동시에 제출되어 이번 행동은 반영되지 않았습니다(카드 원상복구). 새 라운드에서 다시 선택해 주세요.",
    });
    return err(409, "라운드가 마감되어 이 행동은 반영되지 않았습니다. 카드는 되돌렸습니다.", "round_advanced");
  }

  return NextResponse.json({ ok: true, round: currentRound } as Ok, { status: 200 });
}
