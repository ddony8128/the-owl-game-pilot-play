import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PostBody = {
  playerId?: string;
  delta?: number;
};

type PostResponse = { ok: true; feather: number } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as PostBody | null;

  if (!body || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "playerId is required" } as PostResponse, {
      status: 400,
    });
  }

  const rawDelta =
    typeof body.delta === "number" && Number.isFinite(body.delta)
      ? Math.trunc(body.delta)
      : 0;
  if (!rawDelta) {
    return NextResponse.json({ error: "delta is required" } as PostResponse, {
      status: 400,
    });
  }

  // 현재 feather 값을 읽어온 뒤 증감
  const { data: row, error: fetchError } = await supabase
    .from("players")
    .select("id, feather")
    .eq("id", body.playerId)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json(
      {
        error:
          fetchError?.message ??
          "플레이어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      } as PostResponse,
      { status: 500 }
    );
  }

  const current =
    typeof (row as { feather?: unknown }).feather === "number"
      ? ((row as { feather: number }).feather ?? 0)
      : 0;

  const nextFeather = Math.max(0, current + rawDelta);

  const { error: updateError } = await supabase
    .from("players")
    .update({ feather: nextFeather })
    .eq("id", body.playerId);

  if (updateError) {
    return NextResponse.json(
      {
        error:
          updateError.message ??
          "깃털 수를 업데이트하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      } as PostResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, feather: nextFeather } as PostResponse,
    { status: 200 }
  );
}


