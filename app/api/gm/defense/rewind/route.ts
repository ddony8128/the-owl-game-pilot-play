import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  DefenseCardState,
  DefenseMonsterInstance,
  DefenseMonsterSnapshot,
  DefensePhaseState,
  DefenseScore,
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

// POST /api/gm/defense/rewind { room, from? }
//  현재 라운드 N 의 행동 제출이 0건이면 N-1 로 되돌린다(Iteration 5 계약).
//  - 1→0, 4→3: 초기화 전환 취소(소환 몬스터 삭제·풀 복원·카드/점수 정리).
//  - 그 외: N-1 정산 취소 — N-1 시작 시점 몬스터 스냅샷으로 HP/잔여시간/상태 복원, N 에 소환된 몬스터 삭제·풀 +1,
//    처치 점수(로그 "1인당 N점") 차감, 도망 페널티 카드(로그 "값 N") 재활성화, 정산 로그·스냅샷 삭제.
//  되돌릴 수 없으면 409 + 사유(not_rewindable). 되돌린 내용은 GM 로그에 남긴다.

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
    .select("room_code, round, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return gmError(500, phaseError.message);
  const current = (phaseRow || null) as DefensePhaseState | null;
  if (!current) return gmError(500, "defense_phase_state가 초기화되지 않았습니다.");

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
  let scoreRowsM: { player_id: string; points: number }[] = [];

  if (plan.kind === "settlement") {
    const [snapMRes, logsMRes, scoresRes] = await Promise.all([
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
      supabase.from("defense_score").select("player_id, points").eq("room_code", room),
    ]);
    for (const r of [snapMRes, logsMRes, scoresRes]) {
      if (r.error) return gmError(500, r.error.message);
    }
    snapM = (snapMRes.data ?? []) as DefenseMonsterSnapshot[];
    logsM = (logsMRes.data ?? []) as LogRow[];
    scoreRowsM = (scoresRes.data ?? []) as DefenseScore[];

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

  // ── 2) 라운드 포인터를 먼저 되돌린다(CAS). 이 뒤로 N 라운드 제출은 들어올 수 없다. ──
  const { data: claimed, error: claimError } = await supabase
    .from("defense_phase_state")
    .update({ round: M })
    .eq("room_code", room)
    .eq("round", N)
    .select("room_code, round, updated_at")
    .maybeSingle();
  if (claimError) return gmError(500, claimError.message);
  if (!claimed) {
    return gmError(409, "그 사이 라운드가 바뀌어 되돌리지 않았습니다. 화면을 새로 고치세요.", "already_advanced");
  }

  // 되돌리기 직전에 들어온 제출이 있으면(경합) 원복하고 거부한다.
  const { count: lateActions } = await supabase
    .from("defense_action")
    .select("id", { count: "exact", head: true })
    .eq("room_code", room)
    .eq("round", N);
  if ((lateActions ?? 0) > 0) {
    await supabase.from("defense_phase_state").update({ round: N }).eq("room_code", room).eq("round", M);
    return gmError(
      409,
      `되돌리는 사이 이번 라운드 행동 제출이 ${lateActions}건 들어와 취소했습니다.`,
      "not_rewindable",
    );
  }

  // ── 3) 쓰기 ──
  const fail = async (message: string) => {
    // 라운드 포인터는 되돌린 상태로 두지 않는다 — 복원 실패 시 원복.
    await supabase.from("defense_phase_state").update({ round: N }).eq("room_code", room).eq("round", M);
    return gmError(500, `되돌리기 실패(라운드는 ${getDefenseRoundLabel(N)} 유지): ${message}`);
  };

  // 3-a. N 라운드 스냅샷 삭제 → N 에 소환된 몬스터 삭제 → 풀 +1
  {
    const { error } = await supabase
      .from("defense_monster_snapshot")
      .delete()
      .eq("room_code", room)
      .eq("round", N);
    if (error) return fail(error.message);
  }
  if (spawnedN.length > 0) {
    const { error } = await supabase
      .from("defense_monster_instance")
      .delete()
      .eq("room_code", room)
      .in("id", spawnedN.map((m) => m.id));
    if (error) return fail(error.message);
  }
  {
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
    const { error } = await supabase.from("defense_monster_count").upsert(
      [...countMap.entries()].map(([id, v]) => ({ room_code: room, id, count: v.count, base_count: v.base })),
      { onConflict: "room_code,id" },
    );
    if (error) return fail(error.message);
  }

  let restoredMonsters = 0;
  if (plan.kind === "settlement") {
    // 3-b. N-1 시작 시점 스냅샷으로 몬스터 복원(처치·도망 포함)
    for (const s of snapM) {
      const { error } = await supabase
        .from("defense_monster_instance")
        .update({
          current_hp: s.current_hp,
          remaining_time: s.remaining_time,
          status: "active",
          removed_round: null,
        })
        .eq("room_code", room)
        .eq("id", s.instance_id);
      if (error) return fail(error.message);
      restoredMonsters += 1;
    }
    // 3-c. 처치 점수 차감
    for (const [pid, delta] of scoreDelta.entries()) {
      const prev = scoreRowsM.find((s) => s.player_id === pid)?.points ?? 0;
      const { error } = await supabase
        .from("defense_score")
        .upsert({ room_code: room, player_id: pid, points: prev + delta } as DefenseScore, {
          onConflict: "player_id",
        });
      if (error) return fail(error.message);
    }
    {
      const { error } = await supabase
        .from("defense_score_snapshot")
        .delete()
        .eq("room_code", room)
        .eq("round", M);
      if (error) return fail(error.message);
    }
    // 3-d. 도망 페널티 카드 재활성화
    for (const c of cardReactivate) {
      const { error } = await supabase
        .from("defense_card_state")
        .update({ is_active: true })
        .eq("room_code", room)
        .eq("player_id", c.player_id)
        .eq("card_slot", c.slot);
      if (error) return fail(error.message);
    }
    // 3-e. 정산 로그 삭제(제출 시점 로그는 보존)
    if (logIdsToDelete.length > 0) {
      const { error } = await supabase.from("defense_player_log").delete().in("id", logIdsToDelete);
      if (error) return fail(error.message);
    }
  } else if (N === 1) {
    // 0→1 취소: 초기화가 만든 카드/점수를 지운다(준비 단계엔 없었다).
    for (const table of ["defense_card_state", "defense_score", "defense_score_snapshot", "defense_player_log"]) {
      const { error } = await supabase.from(table).delete().eq("room_code", room);
      if (error) return fail(`${table}: ${error.message}`);
    }
  } else if (N === 4) {
    // 3→4 취소: 본게임 초기화가 0으로 만든 점수를 튜토리얼 마지막(2라운드) 스냅샷으로 되돌려 결과 화면이 맞게 한다.
    const { data: snap2 } = await supabase
      .from("defense_score_snapshot")
      .select("player_id, points")
      .eq("room_code", room)
      .eq("round", 2);
    const rows = (snap2 ?? []) as { player_id: string; points: number }[];
    if (rows.length > 0) {
      const { error } = await supabase.from("defense_score").upsert(
        rows.map((r) => ({ room_code: room, player_id: r.player_id, points: r.points })),
        { onConflict: "player_id" },
      );
      if (error) return fail(error.message);
    }
  }

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
