import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" },
      { status: 400 }
    );
  }

  const nickname = body.nickname.trim();
  if (!nickname) {
    return NextResponse.json(
      { error: "nickname is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    // GM가 미리 등록한 닉네임만 허용
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." },
      { status: 403 }
    );
  }

  const player = data as Player;
  return NextResponse.json({ player });
}
