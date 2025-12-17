import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SubwayReport } from "@/lib/types";

type GetResponse = { reports: SubwayReport[] } | { error: string };

type PostBody = {
  id?: string;
  status?: "approved" | "rejected";
};

type PostResponse = { ok: true; report: SubwayReport } | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("subway_reports")
    .select(
      "id, player_id, reporter_name, content, status, created_at, decided_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message } as GetResponse, {
      status: 500,
    });
  }

  return NextResponse.json({
    reports: (data || []) as SubwayReport[],
  } as GetResponse);
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as PostBody | null;

  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" } as PostResponse, {
      status: 400,
    });
  }

  if (body.status !== "approved" && body.status !== "rejected") {
    return NextResponse.json({ error: "invalid status" } as PostResponse, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("subway_reports")
    .update({
      status: body.status,
      decided_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select(
      "id, player_id, reporter_name, content, status, created_at, decided_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message ?? "신고 상태를 변경하지 못했습니다.",
      } as PostResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    report: data as SubwayReport,
  } as PostResponse);
}
