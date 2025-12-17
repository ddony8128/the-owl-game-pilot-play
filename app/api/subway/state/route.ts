import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, SubwayPlayerState, SubwayPlayerEvent } from "@/lib/types";
import { SUBWAY_RULES } from "../rules";

type PlayerStatePayload = {
  state: SubwayPlayerState | null;
  rules?: {
    id: number;
    title: string;
    body: string;
    conditionDescription: string;
  }[];
  scare?: boolean;
};

type StateResponse = PlayerStatePayload | { error: string };

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

const BASE_DIR = path.join(process.cwd(), "public", "subway-location");
let cachedLocations: string[] | null = null;

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
        "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at, players(nickname)"
      );

    if (error) {
      return NextResponse.json({ error: error.message } as StateResponse, {
        status: 500,
      });
    }

    const rows = (data || []) as (SubwayPlayerState & {
      players?: { nickname?: string | null } | null;
    })[];

    const mapped: SubwayPlayerState[] = rows.map((row) => {
      const { players, ...rest } = row;
      return {
        ...rest,
        nickname: players?.nickname ?? null,
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
    .select("id, nickname, is_finalist, created_at")
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
      "player_id, exit_number, current_location, reset_count, scare_status, is_finished, finished_rank, updated_at"
    )
    .eq("player_id", player.id)
    .maybeSingle();

  if (stateError) {
    return NextResponse.json({ error: stateError.message } as StateResponse, {
      status: 500,
    });
  }

  let scare = false;
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

    if (current.scare_status) {
      scare = true;
      // 일회성 플래그로 소비
      await supabase
        .from("subway_player_state")
        .update({ scare_status: false })
        .eq("player_id", player.id);
    }
  }

  const rules = await getVisibleRulesForPlayer(supabase, player.id);

  return NextResponse.json(
    {
      state,
      rules,
      scare,
    } as StateResponse,
    { status: 200 }
  );
}
