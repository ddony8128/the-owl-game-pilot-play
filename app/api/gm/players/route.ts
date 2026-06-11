import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type PlayersResponse = { players: Player[] } | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .order("nickname", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message } as PlayersResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ players: (data || []) as Player[] });
}

// 플레이어 단건 생성. body: { nickname: "철수" }
// 이미 존재하면 생성하지 않고 기존 행을 반환한다(중복 방지).
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    nickname?: unknown;
  } | null;

  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname) {
    return NextResponse.json({ error: "닉네임을 입력해 주세요." }, {
      status: 400,
    });
  }

  const { data: existing, error: existingError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
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
    .insert({ id: randomUUID(), nickname, feather: 0 })
    .select("id, nickname, created_at")
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "플레이어를 생성하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, created: true, player: inserted });
}

// 플레이어 단건 삭제. body: { id: "<uuid>" }
// FK 안전을 위해 해당 플레이어의 1게임(이상교통) 런타임 행을 먼저 정리한다.
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

  // 이 플레이어를 참조하는 런타임 행 정리 (이상교통 + 투표)
  // events/reports 가 subway_player_state 를 참조하므로 자식 → 부모 순서로 삭제
  const childCleanups: { table: string; col: string }[] = [
    { table: "subway_player_events", col: "player_id" },
    { table: "subway_reports", col: "player_id" },
    { table: "subway_player_state", col: "player_id" },
    { table: "player_votes", col: "voter_id" },
  ];

  for (const { table, col } of childCleanups) {
    const { error } = await supabase.from(table).delete().eq(col, id);
    if (error) {
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
