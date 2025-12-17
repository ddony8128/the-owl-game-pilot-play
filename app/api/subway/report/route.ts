import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player, SubwayReport } from "@/lib/types";

type ReportBody = {
  nickname?: string;
  name?: string;
  content?: string;
};

type ReportPostResponse =
  | { ok: true; id: number; status: SubwayReport["status"] }
  | { error: string };

type ReportGetResponse =
  | { report: Pick<SubwayReport, "id" | "status"> | null }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");

  if (!idParam) {
    return NextResponse.json({ error: "id is required" } as ReportGetResponse, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("subway_reports")
    .select("id, status")
    .eq("id", idParam)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message } as ReportGetResponse, {
      status: 500,
    });
  }

  return NextResponse.json(
    {
      report: (data as Pick<SubwayReport, "id" | "status"> | null) ?? null,
    } as ReportGetResponse,
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as ReportBody | null;

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.content !== "string"
  ) {
    return NextResponse.json(
      { error: "name and content are required" } as ReportPostResponse,
      { status: 400 }
    );
  }

  const reporterName = body.name.trim();
  const content = body.content.trim();

  if (reporterName.length < 2 || content.length < 2) {
    return NextResponse.json(
      {
        error: "닉네임과 내용을 2글자 이상 입력해 주세요.",
      } as ReportPostResponse,
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

  const { data, error: insertError } = await supabase
    .from("subway_reports")
    .insert({
      player_id: playerId,
      reporter_name: reporterName,
      content,
    })
    .select("id, status")
    .maybeSingle();

  if (insertError || !data) {
    return NextResponse.json(
      {
        error:
          insertError?.message ??
          "신고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      } as ReportPostResponse,
      { status: 500 }
    );
  }

  const row = data as Pick<SubwayReport, "id" | "status">;
  const numericId =
    typeof row.id === "number" ? row.id : (row.id as unknown as number);

  return NextResponse.json(
    { ok: true, id: numericId, status: row.status } as ReportPostResponse,
    { status: 200 }
  );
}
