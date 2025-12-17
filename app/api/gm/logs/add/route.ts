import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaLog } from "@/lib/types";

type Body = {
  content?: string;
};

type ResponseBody = { ok: true; log: MafiaLog } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" } as ResponseBody, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("mafia_public_logs")
    .insert({ content: body.content.trim() })
    .select("id, content, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message ?? "로그를 추가하지 못했습니다.",
      } as ResponseBody,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, log: data as MafiaLog } as ResponseBody,
    { status: 200 }
  );
}
