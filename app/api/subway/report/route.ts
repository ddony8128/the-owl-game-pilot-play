import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type ReportBody = {
  nickname?: string;
  name?: string;
  content?: string;
};

type ReportResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as ReportBody | null;

  if (!body || typeof body.name !== "string" || typeof body.content !== "string") {
    return NextResponse.json(
      { error: "name and content are required" } as ReportResponse,
      { status: 400 }
    );
  }

  const reporterName = body.name.trim();
  const content = body.content.trim();

  if (reporterName.length < 2 || content.length < 2) {
    return NextResponse.json(
      { error: "닉네임과 내용을 2글자 이상 입력해 주세요." } as ReportResponse,
      { status: 400 }
    );
  }

  let playerId: string | null = null;

  if (body.nickname && body.nickname.trim()) {
    const { data, error } = await supabase
      .from("players")
      .select("id, nickname, is_finalist, created_at")
      .eq("nickname", body.nickname.trim())
      .maybeSingle();

    if (!error && data) {
      playerId = (data as Player).id;
    }
  }

  const { error: insertError } = await supabase.from("subway_reports").insert({
    player_id: playerId,
    reporter_name: reporterName,
    content,
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message } as ReportResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true } as ReportResponse, { status: 200 });
}

