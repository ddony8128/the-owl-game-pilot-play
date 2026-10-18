import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  DefenseCardState,
  DefenseMonsterInstance,
  DefenseMonsterSnapshot,
  DefensePhaseState,
  Player,
} from "@/lib/types";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import {
  decideDefenseRewind,
  isSettlementLog,
  parseAwardedPoints,
  parseExpiredPenaltyValue,
  resolvePenaltyCard,
} from "@/lib/admin/rewindRules";
import { readFromIndex } from "@/lib/admin/advanceGuard";
import { getDefenseRoundLabel } from "@/lib/admin/defenseLabels";
import { stageAfterRewind } from "@/lib/defense/steps";

// POST /api/gm/defense/rewind { room, from? }
//  현재 라운드 N 의 행동 제출이 0건이면 N-1 로 되돌린다(Iteration 5 계약).
//  - 1→0, 4→3: 초기화 전환 취소(소환 몬스터 삭제·풀 복원·카드/점수 정리).
//  - 그 외: N-1 정산 취소 — N-1 시작 시점 몬스터 스냅샷으로 HP/잔여시간/상태 복원, N 에 소환된 몬스터 삭제·풀 +1,
//    처치 점수(로그 "1인당 N점") 차감, 도망 페널티 카드(로그 "값 N") 재활성화, 정산 로그·스냅샷 삭제.
//  되돌릴 수 없으면 409 + 사유(not_rewindable). 되돌린 내용은 GM 로그에 남긴다.
//  실행은 RPC gm_defense_rewind_apply(한 트랜잭션, phase 행 잠금) — supabase/migrations/2026-10-17-iter5-rewind-rpc.sql

type RewindResponse =
  | {
      ok: true;
      phase: DefensePhaseState;
      restored: { monsters: number; despawned: number; scoreEntries: number; cards: number; logs: number };
    }
  | { error: string; reason?: string };

