import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRoomWithSeed,
  getRoom,
  normalizeRoomCode,
  type RoomGame,
} from "@/lib/rooms";
import { publishMafiaPhase } from "@/lib/mafiaPhaseEvents";

const VALID_GAMES: RoomGame[] = ["mafia", "defense"];

// GET /api/gm/rooms?code=A3F82 → 단일 방
// GET /api/gm/rooms → 최근 생성한 마피아/디펜스 방 목록
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("rooms")
        .select("code, game, status, ended_normally, created_at")
        .in("game", VALID_GAMES)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ rooms: data ?? [] });
    } catch (error) {
      console.error("Failed to load GM rooms", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load room list",
        },
        { status: 500 },
      );
    }
  }

  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ room: null }, { status: 404 });
  }
  return NextResponse.json({ room });
}

// POST /api/gm/rooms  { game }  → 방 생성(+상태 시드), 코드 발급
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const game = (body?.game ?? "").trim() as RoomGame;
  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json(
      { error: "game 은 mafia | defense 중 하나여야 합니다." },
      { status: 400 },
    );
  }
  try {
    const room = await createRoomWithSeed(game);
    return NextResponse.json({ room });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "방 생성 실패" },
      { status: 500 },
    );
  }
}

// PATCH /api/gm/rooms  { code, status, ended_normally }  → 방 종료 등 상태 변경
export async function PATCH(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);
  const code = normalizeRoomCode(body?.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "code 필요" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body?.status === "string") patch.status = body.status;
  if (typeof body?.ended_normally === "boolean")
    patch.ended_normally = body.ended_normally;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 필드가 없습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("rooms").update(patch).eq("code", code);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (patch.status === "ended") {
    // 종료된 방의 보드 영상은 끈다. board_video 컬럼이 없는 DB(마이그레이션 전)면 조용히 넘어간다.
    await supabase
      .from("rooms")
      .update({ board_video: null, board_video_seek_sec: null })
      .eq("code", code);

    // 열려 있는 마피아 개인 화면이 종료 상태를 즉시 다시 읽도록 알린다.
    const { data: mafiaPhase } = await supabase
      .from("mafia_phase_state")
      .select("round_number, phase, updated_at")
      .eq("room_code", code)
      .maybeSingle();
    if (mafiaPhase) {
      publishMafiaPhase({
        room: code,
        round: mafiaPhase.round_number ?? 0,
        phase: mafiaPhase.phase ?? "end",
        updatedAt: mafiaPhase.updated_at ?? null,
      });
    }
  }
  return NextResponse.json({ ok: true });
}

const ROOM_CHILD_TABLES = [
  "defense_monster_snapshot",
  "defense_action",
  "defense_card_state",
  "defense_score",
  "defense_score_snapshot",
  "defense_player_log",
  "defense_monster_instance",
  "mafia_actions",
  "mafia_player_snapshots",
  "mafia_votes",
  "mafia_public_logs",
  "mafia_ability_results",
  "mafia_stock_history",
  "mafia_player_state",
  "subway_player_events",
  "subway_reports",
  "subway_player_state",
  "player_votes",
  "players",
  "gm_memos",
  "rules_state",
  "game_state",
  "defense_monster_count",
  "defense_phase_state",
  "mafia_stock_state",
  "mafia_phase_state",
] as const;

const OPTIONAL_ARCHIVE_TABLES = ["subway_play_records"] as const;

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

// DELETE /api/gm/rooms { codes: string[] }
// 종료된 테스트 방만 연결 데이터와 함께 영구 삭제한다.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const codes = Array.from(
    new Set(
      (Array.isArray(body?.codes) ? body.codes : [])
        .map((code: unknown) => normalizeRoomCode(String(code ?? "")))
        .filter(Boolean)
    )
  ).slice(0, 50);

  if (codes.length === 0) {
    return NextResponse.json({ error: "삭제할 방을 선택하세요." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const rooms = await supabase
    .from("rooms")
    .select("code, status")
    .in("code", codes);
  if (rooms.error) {
    return NextResponse.json({ error: rooms.error.message }, { status: 500 });
  }

  const found = rooms.data ?? [];
  if (found.length !== codes.length) {
    return NextResponse.json(
      { error: "존재하지 않는 방이 포함되어 있습니다." },
      { status: 404 }
    );
  }
  if (found.some((room) => room.status !== "ended")) {
    return NextResponse.json(
      { error: "종료된 방만 영구 삭제할 수 있습니다." },
      { status: 409 }
    );
  }

  for (const table of ROOM_CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().in("room_code", codes);
    if (error) {
      return NextResponse.json(
        { error: `${table} 정리 실패: ${error.message}` },
        { status: 500 }
      );
    }
  }

  for (const table of OPTIONAL_ARCHIVE_TABLES) {
    const { error } = await supabase.from(table).delete().in("room_code", codes);
    if (error && !isMissingTableError(error)) {
      return NextResponse.json(
        { error: `${table} 정리 실패: ${error.message}` },
        { status: 500 }
      );
    }
  }

  const deleted = await supabase.from("rooms").delete().in("code", codes);
  if (deleted.error) {
    return NextResponse.json({ error: deleted.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: codes.length });
}
