import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { Player } from "@/lib/types";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import { NICKNAME_MAX_LENGTH, normalizeNickname } from "@/lib/admin/nickname";

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
    typeof body?.nickname === "string" ? normalizeNickname(body.nickname) : "";
  if (!room) {
    return NextResponse.json({ error: "room 이 필요합니다." }, { status: 400 });
  }
  if (!nickname) {
    return NextResponse.json({ error: "닉네임을 입력해 주세요." }, {
      status: 400,
    });
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return NextResponse.json({ error: "닉네임은 20자 이내로 입력해 주세요." }, { status: 400 });
  }

  // 종료된 방에는 등록할 수 없다(409 room_ended)
  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;

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

// 이 플레이어를 직접 참조하는(player_id/voter_id/target_id) 런타임 행들.
// players 를 지우기 전에 자식 → 부모 순서로 먼저 비워 FK 위반을 막는다.
// Iteration 5(반면교사 1-11 강퇴 경로): 마피아 행동·투표·스냅샷·능력결과도 FK 로 players 를 참조하므로 함께 정리한다
// (예전엔 입찰한 참가자를 강퇴하면 FK 위반으로 500).
const PLAYER_CHILD_CLEANUPS: { table: string; col: string }[] = [
  // 이상교통
  { table: "subway_player_events", col: "player_id" },
  { table: "subway_reports", col: "player_id" },
  { table: "subway_player_state", col: "player_id" },
  // 마피아
  { table: "mafia_actions", col: "player_id" },
  { table: "mafia_votes", col: "voter_id" },
  { table: "mafia_votes", col: "target_id" },
  { table: "mafia_player_snapshots", col: "player_id" },
  { table: "mafia_ability_results", col: "player_id" },
  { table: "mafia_player_state", col: "player_id" },
  // 디펜스
  { table: "defense_action", col: "player_id" },
  { table: "defense_card_state", col: "player_id" },
  { table: "defense_score", col: "player_id" },
  { table: "defense_score_snapshot", col: "player_id" },
  { table: "defense_player_log", col: "player_id" },
  // 투표
  { table: "player_votes", col: "voter_id" },
  { table: "player_votes", col: "target_id" },
];

function isMissingTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

// 플레이어 단건 삭제(강퇴). body: { id: "<uuid>" }
export async function DELETE(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return gmError(400, "플레이어 id(uuid)가 필요합니다.", "invalid_input");
  }

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, room_code, nickname")
    .eq("id", id)
    .maybeSingle();
  if (playerError) return gmError(500, playerError.message);
  if (!playerRow) {
    // 이미 지워진 참가자 — 재전송은 멱등으로 처리
    return NextResponse.json({ ok: true, id, already: true });
  }
  const player = playerRow as { id: string; room_code: string; nickname: string };

  // 종료된 방은 읽기 전용(409 room_ended)
  const guard = await loadRoomForWrite(supabase, player.room_code);
  if (!guard.ok) return guard.response;

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

  await addGmLog(supabase, {
    room: player.room_code,
    game: guard.room.game,
    kind: "kick",
    content: `참가자 삭제(강퇴): ${player.nickname}`,
    meta: { player_id: id },
  });

  return NextResponse.json({ ok: true, id });
}
