import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, SubwayPlayerState, SubwayPlayerEvent } from "@/lib/types";

type MoveBody = {
  nickname?: string;
  direction?: "forward" | "back" | "reset";
};

type MoveResponse =
  | {
      state: SubwayPlayerState;
      result: "correct" | "wrong" | "reset" | "noop";
      reason?: string;
    }
  | { error: string };

const BASE_DIR = path.join(process.cwd(), "public", "subway-location");

const BACK_CORRECT_GROUPS = new Set([
  "01_only_door",
  "02_food",
  "03_capture_monster",
  "05_real_world",
]);

const FORWARD_CORRECT_GROUPS = new Set([
  "04_no_cap_monster",
  "06_similar_real",
  "07_just_go",
]);

let cachedLocations: string[] | null = null;

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

const locationVisitCounts = new Map<string, Map<string, number>>();

function incrementLocationVisitCount(
  playerId: string,
  location: string
): number {
  let perPlayer = locationVisitCounts.get(playerId);
  if (!perPlayer) {
    perPlayer = new Map<string, number>();
    locationVisitCounts.set(playerId, perPlayer);
  }
  const prev = perPlayer.get(location) ?? 0;
  const next = prev + 1;
  perPlayer.set(location, next);
  return next;
}

async function getOpenedRuleIdsForPlayer(
  supabase: SupabaseClient,
  playerId: string
): Promise<Set<number>> {
  const ids = new Set<number>();
  const { data, error } = await supabase
    .from("subway_player_events")
    .select("event_value")
    .eq("player_id", playerId)
    .eq("event_type", "rule_opened");

  if (error || !data) {
    return ids;
  }

  for (const row of data as Pick<SubwayPlayerEvent, "event_value">[]) {
    const value = row.event_value as { rule_id?: number } | null;
    if (value && typeof value.rule_id === "number") {
      ids.add(value.rule_id);
    }
  }

  return ids;
}

async function insertRuleOpenedEvent(
  supabase: SupabaseClient,
  playerId: string,
  ruleId: number
) {
  await supabase.from("subway_player_events").insert({
    player_id: playerId,
    event_type: "rule_opened",
    event_value: { rule_id: ruleId },
  } as Partial<SubwayPlayerEvent>);
}

async function ensureRule7IfComplete(
  supabase: SupabaseClient,
  playerId: string,
  openedIds: Set<number>
) {
  const required = [1, 2, 3, 4, 5, 6];
  const hasAll = required.every((id) => openedIds.has(id));
  if (hasAll && !openedIds.has(7)) {
    await insertRuleOpenedEvent(supabase, playerId, 7);
    openedIds.add(7);
  }
}

async function getAllLocationKeys(): Promise<string[]> {
  if (cachedLocations) return cachedLocations;

  const dirEntries = await fs.readdir(BASE_DIR, { withFileTypes: true });
  const all: string[] = [];

  for (const dirent of dirEntries) {
    if (!dirent.isDirectory()) continue;
    const group = dirent.name;
    const groupDir = path.join(BASE_DIR, group);
    const files = await fs.readdir(groupDir, { withFileTypes: true });
    for (const f of files) {
      if (!f.isFile()) continue;
      if (!/\.(png|jpg|jpeg|webp)$/i.test(f.name)) continue;
      all.push(`${group}/${f.name}`);
    }
  }

  cachedLocations = all;
  return all;
}

async function getRandomLocation(): Promise<string | null> {
  const all = await getAllLocationKeys();
  if (all.length === 0) return null;
  const idx = Math.floor(Math.random() * all.length);
  return all[idx] ?? null;
}

