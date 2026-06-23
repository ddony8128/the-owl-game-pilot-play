import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { Player } from "@/lib/types";

type PlayersResponse = { players: Player[] } | { error: string };

// GET /api/gm/players?room=A3F82  → 그 방의 참가자 명단(화이트리스트)
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const room = normalizeRoomCode(searchParams.get("room") ?? "");
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, room_code, nickname, created_at")
    .eq("room_code", room)
    .order("nickname", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message } as PlayersResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ players: (data || []) as Player[] });
}

// 플레이어 단건 생성. body: { room, nickname }
// 같은 방에 이미 있으면 생성하지 않고 기존 행을 반환한다(중복 방지).
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    room?: unknown;
    nickname?: unknown;
  } | null;

  const room = normalizeRoomCode(
    typeof body?.room === "string" ? body.room : "",
  );
  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim() : "";
  if (!room) {
    return NextResponse.json({ error: "room 이 필요합니다." }, { status: 400 });
  }
  if (!nickname) {
    return NextResponse.json({ error: "닉네임을 입력해 주세요." }, {
      status: 400,
    });
  }

  const { data: existing, error: existingError } = await supabase
    .from("players")
    .select("id, room_code, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, created: false, player: existing });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("players")
    .insert({ id: randomUUID(), room_code: room, nickname, feather: 0 })
    .select("id, room_code, nickname, created_at")
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "플레이어를 생성하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, created: true, player: inserted });
}

// 이 플레이어를 직접 참조하는(player_id/voter_id) 런타임 행들.
// players 를 지우기 전에 자식 → 부모 순서로 먼저 비워 FK 위반을 막는다.
// 각 게임의 상세 런타임(mafia_actions/defense 스냅샷 등)은 플레이어를 직접
// 참조하지 않고 게임 상태/인스턴스를 참조하므로, 게임/전체 초기화(reset)에서 정리한다.
const PLAYER_CHILD_CLEANUPS: { table: string; col: string }[] = [
  // 이상교통
  { table: "subway_player_events", col: "player_id" },
  { table: "subway_reports", col: "player_id" },
  { table: "subway_player_state", col: "player_id" },
  // 마피아
  { table: "mafia_player_state", col: "player_id" },
  // 디펜스
  { table: "defense_action", col: "player_id" },
  { table: "defense_card_state", col: "player_id" },
  { table: "defense_score", col: "player_id" },
  { table: "defense_score_snapshot", col: "player_id" },
  { table: "defense_player_log", col: "player_id" },
  // 투표
  { table: "player_votes", col: "voter_id" },
];

function isMissingTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

// 플레이어 단건 삭제. body: { id: "<uuid>" }
export async function DELETE(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "플레이어 id가 필요합니다." }, {
      status: 400,
    });
  }

  for (const { table, col } of PLAYER_CHILD_CLEANUPS) {
    const { error } = await supabase.from(table).delete().eq(col, id);
    // 테이블이 아직 없는 환경(미적용 게임)은 무시하고 계속 진행한다.
    if (error && !isMissingTableError(error)) {
      return NextResponse.json(
        { error: `${table} 정리 실패: ${error.message}` },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
