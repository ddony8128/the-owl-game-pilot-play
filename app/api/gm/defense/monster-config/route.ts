import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { DEFENSE_MONSTERS } from "@/lib/defense/monsters";

// GET /api/gm/defense/monster-config?room=CODE
//   → 그 방의 몬스터 종류별 기준값(base_count) + 현재 풀(count) + 도감 정보
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? "",
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("defense_monster_count")
    .select("id, count, base_count")
    .eq("room_code", room);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byId = new Map(
    ((data ?? []) as { id: number; count: number; base_count: number | null }[]).map(
      (r) => [r.id, r],
    ),
  );

  const monsters = DEFENSE_MONSTERS.map((m) => {
    const row = byId.get(m.id);
    return {
      id: m.id,
      name: m.name,
      maxHp: m.maxHp,
      points: m.points,
      base_count: row?.base_count ?? m.baseCount,
      count: row?.count ?? m.baseCount,
    };
  });

  return NextResponse.json({ monsters });
}

// POST /api/gm/defense/monster-config  { room, counts: { "1": 6, "2": 4, ... } }
//   → 그 방의 base_count 만 수정한다. 본게임 시작(라운드 진입) 시 이 값으로 풀이 리셋된다.
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);
  const room = normalizeRoomCode(body?.room ?? "");
  const counts = body?.counts;
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }
  if (!counts || typeof counts !== "object") {
    return NextResponse.json({ error: "counts 필요" }, { status: 400 });
  }

  const validIds = new Set(DEFENSE_MONSTERS.map((m) => m.id));
  const rows: { room_code: string; id: number; count: number; base_count: number }[] =
    [];
  for (const [key, raw] of Object.entries(counts)) {
    const id = Number(key);
    const value = Number(raw);
    if (!validIds.has(id) || !Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: `잘못된 값: ${key}=${String(raw)}` },
        { status: 400 },
      );
    }
    // base_count 와 (시작 전) 현재 풀을 함께 맞춰 둔다. 진행 중에도 다음 본게임 시작 시 적용.
    rows.push({ room_code: room, id, count: Math.floor(value), base_count: Math.floor(value) });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("defense_monster_count")
    .upsert(rows, { onConflict: "room_code,id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
