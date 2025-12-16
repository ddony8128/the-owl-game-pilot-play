import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type GmMemo = {
  id: number;
  content: string;
  created_at: string;
};

type GetResponse = { memos: GmMemo[] } | { error: string };

type PostBody = {
  content?: string;
};

type PostResponse = { ok: true; memo: GmMemo } | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("gm_memos")
    .select("id, content, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message } as GetResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ memos: (data || []) as GmMemo[] } as GetResponse);
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as PostBody | null;

  if (!body || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" } as PostResponse, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("gm_memos")
    .insert({ content: body.content.trim() })
    .select("id, content, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message ?? "메모를 저장하지 못했습니다.",
      } as PostResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, memo: data as GmMemo } as PostResponse);
}
