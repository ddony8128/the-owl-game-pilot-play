import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = {
  id?: number;
};

type ResponseBody = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.id !== "number") {
    return NextResponse.json({ error: "id is required" } as ResponseBody, {
      status: 400,
    });
  }

  const targetId = body.id;

  // 먼저 모든 문제를 is_open = false 로 닫고, 해당 id만 true로 연다.
  const { error: closeError } = await supabase
    .from("quiz_questions")
    .update({ is_open: false })
    .neq("id", targetId);

  if (closeError) {
    return NextResponse.json({ error: closeError.message } as ResponseBody, {
      status: 500,
    });
  }

  const { error: openError } = await supabase
    .from("quiz_questions")
    .update({ is_open: true })
    .eq("id", targetId);

  if (openError) {
    return NextResponse.json({ error: openError.message } as ResponseBody, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as ResponseBody);
}
