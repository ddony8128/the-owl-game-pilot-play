import { NextResponse } from "next/server";
import { readPhoneToggles } from "@/lib/phoneToggles";
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
import { normalizeNickname } from "@/lib/nickname";
import { loadRoom } from "@/lib/player/roomGuard";
import { isLateCombat, lateCombatLog } from "@/lib/defense/action";
import { normalizeStage } from "@/lib/defense/steps";

type DefenseGlobalStateResponse =
  | {
      round: number | null;
      stage?: string;
      prevRound?: number | null;
    }
  | { error: string };

type DefensePlayerStateResponse =
  | {
      round: number | null;
      /** 진행 단계 — action 일 때만 행동 탭이 열린다 */
      stage?: string;
      prevRound?: number | null;
      endedEarlyFrom?: number | null;
      roomStatus: "active" | "ended";
      phoneLogs?: boolean;
      phoneRemainingCount?: boolean;
      serverNow: string;
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
            usedCardValue: number | null;
            trainingFrom: number | null;
            trainingTo: number | null;
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
  | { error: string; reason?: string };

type ActionRow = DefenseAction & { id: number; used_card_slot: number | null };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  const nickname = normalizeNickname(searchParams.get("nickname"));

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
      .select("room_code, round, updated_at, stage, ended_early_from")
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
        stage: normalizeStage(phase?.round ?? 0, phase?.stage),
        prevRound:
          typeof phase?.round === "number"
            ? phase.round === 16 && typeof phase.ended_early_from === "number"
              ? phase.ended_early_from
              : phase.round - 1
            : null,
      } as DefenseGlobalStateResponse,
      { status: 200 }
    );
  }

  // 방 존재 여부(없으면 404 room_not_found — 폰은 토큰을 지우지 않고 안내만 한다)
  const [{ room: roomRow, error: roomError }, toggles] = await Promise.all([
    loadRoom(supabase, room),
    readPhoneToggles(supabase, room),
  ]);
  if (roomError) {
    return NextResponse.json({ error: roomError }, { status: 500 });
  }
  if (!roomRow) {
    return NextResponse.json(
      { error: "방을 찾을 수 없습니다.", reason: "room_not_found" } as DefensePlayerStateResponse,
      { status: 404 }
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
    // 강퇴(명단에서 삭제)와 미등록은 서버가 구분할 수 없다 → 폰이 "이전엔 있었는데 지금 403"이면 강퇴로 안내한다.
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다.", reason: "not_registered" } as DefensePlayerStateResponse,
      { status: 403 }
    );
  }

  const player = playerRes.data as Player;

  const [phaseRes, actionRes, logsRes] = await Promise.all([
    supabase
      .from("defense_phase_state")
      .select("room_code, round, updated_at, stage, ended_early_from")
      .eq("room_code", room)
      .maybeSingle(),
    supabase
      .from("defense_action")
      .select(
        "id, round, player_id, action_type, target_monster_id, used_card_value, used_card_slot, training_from, training_to"
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
  let lastAction = (actionRes.data || null) as ActionRow | null;
  let logs = (logsRes.data || []) as DefensePlayerLog[];

  // 라운드 마감과 겹쳐 정산에서 빠진 전투(반면교사 1-4): 카드를 되돌리고 알림 로그를 남긴다. 조용한 유실 금지.
  if (
    lastAction &&
    isLateCombat({
      action: { round: lastAction.round, action_type: lastAction.action_type },
      currentRound: round,
      logs: logs.map((l) => ({ round: l.round, log: l.log })),
    })
  ) {
    const del = await supabase
      .from("defense_action")
      .delete()
      .eq("id", lastAction.id)
      .select("id");
    // 삭제에 성공한 요청만 되돌린다(동시 폴링 두 건이 두 번 되돌리지 않게).
    if (!del.error && del.data && del.data.length > 0) {
      if (typeof lastAction.used_card_slot === "number") {
        await supabase
          .from("defense_card_state")
          .update({ is_active: true })
          .eq("room_code", room)
          .eq("player_id", player.id)
          .eq("card_slot", lastAction.used_card_slot);
      }
      const noticeRound = typeof round === "number" ? round : lastAction.round;
      await supabase.from("defense_player_log").insert({
        room_code: room,
        player_id: player.id,
        round: noticeRound,
        log: lateCombatLog(lastAction.used_card_value),
      });
      const relog = await supabase
        .from("defense_player_log")
        .select("player_id, round, log, created_at")
        .eq("room_code", room)
        .eq("player_id", player.id)
        .order("round", { ascending: false })
        .order("created_at", { ascending: false });
      if (!relog.error) logs = (relog.data || []) as DefensePlayerLog[];
      lastAction = null;
    }
  }

  const [instancesRes, countsRes, cardsRes, scoreRes] = await Promise.all([
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
  ]);

  for (const r of [instancesRes, countsRes, cardsRes, scoreRes]) {
    if (r.error) {
      return NextResponse.json(
        { error: r.error.message } as DefensePlayerStateResponse,
        { status: 500 }
      );
    }
  }

  const instances = (instancesRes.data || []) as DefenseMonsterInstance[];
  const counts = (countsRes.data || []) as DefenseMonsterCount[];
  const cards = (cardsRes.data || []) as DefenseCardState[];
  const scoreRow = (scoreRes.data || null) as DefenseScore | null;

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
      stage: normalizeStage(round ?? 0, phase?.stage),
      prevRound: round != null ? (round === 16 && typeof phase?.ended_early_from === "number" ? phase.ended_early_from : round - 1) : null,
      // ITER6 A6 — 조기 종료(모든 몬스터 처치·도망)로 16에 온 경우 마지막 정산 라운드(DB 4~15). 폰 최종 안내에 쓴다.
      endedEarlyFrom: round === 16 && typeof phase?.ended_early_from === "number" ? phase.ended_early_from : null,
      roomStatus: roomRow.status === "ended" ? "ended" : "active",
      serverNow: new Date().toISOString(),
      // ITER6 C5 — GM 토글(기본 켜짐). 끄면 폰이 로그 탭·도감 '남은 수'를 숨긴다.
      phoneLogs: toggles.phoneLogs,
      phoneRemainingCount: toggles.phoneRemainingCount,
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