function getGroupFromLocation(location: string | null): string | null {
  if (!location) return null;
  const [group] = location.split("/");
  return group || null;
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as MoveBody | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as MoveResponse,
      { status: 400 }
    );
  }

  const direction = body.direction ?? "forward";
  if (!["forward", "back", "reset"].includes(direction)) {
    return NextResponse.json({ error: "invalid direction" } as MoveResponse, {
      status: 400,
    });
  }

  const nickname = body.nickname.trim();
  if (!nickname) {
    return NextResponse.json(
      { error: "nickname is required" } as MoveResponse,
      { status: 400 }
    );
  }

  // 플레이어 조회
  const playerRes = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerRes.error) {
    return NextResponse.json(
      { error: playerRes.error.message } as MoveResponse,
      { status: 500 }
    );
  }

  if (!playerRes.data) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as MoveResponse,
      { status: 403 }
    );
  }

  const player = playerRes.data as Player;

  // 현재 상태 조회
  const { data: stateRow, error: stateError } = await supabase
    .from("subway_player_state")
    .select(
      "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
    )
    .eq("player_id", player.id)
    .maybeSingle();

  if (stateError) {
    return NextResponse.json({ error: stateError.message } as MoveResponse, {
      status: 500,
    });
  }

  if (!stateRow) {
    // 아직 게임이 시작되지 않은 상태에서 move를 호출한 경우
    const initialLocation = await getRandomLocation();
    if (!initialLocation) {
      return NextResponse.json(
        { error: "장소 이미지를 찾을 수 없습니다." } as MoveResponse,
        { status: 500 }
      );
    }

    const insertState = await supabase
      .from("subway_player_state")
      .insert({
        player_id: player.id,
        exit_number: 0,
        current_location: initialLocation,
        reset_count: 0,
        scare_status: false,
        is_finished: false,
      })
      .select(
        "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
      )
      .maybeSingle();

    if (insertState.error || !insertState.data) {
      return NextResponse.json(
        {
          error:
            insertState.error?.message ??
            "플레이어 상태를 초기화하지 못했습니다.",
        } as MoveResponse,
        { status: 500 }
      );
    }

    // 같은 장소 방문 횟수 카운트 (규칙 5 조건용)
    incrementLocationVisitCount(player.id, initialLocation);

    // 최초 위치 진입 이벤트
    await supabase.from("subway_player_events").insert({
      player_id: player.id,
      event_type: "enter_location",
      event_value: { location: initialLocation },
    });

    const initialState = {
      ...(insertState.data as SubwayPlayerState),
      nickname: player.nickname,
    } as SubwayPlayerState;

    return NextResponse.json(
      {
        state: initialState,
        result: "noop",
      } as MoveResponse,
      { status: 200 }
    );
  }

  let state = { ...(stateRow as SubwayPlayerState), nickname: player.nickname };

  // 이미 게임을 마친 플레이어는 추가 이동을 허용하지 않음
  if (state.is_finished) {
    return NextResponse.json(
      {
        state,
        result: "noop",
        reason: "already_finished",
      } as MoveResponse,
      { status: 200 }
    );
  }

  // 이미 공개된 규칙 목록 조회 (플레이어별)
  const openedRuleIds = await getOpenedRuleIdsForPlayer(supabase, player.id);

  if (direction === "reset") {
    const nextReset = state.reset_count + 1;
    const { data: updated, error: updateError } = await supabase
      .from("subway_player_state")
      .update({
        exit_number: 0,
        reset_count: nextReset,
      })
      .eq("player_id", player.id)
      .select(
        "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
      )
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          error: updateError?.message ?? "리셋 중 오류가 발생했습니다.",
        } as MoveResponse,
        { status: 500 }
      );
    }

    state = { ...(updated as SubwayPlayerState), nickname: player.nickname };

    await supabase.from("subway_player_events").insert({
      player_id: player.id,
      event_type: "reset",
      event_value: { from_exit: state.exit_number, to_exit: 0 },
    } as Partial<SubwayPlayerEvent>);

    return NextResponse.json({ state, result: "reset" } as MoveResponse, {
      status: 200,
    });
  }

  // 30초 이내 이동 여부 확인
  const { data: lastEnter, error: lastEnterError } = await supabase
    .from("subway_player_events")
    .select("id, event_type, event_value, created_at")
    .eq("player_id", player.id)
    .eq("event_type", "enter_location")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEnterError) {
    return NextResponse.json(
      { error: lastEnterError.message } as MoveResponse,
      { status: 500 }
    );
  }

  let result: "correct" | "wrong" = "wrong";
  let reason = "";

  const now = Date.now();
  if (lastEnter?.created_at) {
    const enteredAt = new Date(lastEnter.created_at).getTime();
    if (!Number.isNaN(enteredAt)) {
      const diff = now - enteredAt;
      if (diff < 30_000) {
        // 30초 이내에는 무조건 wrong
        result = "wrong";
        reason = "too_fast";
      } else if (diff >= 30_000 && !openedRuleIds.has(1)) {
        // 규칙 1 공개 조건 충족 (한 장소에서 30초 이상 머무름)
        await insertRuleOpenedEvent(supabase, player.id, 1);
        openedRuleIds.add(1);
      }
    }
  }

  if (!reason) {
    const group = getGroupFromLocation(state.current_location);
    if (!group) {
      result = "wrong";
      reason = "no_group";
    } else if (BACK_CORRECT_GROUPS.has(group)) {
      result = direction === "back" ? "correct" : "wrong";
      reason = BACK_CORRECT_GROUPS.has(group)
        ? direction === "back"
          ? "back_required_correct"
          : "back_required_wrong"
        : "";
    } else if (FORWARD_CORRECT_GROUPS.has(group)) {
      result = direction === "forward" ? "correct" : "wrong";
      reason = FORWARD_CORRECT_GROUPS.has(group)
        ? direction === "forward"
          ? "forward_required_correct"
          : "forward_required_wrong"
        : "";
    } else {
      // 정의되지 않은 그룹은 안전하게 wrong 처리
      result = "wrong";
      reason = "unknown_group";
    }
  }

  let nextExit = state.exit_number;
  if (result === "correct") {
    nextExit = Math.min(state.exit_number + 1, 8);
  } else {
    nextExit = 0;
  }

  const finished = nextExit >= 8;

  // 8번 출구 도달 시 최초 1회만 finished_rank 부여
  let nextRank: number | null = null;
  if (finished && !state.is_finished && state.finished_rank == null) {
    const { count, error: rankError } = await supabase
      .from("subway_player_state")
      .select("finished_rank", { count: "exact", head: true })
      .not("finished_rank", "is", null);

    if (!rankError && typeof count === "number") {
      nextRank = count + 1;
    }
  }

  // 규칙 6: 6번 출구에서 0번 출구로 되돌아간 경우
  if (state.exit_number === 6 && nextExit === 0 && !openedRuleIds.has(6)) {
    await insertRuleOpenedEvent(supabase, player.id, 6);
    openedRuleIds.add(6);
  }

  // 다음 장소 이미지 선택
  const nextLocation = await getRandomLocation();
  if (!nextLocation) {
    return NextResponse.json(
      { error: "장소 이미지를 찾을 수 없습니다." } as MoveResponse,
      { status: 500 }
    );
  }

  // 같은 장소 3번 방문 시 규칙 5 공개
  const visitCount = incrementLocationVisitCount(player.id, nextLocation);
  if (visitCount === 3 && !openedRuleIds.has(5)) {
    await insertRuleOpenedEvent(supabase, player.id, 5);
    openedRuleIds.add(5);
  }

  const updatePayload: Partial<SubwayPlayerState> = {
    exit_number: nextExit,
    current_location: nextLocation,
    is_finished: finished,
  };

  if (finished && nextRank != null && state.finished_rank == null) {
    (updatePayload as { finished_rank: number }).finished_rank = nextRank;
  }

  const { data: updatedState, error: updateStateError } = await supabase
    .from("subway_player_state")
    .update(updatePayload)
    .eq("player_id", player.id)
    .select(
      "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
    )
    .maybeSingle();

  if (updateStateError || !updatedState) {
    return NextResponse.json(
      {
        error:
          updateStateError?.message ??
          "플레이어 상태를 업데이트하지 못했습니다.",
      } as MoveResponse,
      { status: 500 }
    );
  }

  const finalState: SubwayPlayerState = {
    ...(updatedState as SubwayPlayerState),
    nickname: player.nickname,
  };

  // 이동 이벤트 기록
  await supabase.from("subway_player_events").insert([
    {
      player_id: player.id,
      event_type: "move",
      event_value: {
        from_exit: state.exit_number,
        to_exit: finalState.exit_number,
        direction,
        location_group: getGroupFromLocation(state.current_location),
        result,
        reason,
      },
    } as Partial<SubwayPlayerEvent>,
    {
      player_id: player.id,
      event_type: "enter_location",
      event_value: { location: nextLocation },
    } as Partial<SubwayPlayerEvent>,
  ]);

  // 규칙 7: 1~6번 규칙이 모두 공개되었는지 확인 후 자동 공개
  await ensureRule7IfComplete(supabase, player.id, openedRuleIds);

  return NextResponse.json(
    {
      state: finalState,
      result,
      reason,
    } as MoveResponse,
    { status: 200 }
  );
}
