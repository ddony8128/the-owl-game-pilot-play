import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Player,
  SubwayPlayerEvent,
  SubwayPlayerState,
  SubwayPlayerStateClient,
} from "@/lib/types";
import { SUBWAY_RULES } from "../rules";

type PlayerStatePayload = {
  state: SubwayPlayerStateClient | null;
};

type StateResponse = PlayerStatePayload | { error: string };

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

const BASE_DIR = path.join(process.cwd(), "public", "subway-location");
let cachedLocations: string[] | null = null;
const TOTAL_SECONDS = 35 * 60;

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

async function getVisibleRulesForPlayer(
  supabase: SupabaseClient,
  playerId: string
) {
  const openedIds = await getOpenedRuleIdsForPlayer(supabase, playerId);
  return SUBWAY_RULES.filter((r) => r.alwaysVisible || openedIds.has(r.id)).map(
    (r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      conditionDescription: r.conditionDescription,
    })
  );
}

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname");
  const all = searchParams.get("all") === "1";

  if (all) {
    const { data, error } = await supabase
      .from("subway_player_state")
      .select(
        "player_id, exit_number, current_location, reset_count, is_finished, finished_rank, updated_at, players(nickname)"
      );

    if (error) {
      return NextResponse.json({ error: error.message } as StateResponse, {
        status: 500,
      });
    }

    const rows = (data || []) as (SubwayPlayerState & {
      players?: { nickname?: string | null } | null;
    })[];

    // 전역 타이머 시작 시각(탈출 소요시간 기준점)
    const { data: gameRow } = await supabase
      .from("game_state")
      .select("timer_start_at")
      .eq("id", 1)
      .maybeSingle();
    const timerStartMs = gameRow?.timer_start_at
      ? new Date(gameRow.timer_start_at as string).getTime()
      : null;

    // 탈출한 플레이어들의 탈출 시각 = 8번 출구 도달(to_exit>=8) move 이벤트 시각
    const finishedIds = rows
      .filter((r) => r.is_finished && r.finished_rank != null)
      .map((r) => r.player_id);
    const finishMsByPlayer = new Map<string, number>();
    if (finishedIds.length > 0) {
      const { data: moveEvents } = await supabase
        .from("subway_player_events")
        .select("player_id, event_value, created_at")
        .in("player_id", finishedIds)
        .eq("event_type", "move");
      for (const ev of (moveEvents ?? []) as {
        player_id: string;
        event_value: { to_exit?: number } | null;
        created_at: string;
      }[]) {
        if (Number(ev.event_value?.to_exit) >= 8) {
          const ms = new Date(ev.created_at).getTime();
          if (Number.isNaN(ms)) continue;
          const prev = finishMsByPlayer.get(ev.player_id);
          if (prev == null || ms < prev) finishMsByPlayer.set(ev.player_id, ms);
        }
      }
    }

    const mapped: SubwayPlayerState[] = rows.map((row) => {
      const { players, ...rest } = row;
      let clearSeconds: number | null = null;
      if (rest.is_finished && rest.finished_rank != null && timerStartMs != null) {
        // finish move 이벤트가 없으면 상태행 updated_at 으로 대체
        const finishMs =
          finishMsByPlayer.get(rest.player_id) ??
          new Date(rest.updated_at).getTime();
        if (!Number.isNaN(finishMs)) {
          clearSeconds = Math.max(0, Math.round((finishMs - timerStartMs) / 1000));
        }
      }
      return {
        ...rest,
        nickname: players?.nickname ?? null,
        clear_seconds: clearSeconds,
      };
    });

    return NextResponse.json({ state: mapped } as unknown, { status: 200 });
  }

  if (!nickname) {
    return NextResponse.json(
      { error: "nickname is required" } as StateResponse,
      { status: 400 }
    );
  }

  const playerRes = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (playerRes.error) {
    return NextResponse.json(
      { error: playerRes.error.message } as StateResponse,
      { status: 500 }
    );
  }

  if (!playerRes.data) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as StateResponse,
      { status: 403 }
    );
  }

  const player = playerRes.data as Player;

  const { data: stateRow, error: stateError } = await supabase
    .from("subway_player_state")
    .select(
      "player_id, exit_number, current_location, reset_count, is_finished, finished_rank, updated_at"
    )
    .eq("player_id", player.id)
    .maybeSingle();

  if (stateError) {
    return NextResponse.json({ error: stateError.message } as StateResponse, {
      status: 500,
    });
  }
  let state: SubwayPlayerState | null = null;

  if (!stateRow) {
    // 최초 진입: 랜덤 위치를 선택해 초기 상태를 생성
    const initialLocation = await getRandomLocation();
    if (!initialLocation) {
      return NextResponse.json(
        { error: "장소 이미지를 찾을 수 없습니다." } as StateResponse,
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
        is_finished: false,
      })
      .select(
        "player_id, exit_number, current_location, reset_count, is_finished, finished_rank, updated_at"
      )
      .maybeSingle();

    if (insertState.error || !insertState.data) {
      return NextResponse.json(
        {
          error:
            insertState.error?.message ??
            "플레이어 상태를 초기화하지 못했습니다.",
        } as StateResponse,
        { status: 500 }
      );
    }

    // 최초 위치 진입 이벤트 기록
    await supabase.from("subway_player_events").insert({
      player_id: player.id,
      event_type: "enter_location",
      event_value: { location: initialLocation },
    } as Partial<SubwayPlayerEvent>);

    state = insertState.data as SubwayPlayerState;
  } else {
    const current = stateRow as SubwayPlayerState;
    state = current;
  }

  // 같은 장소에 있는 다른 플레이어 목록 조회 (자기 자신 제외, 종료되지 않은 플레이어만)
  let othersAtSameLocation:
    | {
        player_id: string;
        nickname: string | null;
      }[]
    | undefined;

  if (state?.current_location) {
    const { data: others, error: othersError } = await supabase
      .from("subway_player_state")
      .select("player_id, is_finished, current_location, players(nickname)")
      .eq("current_location", state.current_location)
      .eq("is_finished", false)
      .neq("player_id", player.id);

    if (!othersError && others) {
      const rows = others as {
        player_id: string;
        players?: { nickname?: string | null } | null;
      }[];

      othersAtSameLocation = rows.map((row) => ({
        player_id: row.player_id,
        nickname: row.players?.nickname ?? null,
      }));
    }
  }

  const rules = await getVisibleRulesForPlayer(supabase, player.id);

  // 타이머 상태 조회 (1게임 – 이상교통 전역 카운트다운)
  const { data: gameRow, error: gameError } = await supabase
    .from("game_state")
    .select("timer_start, timer_start_at, pause_at")
    .eq("id", 1)
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ error: gameError.message } as StateResponse, {
      status: 500,
    });
  }

  const timerStart = !!gameRow?.timer_start;
  const timerStartAt = (gameRow?.timer_start_at as string | null) ?? null;
  const pauseAt = (gameRow?.pause_at as string | null) ?? null;

  const clientState: SubwayPlayerStateClient | null = state
    ? {
        playerId: state.player_id,
        exitNumber: state.exit_number,
        currentLocation: state.current_location,
        timerStart,
        timerStartAt,
        pauseAt,
        totalSeconds: TOTAL_SECONDS,
        resetCount: state.reset_count,
        rules,
        othersAtSameLocation: (othersAtSameLocation ?? []).map((o) => ({
          playerId: o.player_id,
          nickname: o.nickname,
        })),
        isFinished: state.is_finished,
        finishedRank: state.finished_rank,
      }
    : null;

  return NextResponse.json(
    {
      state: clientState,
    } as StateResponse,
    { status: 200 }
  );
}
