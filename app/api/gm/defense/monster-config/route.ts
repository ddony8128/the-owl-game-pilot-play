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

  // 본게임이 이미 진행 중(라운드 ≥ 4)이면 살아있는 풀(count)을 건드리지 않고
  // base_count 만 갱신한다(다음 본게임 시작 시 반영). 시작 전(튜토리얼/대기)에는
  // 미리보기를 위해 count 도 함께 맞춰 둔다.
  const { data: phase } = await supabase
    .from("defense_phase_state")
    .select("round")
    .eq("room_code", room)
    .maybeSingle();
  const mainStarted = ((phase?.round as number | null) ?? 0) >= 4;

  const validIds = new Set(DEFENSE_MONSTERS.map((m) => m.id));
  const rows: {
    room_code: string;
    id: number;
    count?: number;
    base_count: number;
  }[] = [];
  for (const [key, raw] of Object.entries(counts)) {
    const id = Number(key);
    const value = Number(raw);
    if (!validIds.has(id) || !Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: `잘못된 값: ${key}=${String(raw)}` },
        { status: 400 },
      );
    }
    const v = Math.floor(value);
    rows.push(
      mainStarted
        ? { room_code: room, id, base_count: v }
        : { room_code: room, id, count: v, base_count: v },
    );
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

  // 진행 중 변경은 base_count 만 저장됐고, 적용은 다음 본게임 시작부터임을 알린다.
  return NextResponse.json(
    mainStarted ? { ok: true, applied: "next_game" } : { ok: true },
  );
}
