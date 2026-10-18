import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRoom, normalizeRoomCode } from "@/lib/rooms";
import type { Player } from "@/lib/types";
import { isValidNickname, normalizeNickname } from "@/lib/nickname";
import { randomUUID } from "crypto";

// 플레이어 입장: 방 코드 + 닉네임.
//  - 방 코드가 틀리면        → "방 코드를 확인해 주세요." (reason: room_not_found)
//  - 방은 맞지만 미등록 닉네임 → "GM이 등록하지 않은 닉네임입니다. GM에게 확인 부탁드립니다." (reason: not_registered)
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);

  const room = normalizeRoomCode(body?.room ?? body?.room_code ?? "");
  // 제로폭·NBSP·조합형 한글 차이로 "다른 사람"이 되지 않게 정규화한다(GM 등록 닉네임과 같은 규칙).
  const nickname = normalizeNickname(body?.nickname);

  if (!room || !nickname) {
    return NextResponse.json(
      { error: "room, nickname 필요" },
      { status: 400 },
    );
  }
  if (!isValidNickname(nickname)) {
    return NextResponse.json(
      { error: "닉네임은 20자 이내여야 합니다.", reason: "bad_nickname" },
      { status: 400 },
    );
  }

  const roomRow = await getRoom(room);
  if (!roomRow) {
    return NextResponse.json(
      { error: "방 코드를 확인해 주세요.", reason: "room_not_found" },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, room_code, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    // 자유 입장(수산시장·증권가 방식): 게임 시작 전(준비 단계)에는 처음 보는 닉네임을 그 자리에서 참가자로 등록한다.
    // 시작 뒤에는 카드·자산이 이미 만들어졌으므로 새 닉네임은 받지 않는다(기존 닉네임 재접속만).
    const lobby = await isLobby(supabase, room, roomRow.game, roomRow.status);
    if (!lobby.ok) {
      return NextResponse.json(
        {
          error:
            lobby.reason === "room_ended"
              ? "종료된 방입니다."
              : "이미 시작된 게임입니다. 처음 입장할 때 쓴 닉네임으로 들어와 주세요.",
          reason: lobby.reason,
        },
        { status: 409 },
      );
    }
    const { data: inserted, error: insertError } = await supabase
      .from("players")
      .insert({ id: randomUUID(), room_code: room, nickname, feather: 0 })
      .select("id, room_code, nickname, created_at")
      .maybeSingle();
    if (insertError && insertError.code !== "23505") {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    let joined = inserted as Player | null;
    if (!joined) {
      // 동시에 같은 닉네임으로 들어온 경우 — 먼저 만든 행을 쓴다.
      const { data: again } = await supabase
        .from("players")
        .select("id, room_code, nickname, created_at")
        .eq("room_code", room)
        .eq("nickname", nickname)
        .maybeSingle();
      joined = (again as Player | null) ?? null;
    }
    if (!joined) return NextResponse.json({ error: "입장 처리에 실패했습니다." }, { status: 500 });
    return NextResponse.json({ player: joined, room: roomRow, joined: true });
  }

  const player = data as Player;
  return NextResponse.json({ player, room: roomRow });
}

type Sb = ReturnType<typeof createServerSupabaseClient>;
async function isLobby(
  supabase: Sb,
  room: string,
  game: string | null | undefined,
  status: string | null | undefined,
): Promise<{ ok: true } | { ok: false; reason: "room_ended" | "game_started" }> {
  if (status === "ended") return { ok: false, reason: "room_ended" };
  if (game === "defense") {
    const { data } = await supabase.from("defense_phase_state").select("round").eq("room_code", room).maybeSingle();
    const round = typeof (data as { round?: number } | null)?.round === "number" ? (data as { round: number }).round : 0;
    return round === 0 ? { ok: true } : { ok: false, reason: "game_started" };
  }
  if (game === "mafia") {
    const { data } = await supabase
      .from("mafia_phase_state")
      .select("round_number, phase")
      .eq("room_code", room)
      .maybeSingle();
    const row = data as { round_number?: number; phase?: string } | null;
    const ok = !row || ((row.round_number ?? 0) === 0 && (row.phase ?? "prepare") === "prepare");
    return ok ? { ok: true } : { ok: false, reason: "game_started" };
  }
  return { ok: false, reason: "game_started" };
}