type LogRow = { id: number; player_id: string; round: number; log: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as { room?: unknown; from?: unknown } | null;
  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) return gmError(400, "room 필요", "invalid_input");

  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;
  if (guard.room.game !== "defense") {
    return gmError(400, "디펜스 방이 아닙니다.", "invalid_input");
  }

  const { data: phaseRow, error: phaseError } = await supabase
    .from("defense_phase_state")
    .select("room_code, round, updated_at, ended_early_from")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return gmError(500, phaseError.message);
  const current = (phaseRow || null) as DefensePhaseState | null;
  if (!current) return gmError(500, "defense_phase_state가 초기화되지 않았습니다.");
  if (current.round === 16 && typeof current.ended_early_from === "number") {
    return gmError(
      409,
      `모든 몬스터가 처치·도망해 ${getDefenseRoundLabel(current.ended_early_from)} 뒤 조기 종료된 게임은 되돌릴 수 없습니다.`,
      "not_rewindable",
    );
  }

  const from = readFromIndex(body?.from);
  if (from != null && from !== current.round) {
    return gmError(
      409,
      `화면이 보고 있던 라운드(${getDefenseRoundLabel(from)})와 서버 라운드(${getDefenseRoundLabel(current.round)})가 다릅니다. 화면을 새로 고친 뒤 다시 확인하세요.`,
      "stale_from",
    );
  }

  const N = current.round;
  const { count: actionsAtN, error: countError } = await supabase
    .from("defense_action")
    .select("id", { count: "exact", head: true })
    .eq("room_code", room)
    .eq("round", N);
  if (countError) return gmError(500, countError.message);

  const decision = decideDefenseRewind({ round: N, actionsAtCurrentRound: actionsAtN ?? 0 });
  if (!decision.ok) return gmError(409, decision.error, decision.reason);
  const plan = decision.plan;
  const M = plan.to;

  // ── 1) 읽기: 복원 계획을 모두 세운 뒤에 쓴다(중간 실패로 반쪽 상태가 되지 않게) ──
  const [snapNRes, spawnedNRes, countsRes, playersRes] = await Promise.all([
    supabase
      .from("defense_monster_snapshot")
      .select("instance_id, monster_id, round, current_hp, remaining_time, slot_index")
      .eq("room_code", room)
      .eq("round", N),
    supabase
      .from("defense_monster_instance")
      .select("id, monster_id, current_hp, remaining_time, slot_index, status, spawned_round, removed_round")
      .eq("room_code", room)
      .eq("spawned_round", N),
    supabase.from("defense_monster_count").select("id, count, base_count").eq("room_code", room),
    supabase.from("players").select("id, nickname, created_at").eq("room_code", room),
  ]);
  for (const r of [snapNRes, spawnedNRes, countsRes, playersRes]) {
    if (r.error) return gmError(500, r.error.message);
  }
  const spawnedN = (spawnedNRes.data ?? []) as DefenseMonsterInstance[];
  const counts = (countsRes.data ?? []) as { id: number; count: number; base_count: number | null }[];
  const players = (playersRes.data ?? []) as Player[];
  const nicknameById = new Map(players.map((p) => [p.id, p.nickname] as const));

  // 정산 되돌리기용 읽기
  let snapM: DefenseMonsterSnapshot[] = [];
  let logsM: LogRow[] = [];
  const scoreDelta = new Map<string, number>();
  const cardReactivate: { player_id: string; slot: number; value: number }[] = [];
  const logIdsToDelete: number[] = [];

  if (plan.kind === "settlement") {
    const [snapMRes, logsMRes] = await Promise.all([
      supabase
        .from("defense_monster_snapshot")
        .select("instance_id, monster_id, round, current_hp, remaining_time, slot_index")
        .eq("room_code", room)
        .eq("round", M),
      supabase
        .from("defense_player_log")
        .select("id, player_id, round, log")
        .eq("room_code", room)
        .eq("round", M),
    ]);
    for (const r of [snapMRes, logsMRes]) {
      if (r.error) return gmError(500, r.error.message);
    }
    snapM = (snapMRes.data ?? []) as DefenseMonsterSnapshot[];
    logsM = (logsMRes.data ?? []) as LogRow[];

    const penaltyByPlayer = new Map<string, number>();
    for (const l of logsM) {
      if (!isSettlementLog(l.log)) continue;
      logIdsToDelete.push(l.id);
      const awarded = parseAwardedPoints(l.log);
      if (awarded != null && awarded > 0) {
        scoreDelta.set(l.player_id, (scoreDelta.get(l.player_id) ?? 0) - awarded);
      }
      const penalty = parseExpiredPenaltyValue(l.log);
      if (penalty != null) penaltyByPlayer.set(l.player_id, penalty);
    }

    if (penaltyByPlayer.size > 0) {
      const { data: cardRows, error: cardsError } = await supabase
        .from("defense_card_state")
        .select("player_id, card_slot, card_value, is_active")
        .eq("room_code", room)
        .in("player_id", [...penaltyByPlayer.keys()]);
      if (cardsError) return gmError(500, cardsError.message);
      const cards = (cardRows ?? []) as DefenseCardState[];
      for (const [pid, value] of penaltyByPlayer.entries()) {
        const mine = cards.filter((c) => c.player_id === pid);
        const resolved = resolvePenaltyCard(mine, value);
        if (!resolved.ok) {
          return gmError(
            409,
            `${nicknameById.get(pid) ?? pid}: ${resolved.error}`,
            "not_rewindable",
          );
        }
        cardReactivate.push({ player_id: pid, slot: resolved.slot, value });
      }
    }
  }

  // ── 2) 복원 계획을 한 트랜잭션으로 적용(RPC gm_defense_rewind_apply) ──
  //  함수가 phase 행을 FOR UPDATE 로 잠근 뒤 "포인터가 아직 N 인지"·"N 제출이 0건인지"를 다시 확인하고,
  //  스냅샷/몬스터/풀/점수/카드/로그/포인터를 한 번에 바꾼다. 중간 오류는 전부 롤백(반쪽 상태 없음).
  const countMap = new Map<number, { count: number; base: number }>();
  for (const m of DEFENSE_MONSTERS) {
    const row = counts.find((c) => c.id === m.id);
    countMap.set(m.id, {
      count: row?.count ?? m.baseCount,
      base: typeof row?.base_count === "number" ? row.base_count : m.baseCount,
    });
  }
  if (plan.kind === "init") {
    // 초기화 전환 취소: 풀을 기준값으로 되돌린다.
    for (const [id, v] of countMap.entries()) countMap.set(id, { ...v, count: v.base });
  } else {
    for (const m of spawnedN) {
      const v = countMap.get(m.monster_id);
      if (v) countMap.set(m.monster_id, { ...v, count: v.count + 1 });
    }
  }
  // 3→4 취소: 본게임 초기화가 0으로 만든 점수를 튜토리얼 마지막(2라운드) 스냅샷으로 되돌린다.
  let scoresSet: { player_id: string; points: number }[] = [];
  if (plan.kind === "init" && N === 4) {
    const { data: snap2, error: snap2Error } = await supabase
      .from("defense_score_snapshot")
      .select("player_id, points")
      .eq("room_code", room)
      .eq("round", 2);
    if (snap2Error) return gmError(500, snap2Error.message);
    scoresSet = (snap2 ?? []) as { player_id: string; points: number }[];
  }

  const rpcPlan = {
    despawn_ids: spawnedN.map((m) => m.id),
    counts: [...countMap.entries()].map(([id, v]) => ({ id, count: v.count, base_count: v.base })),
    restore_monsters:
      plan.kind === "settlement"
        ? snapM.map((s) => ({ instance_id: s.instance_id, current_hp: s.current_hp, remaining_time: s.remaining_time }))
        : [],
    score_deltas: [...scoreDelta.entries()].map(([player_id, delta]) => ({ player_id, delta })),
    scores_set: scoresSet,
    delete_score_snapshot_round: plan.kind === "settlement" ? M : null,
    reactivate_cards: cardReactivate.map((c) => ({ player_id: c.player_id, slot: c.slot })),
    delete_log_ids: logIdsToDelete,
    wipe_init: plan.kind === "init" && N === 1,
  };
  const { data: rpcData, error: rpcError } = await supabase.rpc("gm_defense_rewind_apply", {
    p_room: room,
    p_from: N,
    p_to: M,
    p_plan: rpcPlan,
  });
  if (rpcError) {
    return gmError(500, `되돌리기 실패(라운드는 ${getDefenseRoundLabel(N)} 유지): ${rpcError.message}`);
  }
  const result = (rpcData ?? null) as
    | { ok: true; restored_monsters: number; despawned: number; logs: number }
    | { ok: false; status?: number; reason?: string; error?: string }
    | null;
  if (!result || !result.ok) {
    const status = result?.status === 409 ? 409 : 500;
    return gmError(status, result?.error ?? "되돌리기 실패", (result?.reason ?? undefined) as Parameters<typeof gmError>[2]);
  }
  const restoredMonsters = result.restored_monsters;
  // 되돌린 라운드의 단계는 "행동"(정산 직전) — 보드·폰·[다음] 버튼이 그 단계를 본다.
  await supabase.from("defense_phase_state").update({ stage: stageAfterRewind(M) }).eq("room_code", room).eq("round", M);

  const { data: afterRow } = await supabase
    .from("defense_phase_state")
    .select("room_code, round, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  const claimed = (afterRow ?? { room_code: room, round: M, updated_at: new Date().toISOString() }) as DefensePhaseState;

  const summary = `되돌리기: ${getDefenseRoundLabel(N)} → ${getDefenseRoundLabel(M)}${
    plan.kind === "settlement"
      ? ` (${getDefenseRoundLabel(M)} 정산 취소 — 몬스터 ${restoredMonsters}마리 복원, 소환 ${spawnedN.length}마리 회수, 점수 ${scoreDelta.size}명 차감, 카드 ${cardReactivate.length}장 재활성화)`
      : ` (시작 전환 취소 — 소환 ${spawnedN.length}마리 회수)`
  }`;
  await addGmLog(supabase, {
    room,
    game: "defense",
    kind: "rewind",
    content: summary,
    meta: {
      from: N,
      to: M,
      plan: plan.kind,
      monsters: restoredMonsters,
      despawned: spawnedN.length,
      scores: [...scoreDelta.entries()].map(([player_id, delta]) => ({
        player_id,
        nickname: nicknameById.get(player_id) ?? null,
        delta,
      })),
      cards: cardReactivate,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      phase: claimed as DefensePhaseState,
      restored: {
        monsters: restoredMonsters,
        despawned: spawnedN.length,
        scoreEntries: scoreDelta.size,
        cards: cardReactivate.length,
        logs: logIdsToDelete.length,
      },
    } as RewindResponse,
    { status: 200 },
  );
}
